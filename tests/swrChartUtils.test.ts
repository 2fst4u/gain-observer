import { describe, expect, it } from 'vitest';
import { computeChartData, computeStats, formatBandwidth, computeXBounds, computeYMax, computeOptions } from '../src/components/Charts/swrChartUtils';
import type { SweepPoint } from '../src/physics/types';
import type { ComparisonSnapshot } from '../src/store/antennaStore';

describe('computeChartData', () => {
  const mockSweep: SweepPoint[] = [
    { frequencyMHz: 7.0, R: 50, X: 0, swr: 1.0 },
    { frequencyMHz: 7.1, R: 100, X: 0, swr: 2.0 },
  ];

  const mockReference: ComparisonSnapshot = {
    antennaType: 'dipole',
    height: 10,
    sweep: [
      { frequencyMHz: 7.0, R: 150, X: 0, swr: 3.0 },
      { frequencyMHz: 7.1, R: 200, X: 0, swr: 4.0 },
    ],
  };

  const baseArgs = {
    comparisonActive: false,
    reference: null,
    referenceFill: 'rgba(255, 179, 71, 0.2)',
    transformerInDisplay: false,
    transformerRatio: 1,
    sweep: mockSweep,
    accent: '#00ffff',
    currentFill: 'rgba(0, 255, 255, 0.2)',
  };

  it('returns raw SWR data when comparison is inactive and transformer is off', () => {
    const result = computeChartData(baseArgs);

    expect(result.datasets).toHaveLength(1);

    const dataset = result.datasets[0];
    expect(dataset.label).toBe('SWR (vs 50 Ω)');
    expect(dataset.data).toEqual([
      { x: 7.0, y: 1.0 },
      { x: 7.1, y: 2.0 },
    ]);
    expect(dataset.borderColor).toBe(baseArgs.accent);
  });

  it('returns both reference and current datasets when comparison is active', () => {
    const result = computeChartData({
      ...baseArgs,
      comparisonActive: true,
      reference: mockReference,
    });

    expect(result.datasets).toHaveLength(2);

    const refDataset = result.datasets[0];
    expect(refDataset.label).toBe('Reference');
    expect(refDataset.data).toEqual([
      { x: 7.0, y: 3.0 },
      { x: 7.1, y: 4.0 },
    ]);

    const curDataset = result.datasets[1];
    expect(curDataset.label).toBe('Current');
    expect(curDataset.data).toEqual([
      { x: 7.0, y: 1.0 },
      { x: 7.1, y: 2.0 },
    ]);
  });

  it('returns post-balun data when transformer is active (without comparison)', () => {
    const result = computeChartData({
      ...baseArgs,
      transformerInDisplay: true,
      transformerRatio: 4, // 4:1 balun => divides impedance by 4
      // At 7.1 MHz, R is 100. Post-balun R = 25. SWR for 25 vs 50 is 2.0.
      // At 7.0 MHz, R is 50. Post-balun R = 12.5. SWR for 12.5 vs 50 is 4.0.
    });

    expect(result.datasets).toHaveLength(1);

    const dataset = result.datasets[0];
    expect(dataset.label).toBe('SWR (vs 50 Ω)');
    expect(dataset.data).toHaveLength(2);
    expect(dataset.data[0].x).toBe(7.0);
    expect(dataset.data[0].y).toBeCloseTo(4.0, 5);
    expect(dataset.data[1].x).toBe(7.1);
    expect(dataset.data[1].y).toBeCloseTo(2.0, 5);
  });

  it('returns reference and post-balun datasets when both comparison and transformer are active', () => {
    const result = computeChartData({
      ...baseArgs,
      comparisonActive: true,
      reference: mockReference,
      transformerInDisplay: true,
      transformerRatio: 2, // 2:1 balun => divides impedance by 2
      // At 7.0 MHz, R is 50. Post-balun R = 25. SWR for 25 vs 50 is 2.0.
      // At 7.1 MHz, R is 100. Post-balun R = 50. SWR for 50 vs 50 is 1.0.
    });

    expect(result.datasets).toHaveLength(2);

    const refDataset = result.datasets[0];
    expect(refDataset.label).toBe('Reference');
    expect(refDataset.data).toEqual([
      { x: 7.0, y: 3.0 },
      { x: 7.1, y: 4.0 },
    ]);

    const curDataset = result.datasets[1];
    expect(curDataset.label).toBe('Current (after 2:1)');
    expect(curDataset.data).toHaveLength(2);
    expect(curDataset.data[0].x).toBe(7.0);
    expect(curDataset.data[0].y).toBeCloseTo(2.0, 5);
    expect(curDataset.data[1].x).toBe(7.1);
    expect(curDataset.data[1].y).toBeCloseTo(1.0, 5);
  });
});

describe('formatBandwidth', () => {
  it('formats values less than 1 MHz in kHz', () => {
    expect(formatBandwidth(0.5)).toBe('500 kHz');
    expect(formatBandwidth(0.999)).toBe('999 kHz');
    expect(formatBandwidth(0.001)).toBe('1 kHz');
  });

  it('rounds kHz values to the nearest integer', () => {
    expect(formatBandwidth(0.1234)).toBe('123 kHz');
    expect(formatBandwidth(0.1236)).toBe('124 kHz');
  });

  it('formats values exactly 1 MHz or greater in MHz to 2 decimal places', () => {
    expect(formatBandwidth(1)).toBe('1.00 MHz');
    expect(formatBandwidth(1.5)).toBe('1.50 MHz');
    // Note: JS .toFixed() rounds 1.555 down to 1.55 due to floating point representation
    expect(formatBandwidth(1.555)).toBe('1.55 MHz');
    expect(formatBandwidth(1.556)).toBe('1.56 MHz');
    expect(formatBandwidth(10)).toBe('10.00 MHz');
  });
});

describe('computeXBounds', () => {
  const mockSweep = [
    { frequencyMHz: 7.0, R: 50, X: 0, swr: 1.0 },
    { frequencyMHz: 7.2, R: 100, X: 0, swr: 2.0 },
  ];

  const mockReference = {
    antennaType: 'dipole' as const,
    height: 10,
    sweep: [
      { frequencyMHz: 6.9, R: 150, X: 0, swr: 3.0 },
      { frequencyMHz: 7.3, R: 200, X: 0, swr: 4.0 },
    ],
  };

  it('returns default bounds when sweeps are empty', () => {
    const result = computeXBounds({
      sweep: [],
      comparisonActive: false,
      reference: null,
      frequency: 7.0,
    });
    expect(result.min).toBeCloseTo(7.0 * 0.95);
    expect(result.max).toBeCloseTo(7.0 * 1.05);
  });

  it('returns default bounds when main sweep is empty and reference sweep is empty', () => {
    const result = computeXBounds({
      sweep: [],
      comparisonActive: true,
      reference: { ...mockReference, sweep: [] },
      frequency: 7.0,
    });
    expect(result.min).toBeCloseTo(7.0 * 0.95);
    expect(result.max).toBeCloseTo(7.0 * 1.05);
  });

  it('returns bounds based only on main sweep when comparison is inactive', () => {
    const result = computeXBounds({
      sweep: mockSweep,
      comparisonActive: false,
      reference: mockReference,
      frequency: 7.0,
    });
    expect(result.min).toBe(7.0);
    expect(result.max).toBe(7.2);
  });

  it('returns bounds across both sweeps when comparison is active', () => {
    const result = computeXBounds({
      sweep: mockSweep,
      comparisonActive: true,
      reference: mockReference,
      frequency: 7.0,
    });
    expect(result.min).toBe(6.9);
    expect(result.max).toBe(7.3);
  });

  it('returns bounds based on reference sweep when main sweep is empty but comparison is active', () => {
    const result = computeXBounds({
      sweep: [],
      comparisonActive: true,
      reference: mockReference,
      frequency: 7.0,
    });
    expect(result.min).toBe(6.9);
    expect(result.max).toBe(7.3);
  });
});

describe('computeStats', () => {
  it('returns null when sweep array is empty', () => {
    const result = computeStats({ sweep: [] });
    expect(result).toBeNull();
  });

  it('evaluates minSWR, minFreq, and bands with inactive transformer', () => {
    const sweep: SweepPoint[] = [
      { frequencyMHz: 7.0, R: 50, X: 0, swr: 1.5 },
      { frequencyMHz: 7.1, R: 50, X: 0, swr: 1.1 }, // minSWR
      { frequencyMHz: 7.2, R: 50, X: 0, swr: 2.1 },
    ];
    const result = computeStats({ sweep });

    expect(result).not.toBeNull();
    expect(result?.minSWR).toBe(1.1);
    expect(result?.minFreq).toBe(7.1);

    expect(result?.bands).toHaveLength(1);
    const band = result!.bands[0];
    expect(band.fLow).toBe(7.0);
    expect(band.lowClipped).toBe(true);
    expect(band.fHigh).toBeCloseTo(7.19, 3);
    expect(band.highClipped).toBe(false);
  });

  it('evaluates minSWR, minFreq, and bands with active transformer', () => {
    // With a 4:1 transformer, impedance gets divided by 4 before SWR is calculated.
    // 50 Ohm vs 50 Ohm -> SWR 1.0 (Raw SWR)
    // Post balun: 12.5 Ohm vs 50 Ohm -> SWR 4.0
    //
    // 200 Ohm vs 50 Ohm -> SWR 4.0 (Raw SWR)
    // Post balun: 50 Ohm vs 50 Ohm -> SWR 1.0
    //
    // Let's create a sweep with a high raw SWR but good post-balun SWR.
    const sweep: SweepPoint[] = [
      { frequencyMHz: 7.0, R: 250, X: 0, swr: 5.0 }, // Post balun (250/4) = 62.5 -> SWR 1.25
      { frequencyMHz: 7.1, R: 200, X: 0, swr: 4.0 }, // Post balun (200/4) = 50.0 -> SWR 1.0 (minSWR)
      { frequencyMHz: 7.2, R: 50, X: 0, swr: 1.0 },  // Post balun (50/4)  = 12.5 -> SWR 4.0
    ];

    const result = computeStats({
      sweep,
      transformerInDisplay: true,
      transformerRatio: 4,
    });

    expect(result).not.toBeNull();
    // It should evaluate based on post-balun SWR, so the minSWR should be 1.0 at 7.1 MHz.
    expect(result?.minSWR).toBeCloseTo(1.0, 3);
    expect(result?.minFreq).toBe(7.1);

    // Post balun SWR:
    // 7.0: 1.25 (<=2)
    // 7.1: 1.0 (<=2)
    // 7.2: 4.0 (>2)
    // Crossing 2.0 between 7.1 and 7.2.
    // t = (2 - 1.0) / (4.0 - 1.0) = 1.0 / 3.0 = 0.333...
    // fHigh = 7.1 + 0.333... * 0.1 = 7.1333...
    expect(result?.bands).toHaveLength(1);
    const band = result!.bands[0];
    expect(band.fLow).toBe(7.0);
    expect(band.lowClipped).toBe(true);
    expect(band.fHigh).toBeCloseTo(7.133, 3);
    expect(band.highClipped).toBe(false);
  });
});

describe('computeOptions', () => {
  const baseArgs = {
    frequency: 7.1,
    accent: '#ff0000',
    stats: null,
    yMax: 5,
    xBounds: { min: 6.9, max: 7.3 },
    chartText: '#ffffff',
    chartGrid: '#333333',
    comparisonActive: false,
  };

  it('generates basic chart options without stats', () => {
    const options = computeOptions(baseArgs);

    expect(options.responsive).toBe(true);
    expect(options.maintainAspectRatio).toBe(false);
    expect(options.scales?.y?.max).toBe(5);
    expect(options.scales?.y?.min).toBe(1);
    expect(options.scales?.x?.min).toBe(6.9);
    expect(options.scales?.x?.max).toBe(7.3);

    // Basic annotations should exist
    const annotations = options.plugins?.annotation?.annotations as any;
    expect(annotations).toBeDefined();
    expect(annotations.swr2).toBeDefined();
    expect(annotations.swr2.yMin).toBe(2);
    expect(annotations.currentFrequency).toBeDefined();
    expect(annotations.currentFrequency.xMin).toBe(7.1);

    // No stats annotations
    expect(annotations.minFreq).toBeUndefined();
    expect(annotations.band0Low).toBeUndefined();
  });

  it('adds stats annotations when stats are provided', () => {
    const stats = {
      minSWR: 1.2,
      minFreq: 7.15,
      bands: [
        { fLow: 7.05, fHigh: 7.25, lowClipped: false, highClipped: false },
        { fLow: 7.28, fHigh: 7.29, lowClipped: true, highClipped: true }
      ]
    };

    const options = computeOptions({ ...baseArgs, stats });
    const annotations = options.plugins?.annotation?.annotations as any;

    // Min freq line
    expect(annotations.minFreq).toBeDefined();
    expect(annotations.minFreq.xMin).toBe(7.15);

    // Unclipped band should have both edge markers
    expect(annotations.band0Low).toBeDefined();
    expect(annotations.band0Low.xMin).toBe(7.05);
    expect(annotations.band0High).toBeDefined();
    expect(annotations.band0High.xMin).toBe(7.25);

    // Clipped band should not have edge markers
    expect(annotations.band1Low).toBeUndefined();
    expect(annotations.band1High).toBeUndefined();
  });

  it('toggles legend display based on comparisonActive', () => {
    const optsInactive = computeOptions({ ...baseArgs, comparisonActive: false });
    expect(optsInactive.plugins?.legend?.display).toBe(false);

    const optsActive = computeOptions({ ...baseArgs, comparisonActive: true });
    expect(optsActive.plugins?.legend?.display).toBe(true);
  });
});

describe('computeYMax', () => {
  const mockSweep: SweepPoint[] = [
    { frequencyMHz: 7.0, R: 50, X: 0, swr: 1.5 },
    { frequencyMHz: 7.1, R: 50, X: 0, swr: 1.8 },
  ];

  const mockReference: ComparisonSnapshot = {
    antennaType: 'dipole',
    height: 10,
    sweep: [
      { frequencyMHz: 7.0, R: 150, X: 0, swr: 2.5 },
    ],
  };

  const baseArgs = {
    sweep: mockSweep,
    comparisonActive: false,
    reference: null,
    transformerInDisplay: false,
    transformerRatio: 1,
  };

  it('returns default of 5 when sweeps are empty and no active reference', () => {
    expect(computeYMax({ ...baseArgs, sweep: [] })).toBe(5);
  });

  it('calculates based on raw swr values when transformer is inactive', () => {
    // Max SWR in mockSweep is 1.8.
    // anyBelow2 = true.
    // scaled = Math.max(3, Math.ceil(1.8 * 1.5)) = Math.max(3, Math.ceil(2.7)) = 3.
    // Returns Math.min(999, 3) = 3.
    expect(computeYMax(baseArgs)).toBe(3);
  });

  it('returns appropriate scaled yMax when values cross 2.0', () => {
    const sweep = [
      ...mockSweep,
      { frequencyMHz: 7.2, R: 50, X: 0, swr: 4.0 }, // max
    ];
    // max SWR = 4.0. anyBelow2 = true (from mockSweep).
    // scaled = Math.max(3, Math.ceil(4.0 * 1.5)) = Math.max(3, 6) = 6.
    expect(computeYMax({ ...baseArgs, sweep })).toBe(6);
  });

  it('clips tight scale at SWR_CAP of 10 if bands are usable', () => {
    const sweep = [
      ...mockSweep, // has values below 2
      { frequencyMHz: 7.2, R: 50, X: 0, swr: 20.0 }, // Huge spike
    ];
    // max SWR = 20. anyBelow2 = true.
    // scaled = Math.ceil(20 * 1.5) = 30.
    // capped at 10.
    expect(computeYMax({ ...baseArgs, sweep })).toBe(10);
  });

  it('allows higher scales (no SWR_CAP) when no points are below 2', () => {
    const sweep: SweepPoint[] = [
      { frequencyMHz: 7.0, R: 50, X: 0, swr: 5.0 },
      { frequencyMHz: 7.1, R: 50, X: 0, swr: 15.0 }, // max
    ];
    // maxVal = 15. anyBelow2 = false.
    // returns Math.max(10, Math.min(15 * 1.1, 999))
    // 15 * 1.1 = 16.5
    expect(computeYMax({ ...baseArgs, sweep })).toBeCloseTo(16.5);
  });

  it('includes reference sweep max values when comparison is active', () => {
    // mockSweep max is 1.8.
    // mockReference max is 2.5.
    // comparison is active, so combined max is 2.5. anyBelow2 is true.
    // scaled = Math.max(3, Math.ceil(2.5 * 1.5)) = Math.max(3, 4) = 4.
    expect(computeYMax({
      ...baseArgs,
      comparisonActive: true,
      reference: mockReference,
    })).toBe(4);
  });

  it('uses post-balun values when transformerInDisplay is true', () => {
    const sweep: SweepPoint[] = [
      // 200 Ohm vs 50. raw swr = 4.0
      // with 4:1 balun, post-balun is 50 Ohm -> SWR 1.0
      { frequencyMHz: 7.0, R: 200, X: 0, swr: 4.0 },
      // 400 Ohm vs 50. raw swr = 8.0
      // with 4:1 balun, post-balun is 100 Ohm -> SWR 2.0
      { frequencyMHz: 7.1, R: 400, X: 0, swr: 8.0 },
    ];

    // Max raw SWR is 8.0.
    // If it used raw SWR, scaled would be ceil(8.0 * 1.5) = 12 -> capped at 10.
    // Post balun SWRs: 1.0, 2.0. Max post-balun = 2.0. anyBelow2 = true.
    // scaled = Math.max(3, ceil(2.0 * 1.5)) = Math.max(3, 3) = 3.
    expect(computeYMax({
      ...baseArgs,
      sweep,
      transformerInDisplay: true,
      transformerRatio: 4,
    })).toBe(3);
  });
});

describe('computeOptions callbacks', () => {
  const baseArgs = {
    frequency: 7.1,
    accent: '#ff0000',
    stats: null,
    yMax: 5,
    xBounds: { min: 6.9, max: 7.3 },
    chartText: '#ffffff',
    chartGrid: '#333333',
    comparisonActive: false,
  };

  it('x-axis callback formats tick to 2 decimal places', () => {
    const options = computeOptions(baseArgs);
    const callback = options.scales?.x?.ticks?.callback as Function;
    expect(callback).toBeDefined();

    // Simulating chart.js tick callback
    expect(callback(7.1234)).toBe('7.12');
    expect(callback('7.5')).toBe('7.50');
  });
});
