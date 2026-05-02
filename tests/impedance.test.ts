import { describe, expect, it } from 'vitest';
import { reflectionCoefficientMag, swr } from '../src/physics/impedance';

describe('reflection coefficient and SWR', () => {
  it('perfect match => |Γ|=0, SWR=1', () => {
    expect(reflectionCoefficientMag({ R: 50, X: 0 })).toBeCloseTo(0, 10);
    expect(swr({ R: 50, X: 0 })).toBeCloseTo(1, 10);
  });

  it('open circuit => |Γ|=1, SWR at display cap', () => {
    expect(reflectionCoefficientMag({ R: 1e15, X: 0 })).toBeCloseTo(1, 4);
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
});
