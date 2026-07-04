import { describe, expect, it } from 'vitest';
import { computeChartData, computeStats, formatBandwidth, computeYMax, computeOptions, buildAnnotations, buildScales } from '../src/components/Charts/swrChartUtils';
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
    const annotations = options.plugins?.annotation?.annotations as Record<string, { yMin?: number; xMin?: number }> | undefined;
    expect(annotations).toBeDefined();
    expect(annotations?.swr2).toBeDefined();
    expect(annotations?.swr2?.yMin).toBe(2);
    expect(annotations?.currentFrequency).toBeDefined();
    expect(annotations?.currentFrequency?.xMin).toBe(7.1);

    // No stats annotations
    expect(annotations?.minFreq).toBeUndefined();
    expect(annotations?.band0Low).toBeUndefined();
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
    const annotations = options.plugins?.annotation?.annotations as Record<string, { yMin?: number; xMin?: number }> | undefined;

    // Min freq line
    expect(annotations?.minFreq).toBeDefined();
    expect(annotations?.minFreq?.xMin).toBe(7.15);

    // Unclipped band should have both edge markers
    expect(annotations?.band0Low).toBeDefined();
    expect(annotations?.band0Low?.xMin).toBe(7.05);
    expect(annotations?.band0High).toBeDefined();
    expect(annotations?.band0High?.xMin).toBe(7.25);

    // Clipped band should not have edge markers
    expect(annotations?.band1Low).toBeUndefined();
    expect(annotations?.band1High).toBeUndefined();
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
    expect(computeYMax(baseArgs)).toBe(3);
  });

  it('returns appropriate scaled yMax when values cross 2.0', () => {
    const sweep = [
      ...mockSweep,
      { frequencyMHz: 7.2, R: 50, X: 0, swr: 4.0 }, // max
    ];
    expect(computeYMax({ ...baseArgs, sweep })).toBe(6);
  });

  it('clips tight scale at SWR_CAP of 10 if bands are usable', () => {
    const sweep = [
      ...mockSweep, // has values below 2
      { frequencyMHz: 7.2, R: 50, X: 0, swr: 20.0 }, // Huge spike
    ];
    expect(computeYMax({ ...baseArgs, sweep })).toBe(10);
  });

  it('clips at SWR_CAP of 10 even when no points are below 2', () => {
    // The y-axis is a fixed reference frame; an all-mismatched window must not
    // balloon the vertical scale.
    const sweep: SweepPoint[] = [
      { frequencyMHz: 7.0, R: 50, X: 0, swr: 5.0 },
      { frequencyMHz: 7.1, R: 50, X: 0, swr: 15.0 }, // max
    ];
    expect(computeYMax({ ...baseArgs, sweep })).toBe(10);
  });

  it('includes reference sweep max values when comparison is active', () => {
    expect(computeYMax({
      ...baseArgs,
      comparisonActive: true,
      reference: mockReference,
    })).toBe(4);
  });

  it('uses post-balun values when transformerInDisplay is true', () => {
    const sweep: SweepPoint[] = [
      { frequencyMHz: 7.0, R: 200, X: 0, swr: 4.0 },
      { frequencyMHz: 7.1, R: 400, X: 0, swr: 8.0 },
    ];

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
    const callback = options.scales?.x?.ticks?.callback as (value: number | string) => string;
    expect(callback).toBeDefined();

    // Simulating chart.js tick callback
    if (callback) {
      expect(callback(7.1234)).toBe('7.12');
      expect(callback('7.5')).toBe('7.50');
    }
  });
});

describe('buildAnnotations', () => {
  const baseArgs = {
    frequency: 7.1,
    accent: '#ff0000',
    stats: null,
  };

  it('generates basic annotations without stats', () => {
    const annotations = buildAnnotations(baseArgs.frequency, baseArgs.accent, baseArgs.stats);

    expect(annotations).toBeDefined();

    // swr2 line
    expect(annotations.swr2).toEqual({
      type: 'line',
      yMin: 2,
      yMax: 2,
      borderColor: '#ff6b6b',
      borderWidth: 1,
      borderDash: [6, 4],
    });

    // currentFrequency line
    expect(annotations.currentFrequency).toEqual({
      type: 'line',
      xMin: 7.1,
      xMax: 7.1,
      borderColor: '#ff0000',
      borderWidth: 1,
      borderDash: [4, 4],
    });

    // No stats annotations
    expect(annotations.minFreq).toBeUndefined();
    expect(annotations.band0Low).toBeUndefined();
  });

  it('adds stats annotations when stats are provided and handles clipped bands', () => {
    const stats = {
      minSWR: 1.2,
      minFreq: 7.15,
      bands: [
        { fLow: 7.05, fHigh: 7.25, lowClipped: false, highClipped: false },
        { fLow: 7.28, fHigh: 7.29, lowClipped: true, highClipped: true }
      ]
    };

    const annotations = buildAnnotations(baseArgs.frequency, baseArgs.accent, stats);

    // Min freq line
    expect(annotations.minFreq).toEqual({
      type: 'line',
      xMin: 7.15,
      xMax: 7.15,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderWidth: 1,
      borderDash: [2, 2],
    });

    // Unclipped band should have both edge markers
    expect(annotations.band0Low).toEqual({
      type: 'line',
      xMin: 7.05,
      xMax: 7.05,
      borderColor: 'rgba(255, 107, 107, 0.4)',
      borderWidth: 1,
      borderDash: [4, 4],
    });

    expect(annotations.band0High).toEqual({
      type: 'line',
      xMin: 7.25,
      xMax: 7.25,
      borderColor: 'rgba(255, 107, 107, 0.4)',
      borderWidth: 1,
      borderDash: [4, 4],
    });

    // Clipped band should not have edge markers
    expect(annotations.band1Low).toBeUndefined();
    expect(annotations.band1High).toBeUndefined();
  });
});

describe('buildScales', () => {
  const yMax = 5;
  const xBounds = { min: 6.9, max: 7.3 };
  const chartText = '#ffffff';
  const chartGrid = '#333333';

  it('constructs correct chart scales objects', () => {
    const scales = buildScales(yMax, xBounds, chartText, chartGrid);

    // y-axis checks
    expect(scales?.y?.min).toBe(1);
    expect(scales?.y?.max).toBe(5);
    expect(scales?.y?.ticks?.color).toBe('#ffffff');
    expect(scales?.y?.grid?.color).toBe('#333333');
    expect(scales?.y?.title?.display).toBe(true);
    expect(scales?.y?.title?.text).toBe('SWR (vs 50 Ω)');
    expect(scales?.y?.title?.color).toBe('#ffffff');

    // x-axis checks
    expect(scales?.x?.type).toBe('linear');
    expect(scales?.x?.min).toBe(6.9);
    expect(scales?.x?.max).toBe(7.3);
    expect(scales?.x?.ticks?.color).toBe('#ffffff');
    expect(scales?.x?.grid?.color).toBe('#333333');
    expect(scales?.x?.title?.display).toBe(true);
    expect(scales?.x?.title?.text).toBe('MHz');
    expect(scales?.x?.title?.color).toBe('#ffffff');

    // x-axis callback formats to 2 decimal places
    const callback = scales?.x?.ticks?.callback as (value: number | string) => string;
    expect(callback(7.1234)).toBe('7.12');
    expect(callback('7.5')).toBe('7.50');
  });
});
