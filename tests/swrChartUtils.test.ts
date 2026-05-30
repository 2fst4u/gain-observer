import { describe, expect, it } from 'vitest';
import { computeChartData, formatBandwidth } from '../src/components/Charts/swrChartUtils';
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
