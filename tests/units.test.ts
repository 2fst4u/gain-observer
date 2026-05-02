import { describe, expect, it } from 'vitest';
import {
  toDisplayLength,
  fromDisplayLength,
  formatLength,
} from '../src/physics/units';

describe('unit conversions', () => {
  it('round-trips m → ft → m within float precision', () => {
    const samples = [0, 0.1, 1, 10.05, 21.11, 100];
    for (const m of samples) {
      const back = fromDisplayLength(toDisplayLength(m, 'imperial'), 'imperial');
      expect(back).toBeCloseTo(m, 10);
    }
  });

  it('toDisplayLength returns meters for metric and feet for imperial', () => {
    expect(toDisplayLength(1, 'metric')).toBe(1);
    expect(toDisplayLength(1, 'imperial')).toBeCloseTo(3.28084, 4);
  });

  it('fromDisplayLength is inverse of toDisplayLength', () => {
    const m = 5.5;
    expect(fromDisplayLength(toDisplayLength(m, 'imperial'), 'imperial')).toBeCloseTo(m, 10);
    expect(fromDisplayLength(toDisplayLength(m, 'metric'), 'metric')).toBe(m);
  });

  it('formatLength includes correct unit suffix', () => {
    expect(formatLength(10, 'metric', 2)).toBe('10.00 m');
    expect(formatLength(1, 'imperial', 2)).toBe('3.28 ft');
  });

  it('converts common benchmarks correctly', () => {
    // 1 meter approx 3.28084 feet
    expect(toDisplayLength(1, 'imperial')).toBeCloseTo(3.28084, 5);
    // 1 foot is exactly 0.3048 meters
    expect(fromDisplayLength(1, 'imperial')).toBe(0.3048);
  });
});
