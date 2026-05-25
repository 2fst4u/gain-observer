import { vi } from "vitest";
import { describe, expect, it } from 'vitest';
import { swr, mismatchLossFactor, transformImpedance, deembedThroughLine, transformThroughLine, transformWithTransformerAtAntenna, realizedGainWithTransformer, suggestedTransformerRatio } from '../src/physics/impedance';

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

describe('deembedThroughLine', () => {
  it('zero-length line returns input unchanged', () => {
    const z = { R: 73, X: 42 };
    const result = deembedThroughLine(z, 50, 0);
    expect(result.R).toBeCloseTo(73, 9);
    expect(result.X).toBeCloseTo(42, 9);
  });

  it('half-wavelength line is identity', () => {
    const z = { R: 200, X: -150 };
    const result = deembedThroughLine(z, 50, 0.5);
    expect(result.R).toBeCloseTo(200, 6);
    expect(result.X).toBeCloseTo(-150, 6);
  });

  it('quarter-wave inverts: 25 Ω → 100 Ω with Z0=50', () => {
    const result = deembedThroughLine({ R: 25, X: 0 }, 50, 0.25);
    expect(result.R).toBeCloseTo(100, 6);
    expect(result.X).toBeCloseTo(0, 6);
  });

  it('quarter-wave inverts: 100 Ω → 25 Ω with Z0=50', () => {
    const result = deembedThroughLine({ R: 100, X: 0 }, 50, 0.25);
    expect(result.R).toBeCloseTo(25, 6);
    expect(result.X).toBeCloseTo(0, 6);
  });

  it('matched load is invariant on any line length', () => {
    for (const lambdas of [0.1, 0.25, 0.5, 0.916, 1.7]) {
      const result = deembedThroughLine({ R: 50, X: 0 }, 50, lambdas);
      expect(result.R).toBeCloseTo(50, 6);
      expect(result.X).toBeCloseTo(0, 6);
    }
  });

  it('|Γ| is preserved along a lossless line (SWR conservation)', () => {
    const zSource = { R: 9.7, X: 94.5 };
    const zLoad = deembedThroughLine(zSource, 50, 0.916);
    // SWR at both ends of a lossless line must match.
    expect(swr(zLoad)).toBeCloseTo(swr(zSource), 4);
  });

  it('invalid z0 returns input unchanged', () => {
    const original = { R: 100, X: 50 };
    expect(deembedThroughLine(original, 0, 0.5)).toBe(original);
    expect(deembedThroughLine(original, -50, 0.5)).toBe(original);
  });

  it('non-finite length returns input unchanged', () => {
    const original = { R: 100, X: 50 };
    expect(deembedThroughLine(original, 50, NaN)).toBe(original);
    expect(deembedThroughLine(original, 50, Infinity)).toBe(original);
  });
});

describe('transformThroughLine', () => {
  it('zero-length line returns input unchanged', () => {
    const zLoad = { R: 73, X: 42 };
    const result = transformThroughLine(zLoad, 50, 0);
    expect(result.R).toBeCloseTo(73, 9);
    expect(result.X).toBeCloseTo(42, 9);
  });

  it('half-wavelength line is identity', () => {
    const zLoad = { R: 200, X: -150 };
    const result = transformThroughLine(zLoad, 50, 0.5);
    expect(result.R).toBeCloseTo(200, 6);
    expect(result.X).toBeCloseTo(-150, 6);
  });

  it('quarter-wave inverts: 25 Ω → 100 Ω with Z0=50', () => {
    const result = transformThroughLine({ R: 25, X: 0 }, 50, 0.25);
    expect(result.R).toBeCloseTo(100, 6);
    expect(result.X).toBeCloseTo(0, 6);
  });

  it('quarter-wave inverts: 100 Ω → 25 Ω with Z0=50', () => {
    const result = transformThroughLine({ R: 100, X: 0 }, 50, 0.25);
    expect(result.R).toBeCloseTo(25, 6);
    expect(result.X).toBeCloseTo(0, 6);
  });

  it('matched load is invariant on any line length', () => {
    for (const lambdas of [0.1, 0.25, 0.5, 0.916, 1.7]) {
      const result = transformThroughLine({ R: 50, X: 0 }, 50, lambdas);
      expect(result.R).toBeCloseTo(50, 6);
      expect(result.X).toBeCloseTo(0, 6);
    }
  });

  it('|Γ| is preserved along a lossless line (SWR conservation)', () => {
    const zLoad = { R: 9.7, X: 94.5 };
    const zIn = transformThroughLine(zLoad, 50, 0.916);
    expect(swr(zIn)).toBeCloseTo(swr(zLoad), 4);
  });

  it('invalid z0 returns input unchanged', () => {
    const original = { R: 100, X: 50 };
    expect(transformThroughLine(original, 0, 0.5)).toBe(original);
    expect(transformThroughLine(original, -50, 0.5)).toBe(original);
  });

  it('non-finite length returns input unchanged', () => {
    const original = { R: 100, X: 50 };
    expect(transformThroughLine(original, 50, NaN)).toBe(original);
    expect(transformThroughLine(original, 50, Infinity)).toBe(original);
  });
});

describe('transformWithTransformerAtAntenna', () => {
  it('returns original if ratio is invalid', () => {
    const original = { R: 100, X: 50 };
    expect(transformWithTransformerAtAntenna(original, 0)).toBe(original);
    expect(transformWithTransformerAtAntenna(original, -1)).toBe(original);
    expect(transformWithTransformerAtAntenna(original, NaN)).toBe(original);
  });

  it('handles zero-length line (or undefined line length)', () => {
    const zSrc = { R: 400, X: 200 };
    const result1 = transformWithTransformerAtAntenna(zSrc, 4, 50, 0);
    expect(result1.R).toBeCloseTo(100, 6);
    expect(result1.X).toBeCloseTo(50, 6);

    const result2 = transformWithTransformerAtAntenna(zSrc, 4, 50, NaN);
    expect(result2.R).toBeCloseTo(100, 6);
    expect(result2.X).toBeCloseTo(50, 6);
  });

  it('transforms properly with line length present', () => {
    const zSrc = { R: 25, X: 0 };
    const result = transformWithTransformerAtAntenna(zSrc, 4, 50, 0.25);
    expect(result.R).toBeCloseTo(100, 6);
    expect(result.X).toBeCloseTo(0, 6);
  });
});

describe('realizedGainWithTransformer', () => {
  it('computes expected realized gain', () => {
    const zSrc = { R: 50, X: 0 };
    const result = realizedGainWithTransformer(2.15, zSrc, 1, 50, 0);
    expect(result).toBeDefined();
    expect(typeof result).toBe('number');
  });

  it('returns undefined if mismatch loss factor is <= 0', () => {
    const result = realizedGainWithTransformer(2.15, { R: 0, X: 0 }, 1, 50, 0);
    expect(result).toBeUndefined();
  });
});

describe('suggestedTransformerRatio', () => {
  it('no feedline: matches the raw feedpoint to 50 Ω', () => {
    expect(suggestedTransformerRatio({ R: 73, X: 0 }, 1)).toBe(1);   // dipole
    expect(suggestedTransformerRatio({ R: 300, X: 0 }, 1)).toBe(6);  // folded dipole
    expect(suggestedTransformerRatio({ R: 900, X: 0 }, 6)).toBe(18); // TFD; ignores current ratio
  });

  it('is stable: the suggestion does not depend on the current ratio (no feedline)', () => {
    const z = { R: 300, X: 40 };
    const a = suggestedTransformerRatio(z, 1);
    const b = suggestedTransformerRatio(z, 6);
    const c = suggestedTransformerRatio(z, 50);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('feedline + NT card: de-embeds the line and undoes the ratio to recover the feedpoint', () => {
    // Antenna feedpoint 900 Ω, matched by a 6:1 NT card to 150 Ω, then carried
    // by 0.3λ of 50 Ω coax to the rig. The rig-end reading is what NEC reports.
    const z0 = 50;
    const lambdas = 0.3;
    const ratio = 6;
    const zSecondary = { R: 900 / ratio, X: 0 };           // NT secondary = 150 Ω
    const rigEnd = transformThroughLine(zSecondary, z0, lambdas);
    // Should recover ~900 Ω feedpoint → round(900/50) = 18.
    expect(suggestedTransformerRatio(rigEnd, ratio, z0, lambdas)).toBe(18);
  });

  it('feedline: applying the suggestion is self-consistent (no oscillation)', () => {
    const z0 = 50;
    const lambdas = 0.3;
    // Start mismatched at 6:1, recover the suggestion (18:1)...
    const first = transformThroughLine({ R: 900 / 6, X: 0 }, z0, lambdas);
    const suggested = suggestedTransformerRatio(first, 6, z0, lambdas);
    expect(suggested).toBe(18);
    // ...now the antenna is matched by 18:1 → 50 Ω secondary, flat line.
    const second = transformThroughLine({ R: 900 / suggested, X: 0 }, z0, lambdas);
    // Re-running Match yields the same ratio rather than chasing its tail.
    expect(suggestedTransformerRatio(second, suggested, z0, lambdas)).toBe(18);
  });

  it('clamps to ≥ 1 and guards degenerate impedances', () => {
    expect(suggestedTransformerRatio({ R: 10, X: 0 }, 1)).toBe(1); // round(0.2) → 1
    expect(suggestedTransformerRatio({ R: 0, X: 0 }, 1)).toBe(1);
    expect(suggestedTransformerRatio({ R: -5, X: 0 }, 1)).toBe(1);
  });
});

describe('transformThroughLine edge cases', () => {
  it('handles denMag2 === 0 when t is non-finite', () => {
    // This happens when tan diverges (e.g. at a quarter wavelength)
    // We can simulate this by mocking Math.tan or by creating a huge number.
    // However, JS Math.tan doesn't usually return Infinity.
    // We can directly mock it:
    const tanSpy = vi.spyOn(Math, 'tan').mockReturnValue(Infinity);
    const zLoad = { R: 0, X: 0 };
    const result = transformThroughLine(zLoad, 50, 0.25);
    expect(result).toBe(zLoad);

    const zLoad2 = { R: 10, X: 0 };
    const result2 = transformThroughLine(zLoad2, 50, 0.25);
    expect(result2.R).toBe((50 * 50 * 10) / (10 * 10));
    expect(result2.X).toBe(-0); // (-50*50*0)/(10*10)

    tanSpy.mockRestore();
  });
});

describe('deembedThroughLine edge cases', () => {
  it('handles denMag2 === 0 when t is non-finite', () => {
    const tanSpy = vi.spyOn(Math, 'tan').mockReturnValue(Infinity);
    const zSrc = { R: 0, X: 0 };
    const result = deembedThroughLine(zSrc, 50, 0.25);
    expect(result).toBe(zSrc);

    const zSrc2 = { R: 10, X: 0 };
    const result2 = deembedThroughLine(zSrc2, 50, 0.25);
    expect(result2.R).toBe((50 * 50 * 10) / (10 * 10));
    expect(result2.X).toBe(-0);

    tanSpy.mockRestore();
  });
});


describe('transformThroughLine edge cases 2', () => {
  it('handles denMag2 === 0 when t is finite', () => {
    // If denMag2 is 0, then denR^2 + denI^2 = 0, meaning both are 0.
    // denR = z0Line - zLoad.X * t = 0 -> z0Line = zLoad.X * t
    // denI = zLoad.R * t = 0
    // To make denI = 0 without t=0, we need zLoad.R = 0
    // So zLoad.R = 0.
    // Let t = 1 (from betaL = pi/4 => lengthLambdas = 0.125)
    // Then z0Line = zLoad.X * 1 -> zLoad.X = 50.
    // Since JavaScript uses floating point, denMag2 might be slightly non-zero but we can mock it

    // Instead of mocking the exact precision, we can mock Math.tan to return a specific value
    // No, we can just use the values since 0 * 1 = 0 exactly.
    // And 50 - 50 * 1 = 0 exactly.
    // Let's set Math.tan(betaL) = 1 EXACTLY.
    // 2 * Math.PI * 0.125 = Math.PI / 4
    // Math.tan(Math.PI / 4) = 0.9999999999999999.

    // So we spy on Math.tan
    const tanSpy = vi.spyOn(Math, 'tan').mockReturnValue(1);

    const zLoad = { R: 0, X: 50 };
    const result = transformThroughLine(zLoad, 50, 0.125);
    expect(result).toBe(zLoad);

    tanSpy.mockRestore();
  });
});

describe('deembedThroughLine edge cases 2', () => {
  it('handles denMag2 === 0 when t is finite', () => {
    // For deembed:
    // denR = z0Line + zSrc.X * t = 0
    // denI = -zSrc.R * t = 0
    const tanSpy = vi.spyOn(Math, 'tan').mockReturnValue(1);

    const zSrc = { R: 0, X: -50 };
    const result = deembedThroughLine(zSrc, 50, 0.125);
    expect(result).toBe(zSrc);

    tanSpy.mockRestore();
  });
});

describe('transformThroughLine edge cases 3', () => {
  it('handles transformThroughLine NaN propagation', () => {
    // Force Math.tan to return NaN
    const tanSpy = vi.spyOn(Math, 'tan').mockReturnValue(NaN);

    // According to Number.isFinite(NaN) -> false
    // So it will trigger the if (!Number.isFinite(t)) block
    const zLoad = { R: 0, X: 0 }; // denMag2 will be 0
    const result = transformThroughLine(zLoad, 50, 0.125);
    expect(result).toBe(zLoad);

    tanSpy.mockRestore();
  });
});

describe('deembedThroughLine edge cases 3', () => {
  it('handles deembedThroughLine NaN propagation', () => {
    // Force Math.tan to return NaN
    const tanSpy = vi.spyOn(Math, 'tan').mockReturnValue(NaN);

    // According to Number.isFinite(NaN) -> false
    // So it will trigger the if (!Number.isFinite(t)) block
    const zSrc = { R: 0, X: 0 }; // denMag2 will be 0
    const result = deembedThroughLine(zSrc, 50, 0.125);
    expect(result).toBe(zSrc);

    tanSpy.mockRestore();
  });
});
