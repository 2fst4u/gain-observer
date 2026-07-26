import { describe, it, expect } from 'vitest';
import { clampSpan } from '../src/physics/sweep';
import { SWEEP_F_MIN_MHZ, SWEEP_F_MAX_MHZ } from '../src/physics/constants';

describe('clampSpan', () => {
  it('computes symmetric span when within limits', () => {
    const freq = 14;
    const spanFraction = 0.1;
    const result = clampSpan(freq, spanFraction);
    expect(result.start).toBeCloseTo(13.3, 6);
    expect(result.end).toBeCloseTo(14.7, 6);
  });

  it('clamps start to SWEEP_F_MIN_MHZ', () => {
    const freq = 1.05;
    const spanFraction = 0.2; // +/- 0.105 -> min is 0.945
    const result = clampSpan(freq, spanFraction);
    expect(result.start).toBe(SWEEP_F_MIN_MHZ);
    expect(result.end).toBeCloseTo(1.155, 6);
  });

  it('clamps end to SWEEP_F_MAX_MHZ', () => {
    const freq = 29.5;
    const spanFraction = 0.1; // +/- 1.475 -> max is 30.975
    const result = clampSpan(freq, spanFraction);
    expect(result.start).toBeCloseTo(28.025, 6);
    expect(result.end).toBe(SWEEP_F_MAX_MHZ);
  });

  it('handles zero spanFraction', () => {
    const freq = 7.1;
    const result = clampSpan(freq, 0);
    expect(result.start).toBe(7.1);
    expect(result.end).toBe(7.1);
  });
});
