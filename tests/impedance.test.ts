import { describe, expect, it } from 'vitest';
import { swr, mismatchLossFactor, transformImpedance } from '../src/physics/impedance';

describe('reflection coefficient and SWR', () => {
  it('perfect match => |Γ|=0, SWR=1', () => {
    expect(swr({ R: 50, X: 0 })).toBeCloseTo(1, 10);
  });

  it('open circuit => |Γ|=1, SWR at display cap', () => {
    expect(swr({ R: 1e15, X: 0 })).toBe(999);
  });

  it('73+j42 dipole at 50Ω gives realistic SWR ~1.9', () => {
    const s = swr({ R: 73, X: 42 });
    expect(s).toBeGreaterThan(1.5);
    expect(s).toBeLessThan(2.3);
  });

  it('reactive-only impedance gives high SWR', () => {
    expect(swr({ R: 0.1, X: 100 })).toBe(999);
  });

  it('very low resistance gives high SWR', () => {
    expect(swr({ R: 1, X: 0 })).toBeCloseTo(50, 0);
  });

  it('very high resistance gives high SWR', () => {
    // 10000 / 50 = 200
    expect(swr({ R: 10000, X: 0 })).toBeCloseTo(200, 5);
  });

  it('extremely high resistance capped at 999', () => {
    expect(swr({ R: 1e10, X: 0 })).toBe(999);
  });

  it('den === 0 edge case (e.g. Z = -Z0) gives |Γ| = 1', () => {
    // With Z0 = 50, Z = -50 + j0 gives denR = -50 + 50 = 0 and denX = 0 => den = 0.
    // When |Γ| = 1, SWR is clamped at 999.
    expect(swr({ R: -50, X: 0 })).toBe(999);
  });
});

describe('mismatchLossFactor', () => {
  it('perfect match gives factor 1 (no loss)', () => {
    expect(mismatchLossFactor({ R: 50, X: 0 })).toBeCloseTo(1, 10);
  });

  it('open circuit gives factor ~0 (total reflection)', () => {
    expect(mismatchLossFactor({ R: 1e15, X: 0 })).toBeCloseTo(0, 3);
  });

  it('SWR 3:1 real load gives expected mismatch loss', () => {
    // Z = 150 Ω, Z0 = 50 Ω → |Γ| = 100/200 = 0.5 → factor = 1 - 0.25 = 0.75
    expect(mismatchLossFactor({ R: 150, X: 0 })).toBeCloseTo(0.75, 6);
  });

  it('SWR 2:1 real load gives 11% mismatch loss', () => {
    // Z = 100 Ω, Z0 = 50 Ω → |Γ| = 50/150 = 1/3 → factor = 1 - 1/9 ≈ 0.889
    expect(mismatchLossFactor({ R: 100, X: 0 })).toBeCloseTo(8 / 9, 6);
  });

  it('reactive load has mismatch loss consistent with SWR', () => {
    // Pure reactive load (R = 50, X = 50): |Γ| from complex impedance
    const mlf = mismatchLossFactor({ R: 50, X: 50 });
    expect(mlf).toBeGreaterThan(0);
    expect(mlf).toBeLessThan(1);
  });
});

describe('transformImpedance', () => {
  it('450+j0 with ratio 9 gives 50+j0 and SWR ~1:1', () => {
    const z = transformImpedance({ R: 450, X: 0 }, 9);
    expect(z.R).toBeCloseTo(50, 6);
    expect(z.X).toBeCloseTo(0, 6);
    expect(swr(z)).toBeCloseTo(1, 5);
  });

  it('ratio 1 leaves impedance unchanged', () => {
    const z = transformImpedance({ R: 73, X: 42 }, 1);
    expect(z.R).toBeCloseTo(73, 6);
    expect(z.X).toBeCloseTo(42, 6);
  });

  it('transforms both R and X', () => {
    const z = transformImpedance({ R: 400, X: 200 }, 4);
    expect(z.R).toBeCloseTo(100, 6);
    expect(z.X).toBeCloseTo(50, 6);
  });

  it('raw SWR is unaffected by calling transformImpedance', () => {
    const original = { R: 450, X: 0 };
    const rawSwr = swr(original);
    transformImpedance(original, 9);
    // Ensure the original object is not mutated
    expect(swr(original)).toBe(rawSwr);
    expect(original.R).toBe(450);
  });

  it('invalid ratio (0) returns original impedance unchanged', () => {
    const original = { R: 100, X: 50 };
    const result = transformImpedance(original, 0);
    expect(result).toBe(original);
  });

  it('invalid ratio (negative) returns original impedance unchanged', () => {
    const original = { R: 100, X: 50 };
    const result = transformImpedance(original, -1);
    expect(result).toBe(original);
  });

  it('invalid ratio (NaN) returns original impedance unchanged', () => {
    const original = { R: 100, X: 50 };
    const result = transformImpedance(original, NaN);
    expect(result).toBe(original);
  });
});
