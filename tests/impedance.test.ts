import { vi } from "vitest";
import { describe, expect, it } from 'vitest';
import { swr, mismatchLossFactor, deembedThroughLine, suggestedTransformerRatio, matchRatioForFeedpoint, displayedFeedMetrics, atuLossDb, feedlineLossUnderSwrDb } from '../src/physics/impedance';
import { TRANSFORMER_INSERTION_LOSS_DB, ATU_COMPONENT_Q, feedlineLossDb, findFeedlinePreset } from '../src/physics/constants';
import type { SimulationResult, ImpedanceResult } from '../src/physics/types';

/** Helper function moved from src/physics/impedance.ts for testing purposes */
function transformThroughLine(
  zLoad: ImpedanceResult,
  z0Line: number,
  lengthLambdas: number,
): ImpedanceResult {
  if (!Number.isFinite(lengthLambdas) || !Number.isFinite(z0Line) || z0Line <= 0) {
    return zLoad;
  }
  const betaL = 2 * Math.PI * lengthLambdas;
  const t = Math.tan(betaL);
  if (!Number.isFinite(t)) {
    const denMag2 = zLoad.R * zLoad.R + zLoad.X * zLoad.X;
    if (denMag2 === 0) return zLoad;
    return {
      R: (z0Line * z0Line * zLoad.R) / denMag2,
      X: -(z0Line * z0Line * zLoad.X) / denMag2,
    };
  }
  const numR = zLoad.R;
  const numI = zLoad.X + z0Line * t;
  const denR = z0Line - zLoad.X * t;
  const denI = zLoad.R * t;
  const denMag2 = denR * denR + denI * denI;
  if (denMag2 === 0) return zLoad;
  return {
    R: (z0Line * (numR * denR + numI * denI)) / denMag2,
    X: (z0Line * (numI * denR - numR * denI)) / denMag2,
  };
}


// Minimal result stub carrying only the fields displayedFeedMetrics reads.
function stubResult(over: Partial<Pick<SimulationResult, 'impedance' | 'swr' | 'maxGainDbi' | 'maxRealizedGainDbi'>>) {
  const impedance = over.impedance ?? { R: 50, X: 0 };
  return {
    impedance,
    swr: over.swr ?? swr(impedance),
    maxGainDbi: over.maxGainDbi ?? 0,
    maxRealizedGainDbi:
      'maxRealizedGainDbi' in over
        ? over.maxRealizedGainDbi
        : (over.maxGainDbi ?? 0) + 10 * Math.log10(mismatchLossFactor(impedance)),
  } as Pick<SimulationResult, 'impedance' | 'swr' | 'maxGainDbi' | 'maxRealizedGainDbi'>;
}

describe('displayedFeedMetrics', () => {
  const noTransformer = { transformerEnabled: false, transformerRatio: 1, feedlineActive: false };

  it('no transformer: realized gain equals NEC realized gain; offset = 10·log10(1−|Γ|²)', () => {

    const result = stubResult({ impedance: { R: 1.7, X: 50.9 }, maxGainDbi: 9.03 });
    const m = displayedFeedMetrics(result, noTransformer);

    // Bubble offset the scene applies = realizedGain − gain.
    const offset = m.displayedRealizedGainDbi! - result.maxGainDbi;
    expect(offset).toBeCloseTo(10 * Math.log10(mismatchLossFactor(result.impedance)), 10);
    // Sanity: lands near the readout's ~ −2.9 dBi (rounded inputs, so a loose
    // bound) and the displayed Z is left untouched.
    expect(m.displayedRealizedGainDbi!).toBeGreaterThan(-3.1);
    expect(m.displayedRealizedGainDbi!).toBeLessThan(-2.7);
    expect(m.displayedZ).toEqual(result.impedance);
    expect(m.displayedSwr).toBe(result.swr);
  });

  it('perfect match: offset is 0 (bubble equals raw gain pattern)', () => {
    const result = stubResult({ impedance: { R: 50, X: 0 }, maxGainDbi: 2.15 });
    const m = displayedFeedMetrics(result, noTransformer);
    expect(m.displayedRealizedGainDbi! - result.maxGainDbi).toBeCloseTo(0, 10);
  });

  it('phantom transformer (no feedline): divides Z by ratio and deducts insertion loss', () => {
    const result = stubResult({ impedance: { R: 450, X: 0 }, maxGainDbi: 5 });
    const m = displayedFeedMetrics(result, { transformerEnabled: true, transformerRatio: 9, feedlineActive: false });

    const expectedZ = { R: 50, X: 0 };
    expect(m.displayedZ).toEqual(expectedZ);
    expect(m.displayedSwr).toBeCloseTo(1, 6); // 450/9 = 50 → matched
    expect(m.displayedRealizedGainDbi!).toBeCloseTo(
      5 + 10 * Math.log10(mismatchLossFactor(expectedZ)) - TRANSFORMER_INSERTION_LOSS_DB,
      10,
    );
  });

  it('transformer modelled in NEC (feedline active): NEC realized gain minus insertion loss', () => {
    const result = stubResult({ impedance: { R: 50, X: 0 }, maxGainDbi: 5, maxRealizedGainDbi: 4.6 });
    const m = displayedFeedMetrics(result, { transformerEnabled: true, transformerRatio: 9, feedlineActive: true });
    // Z/SWR are taken as-is (NEC already includes the transformer).
    expect(m.displayedZ).toEqual(result.impedance);
    expect(m.displayedRealizedGainDbi!).toBeCloseTo(4.6 - TRANSFORMER_INSERTION_LOSS_DB, 10);
  });

  it('choke-only (ratio 1): NEC realized gain minus insertion loss', () => {
    const result = stubResult({ impedance: { R: 73, X: 0 }, maxGainDbi: 2.15, maxRealizedGainDbi: 2.0 });
    const m = displayedFeedMetrics(result, { transformerEnabled: true, transformerRatio: 1, feedlineActive: true });
    expect(m.displayedRealizedGainDbi!).toBeCloseTo(2.0 - TRANSFORMER_INSERTION_LOSS_DB, 10);
  });

  it('undefined NEC realized gain leaves displayed realized gain undefined', () => {
    const result = stubResult({ impedance: { R: 50, X: 0 }, maxGainDbi: 3, maxRealizedGainDbi: undefined });
    const m = displayedFeedMetrics(result, noTransformer);
    expect(m.displayedRealizedGainDbi).toBeUndefined();
  });
});

describe('feedlineLossUnderSwrDb', () => {
  it('zero matched loss → zero total loss', () => {
    expect(feedlineLossUnderSwrDb(0, 0.9)).toBe(0);
  });

  it('matched (|Γ|=0) → equals the matched loss', () => {
    expect(feedlineLossUnderSwrDb(1, 0)).toBeCloseTo(1, 10);
  });

  it('standing wave inflates loss above the matched value', () => {
    expect(feedlineLossUnderSwrDb(1, 0.5)).toBeGreaterThan(1);
    // 10·log10[(a²−|Γ|²)/(a(1−|Γ|²))], a=10^0.1, |Γ|²=0.25 ⇒ ≈1.50 dB
    expect(feedlineLossUnderSwrDb(1, 0.5)).toBeCloseTo(1.50, 1);
  });

  it('total reflection stays finite (clamped)', () => {
    expect(Number.isFinite(feedlineLossUnderSwrDb(0.5, 1))).toBe(true);
  });
});

describe('atuLossDb', () => {
  it('perfect match → no loss', () => {
    expect(atuLossDb({ R: 50, X: 0 }, 150)).toBeCloseTo(0, 10);
  });

  it('non-passive R or non-positive Q → no loss', () => {
    expect(atuLossDb({ R: -5, X: 0 }, 150)).toBe(0);
    expect(atuLossDb({ R: 50, X: 0 }, 0)).toBe(0);
  });

  it('folded-dipole 300 Ω is a gentle match (~0.06 dB at Q=150)', () => {
    // Q_net = 250/√(300·50) = 2.041 ⇒ loss = -10log10(150/152.04) ≈ 0.059 dB
    expect(atuLossDb({ R: 300, X: 0 }, 150)).toBeCloseTo(0.06, 2);
  });

  it('heavy reactance costs more loss', () => {
    expect(atuLossDb({ R: 50, X: 500 }, 150)).toBeGreaterThan(atuLossDb({ R: 300, X: 0 }, 150));
  });

  it('higher component Q → lower loss', () => {
    const nasty = { R: 5, X: 80 };
    expect(atuLossDb(nasty, 250)).toBeLessThan(atuLossDb(nasty, 80));
  });
});

describe('displayedFeedMetrics — mast-base ATU', () => {
  const preset = findFeedlinePreset('rg213');
  const atu = {
    z0: preset.z0,
    upmastMatchedLossDb: feedlineLossDb(preset, 14.2, 6),
    mainMatchedLossDb: feedlineLossDb(preset, 14.2, 50),
    componentQ: ATU_COMPONENT_Q,
  };

  it('presents 50 Ω at 1:1 and subtracts feedline + tuner losses from gain', () => {
    const result = stubResult({ impedance: { R: 18, X: -40 }, maxGainDbi: 6 });
    const m = displayedFeedMetrics(result, {
      transformerEnabled: false, transformerRatio: 1, feedlineActive: true, atu,
    });

    expect(m.displayedZ).toEqual({ R: 50, X: 0 });
    expect(m.displayedSwr).toBe(1);
    expect(m.atuLoss).toBeDefined();

    // Cross-check each stage against the standalone loss functions.
    const matchedUp = feedlineLossDb(preset, 14.2, 6);
    const gamma = Math.hypot(18 - preset.z0, -40) / Math.hypot(18 + preset.z0, -40);
    expect(m.atuLoss!.upmastDb).toBeCloseTo(feedlineLossUnderSwrDb(matchedUp, gamma), 10);
    expect(m.atuLoss!.mainDb).toBeCloseTo(feedlineLossDb(preset, 14.2, 50), 10);
    expect(m.atuLoss!.tunerDb).toBeCloseTo(atuLossDb({ R: 18, X: -40 }, ATU_COMPONENT_Q), 10);

    const total = m.atuLoss!.upmastDb + m.atuLoss!.mainDb + m.atuLoss!.tunerDb;
    expect(m.displayedRealizedGainDbi!).toBeCloseTo(6 - total, 10);
  });

  it('the ATU supersedes a transformer when both are set', () => {
    const result = stubResult({ impedance: { R: 300, X: 0 }, maxGainDbi: 2 });
    const m = displayedFeedMetrics(result, {
      transformerEnabled: true, transformerRatio: 9, feedlineActive: true, atu,
    });
    expect(m.displayedZ).toEqual({ R: 50, X: 0 });
  });

  it('a non-passive feedpoint leaves realized gain undefined but still reports losses', () => {
    const result = stubResult({ impedance: { R: -3, X: 20 }, maxGainDbi: 4 });
    const m = displayedFeedMetrics(result, {
      transformerEnabled: false, transformerRatio: 1, feedlineActive: true, atu,
    });
    expect(m.displayedRealizedGainDbi).toBeUndefined();
    expect(m.atuLoss).toBeDefined();
  });
});

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

describe('matchRatioForFeedpoint', () => {
  it('rounds R/target to the nearest integer ratio', () => {
    expect(matchRatioForFeedpoint(73, 50)).toBe(1);   // dipole → 50 Ω
    expect(matchRatioForFeedpoint(300, 50)).toBe(6);  // folded dipole → 50 Ω
    expect(matchRatioForFeedpoint(450, 50)).toBe(9);
    expect(matchRatioForFeedpoint(300, 450)).toBe(1); // 300 Ω feedpoint → 450 Ω line
  });

  it('is independent of any fitted transformer (the value never moves once applied)', () => {
    // The bare feedpoint R is the same no matter which ratio is currently fitted,
    // so re-evaluating after applying the suggestion yields the same number —
    // this is what stops the 6 → 9 → 13 runaway.
    const ra = 300; // bare antenna feedpoint, transformer-independent
    const r1 = matchRatioForFeedpoint(ra, 50);
    const r2 = matchRatioForFeedpoint(ra, 50); // "after applying r1 and re-solving"
    expect(r1).toBe(6);
    expect(r2).toBe(6);
  });

  it('clamps to ≥ 1 and guards degenerate inputs', () => {
    expect(matchRatioForFeedpoint(10, 50)).toBe(1);  // round(0.2) → 1
    expect(matchRatioForFeedpoint(0, 50)).toBe(1);
    expect(matchRatioForFeedpoint(-5, 50)).toBe(1);
    expect(matchRatioForFeedpoint(300, 0)).toBe(1);
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
