import { describe, expect, it } from 'vitest';
import { findSwrBands } from '../src/physics/bandwidth';
import { formatBandwidth } from '../src/components/Charts/swrChartUtils';

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
