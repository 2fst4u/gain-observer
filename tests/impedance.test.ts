import { describe, expect, it } from 'vitest';
import { applyImpedanceTransformer, swr } from '../src/physics/impedance';

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

  it('applies an ideal feedpoint matching transformer to the antenna impedance', () => {
    // A 9:1 matching transformer at the antenna terminals divides the
    // antenna's feedpoint Z by 9 when looking from the radio. So a real
    // 450 Ω feedpoint looks like 50 Ω at the radio, giving 1:1 SWR
    // against a 50 Ω system.
    const transformed = applyImpedanceTransformer({ R: 450, X: 0 }, 9);
    expect(transformed.R).toBeCloseTo(50, 6);
    expect(transformed.X).toBe(0);
    expect(swr(transformed, 50)).toBeLessThan(1.01);

    // Mismatched: a 50 Ω antenna with a 9:1 transformer looks like 5.56 Ω.
    const mismatched = applyImpedanceTransformer({ R: 50, X: 0 }, 9);
    expect(mismatched.R).toBeCloseTo(50 / 9, 6);
  });
});
