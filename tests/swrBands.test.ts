import { describe, expect, it } from 'vitest';
import { findSwrBands } from '../src/physics/bandwidth';
import { formatBandwidth, computeYMax } from '../src/components/Charts/swrChartUtils';

describe('findSwrBands', () => {
  it('finds a single interior band with interpolated edges', () => {
    const bands = findSwrBands([7.0, 7.5, 8.0], [3, 1.5, 3], 2);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.lowClipped).toBe(false);
    expect(bands[0]!.highClipped).toBe(false);
    // Crossings interpolated between 7.0→7.5 and 7.5→8.0.
    expect(bands[0]!.fLow).toBeCloseTo(7.0 + 0.5 * (1 / 1.5), 6);
    expect(bands[0]!.fHigh).toBeCloseTo(7.5 + 0.5 * (0.5 / 1.5), 6);
  });

  it('detects multiple disjoint bands', () => {
    const bands = findSwrBands(
      [7.0, 7.5, 8.0, 8.5, 9.0],
      [3, 1.5, 3, 1.5, 3],
      2,
    );
    expect(bands).toHaveLength(2);
    expect(bands[0]!.fLow).toBeLessThan(bands[0]!.fHigh);
    expect(bands[1]!.fLow).toBeGreaterThan(bands[0]!.fHigh);
    expect(bands.every((b) => !b.lowClipped && !b.highClipped)).toBe(true);
  });

  it('flags a band clipped at the low edge', () => {
    const bands = findSwrBands([7.0, 7.1, 7.2], [1.5, 1.2, 2.5], 2);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.lowClipped).toBe(true);
    expect(bands[0]!.highClipped).toBe(false);
    expect(bands[0]!.fLow).toBe(7.0);
  });

  it('flags a band clipped at both edges when the whole sweep is under 2:1', () => {
    const bands = findSwrBands([7.0, 7.1, 7.2], [1.5, 1.2, 1.5], 2);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.lowClipped).toBe(true);
    expect(bands[0]!.highClipped).toBe(true);
    expect(bands[0]!.fLow).toBe(7.0);
    expect(bands[0]!.fHigh).toBe(7.2);
  });

  it('returns no bands when the SWR never dips to threshold', () => {
    expect(findSwrBands([7.0, 7.5, 8.0], [3, 4, 3], 2)).toHaveLength(0);
  });

  it('handles an empty sweep', () => {
    expect(findSwrBands([], [], 2)).toHaveLength(0);
  });
});

describe('formatBandwidth', () => {
  it('shows kHz below 1 MHz', () => {
    expect(formatBandwidth(0.245)).toBe('245 kHz');
    expect(formatBandwidth(0.5)).toBe('500 kHz');
  });

  it('shows MHz at or above 1 MHz', () => {
    expect(formatBandwidth(1.0)).toBe('1.00 MHz');
    expect(formatBandwidth(9.9)).toBe('9.90 MHz');
    expect(formatBandwidth(15.5)).toBe('15.50 MHz');
  });
});

describe('computeYMax', () => {
  const base = { comparisonActive: false, reference: null, transformerInDisplay: false, transformerRatio: 1 };

  it('uses floor of 3 when all values are below 2.5 (well-matched antenna)', () => {
    // Very well-matched: max SWR 1.2 → ceil(1.2 × 1.2) = 2, floored to 3.
    const sweep = [
      { frequencyMHz: 7.0, R: 50, X: 5, swr: 1.1 },
      { frequencyMHz: 7.5, R: 60, X: 0, swr: 1.2 },
    ];
    expect(computeYMax({ ...base, sweep })).toBe(3);
  });

  it('scales tightly above the actual peak — no fixed-5 floor for moderate SWR', () => {
    // maxVal = 2.7 → ceil(2.7 × 1.2) = ceil(3.24) = 4, not the old floor of 5.
    const sweep = [
      { frequencyMHz: 3.5, R: 50, X: 2, swr: 1.1 },   // in-band
      { frequencyMHz: 8.0, R: 130, X: 20, swr: 2.7 },  // between bands
      { frequencyMHz: 14.0, R: 48, X: 0, swr: 1.04 },  // in-band
    ];
    expect(computeYMax({ ...base, sweep })).toBe(4);
  });

  it('caps yMax at 10 when usable bands exist but inter-band SWR is very high', () => {
    // Multi-band antenna: low SWR at two bands, very high SWR between them.
    const sweep = [
      { frequencyMHz: 3.5, R: 50, X: 2, swr: 1.04 },  // in-band
      { frequencyMHz: 8.0, R: 2000, X: 0, swr: 40.0 }, // inter-band peak
      { frequencyMHz: 14.0, R: 48, X: 0, swr: 1.04 },  // in-band
    ];
    const yMax = computeYMax({ ...base, sweep });
    expect(yMax).toBe(10); // capped — inter-band 40:1 does not inflate the scale
  });

  it('does not cap when there are no usable bands (SWR always > 2)', () => {
    const sweep = [
      { frequencyMHz: 7.0, R: 500, X: 0, swr: 10.0 },
      { frequencyMHz: 8.0, R: 400, X: 0, swr: 8.0 },
    ];
    const yMax = computeYMax({ ...base, sweep });
    expect(yMax).toBeGreaterThanOrEqual(11); // no cap — no usable band found
  });
});
