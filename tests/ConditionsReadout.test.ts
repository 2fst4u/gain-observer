import { describe, expect, it } from 'vitest';
import { formatRange } from '../src/components/Panel/Propagation/ConditionsReadout';

describe('formatRange', () => {
  it('formats metric distances correctly', () => {
    expect(formatRange(10, 'metric')).toBe('10 km');
    expect(formatRange(0, 'metric')).toBe('0 km');
  });

  it('formats imperial distances correctly', () => {
    // 1 mi is approx 1.609344 km
    expect(formatRange(1.609344, 'imperial')).toBe('1 mi');
    expect(formatRange(16.09344, 'imperial')).toBe('10 mi');
    expect(formatRange(0, 'imperial')).toBe('0 mi');
  });
});
