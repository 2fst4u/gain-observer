import { describe, it, expect } from 'vitest';
import { cleanZero } from '../src/utils/math';

describe('cleanZero', () => {
  it('should return 0 for -0', () => {
    expect(cleanZero(-0)).toBe(0);
    // Extra assertion to ensure it's not -0
    expect(Object.is(cleanZero(-0), 0)).toBe(true);
  });

  it('should return 0 for 0', () => {
    expect(cleanZero(0)).toBe(0);
  });

  it('should return the number itself for positive numbers', () => {
    expect(cleanZero(42)).toBe(42);
    expect(cleanZero(3.14)).toBe(3.14);
  });

  it('should return the number itself for negative numbers', () => {
    expect(cleanZero(-42)).toBe(-42);
    expect(cleanZero(-3.14)).toBe(-3.14);
  });

  it('should handle special number values', () => {
    expect(cleanZero(NaN)).toBeNaN();
    expect(cleanZero(Infinity)).toBe(Infinity);
    expect(cleanZero(-Infinity)).toBe(-Infinity);
  });
});
