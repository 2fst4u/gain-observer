// Impedance/SWR helpers.

import { Z0_SYSTEM, TRANSFORMER_INSERTION_LOSS_DB } from './constants';
import type { ImpedanceResult, SimulationResult } from './types';

/**
 * Reflection coefficient magnitude for a load Z against the system impedance.
 * |Γ| = |Z - Z0| / |Z + Z0|, where Z is complex.
 */
function reflectionCoefficientMag(z: ImpedanceResult, z0: number = Z0_SYSTEM): number {
  const numR = z.R - z0;
  const numX = z.X;
  const denR = z.R + z0;
  const denX = z.X;
  // ⚡ Bolt: Math.hypot is notoriously slow in V8 due to overflow/underflow checks.
  // We use Math.sqrt directly for a ~45x speedup since these values are safe from float limits.
  const num = Math.sqrt(numR * numR + numX * numX);
  const den = Math.sqrt(denR * denR + denX * denX);
  if (den === 0) return 1;
  return num / den;
}

/**
 * Voltage SWR against the system impedance. Clamped at 999 for display sanity.
 *
 * This calculates SWR based on the mismatch between the load impedance (z)
 * and the system impedance (z0, typically 50 Ω). This represents the
 * "source reflection" at the feedpoint.
 */
export function swr(z: ImpedanceResult, z0: number = Z0_SYSTEM): number {
  const gamma = reflectionCoefficientMag(z, z0);
  if (gamma >= 1) return 999;
  const s = (1 + gamma) / (1 - gamma);
  return Math.min(s, 999);
}

/**
 * Mismatch loss factor: fraction of available power transferred to the load.
 * = 1 − |Γ|²  (0 = total reflection, 1 = perfect match)
 *
 * Used to convert antenna gain to realized gain:
 *   G_realized(dBi) = G(dBi) + 10·log10(mismatchLossFactor)
 */
export function mismatchLossFactor(z: ImpedanceResult, z0: number = Z0_SYSTEM): number {
  const gamma = reflectionCoefficientMag(z, z0);
  return 1 - gamma * gamma;
}

/**
 * Extra loss when a feedline runs into a mismatched load: the standing wave
 * raises current/voltage maxima along the line, so the cable dissipates more
 * than its matched loss. Standard closed form (Walt Maxwell / ARRL):
 *
 *   total(dB) = 10·log10[ (a² − |Γ|²) / (a·(1 − |Γ|²)) ],   a = 10^(ML/10)
 *
 * where ML is the matched-line loss (dB) of that section and |Γ| is the
 * reflection coefficient magnitude at the load against the *line's* Z₀.
 * Reduces to ML when |Γ| → 0. |Γ| is invariant along a lossless-ish line, so
 * it may be evaluated at either end.
 */
export function feedlineLossUnderSwrDb(matchedLossDb: number, gammaMag: number): number {
  if (matchedLossDb <= 0) return 0;
  // ⚡ Bolt: Performance Optimization
  // 10^(x/10) = exp(x * ln(10)/10) is significantly faster in V8 than Math.pow(10, ...)
  const a = Math.exp((matchedLossDb / 10) * Math.LN10);
  // Clamp just shy of total reflection so the (1 − |Γ|²) denominator is finite.
  const g2 = Math.min(gammaMag * gammaMag, 0.999999);
  return 10 * Math.log10((a * a - g2) / (a * (1 - g2)));
}

/**
 * Insertion loss (dB) of an idealised antenna tuner matching a complex load Z
 * to a real system impedance, parameterised solely by the components' unloaded
 * Q — i.e. independent of the tuner topology (L/T/π).
 *
 * The tuner must transform R + jX to z₀, which forces it to circulate reactive
 * power. The minimum reactive "throughput Q" of *any* lossless matching
 * network performing that transformation is captured, model-agnostically, by
 * the geometric-mean-normalised distance of the load from the matched point:
 *
 *   Q_net = ( |R − z₀| + |X| ) / √(R · z₀)
 *
 * (zero at a perfect match; grows with both the resistance ratio and the
 * residual reactance). Feeding that through the single-section efficiency
 * bound η = Q_u / (Q_u + Q_net) gives the loss. Real T/π tuners can only
 * approach this minimum, so it is an optimistic-but-fair estimate.
 */
export function atuLossDb(z: ImpedanceResult, componentQ: number, z0: number = Z0_SYSTEM): number {
  if (componentQ <= 0 || z.R <= 0) return 0;
  const qNet = (Math.abs(z.R - z0) + Math.abs(z.X)) / Math.sqrt(z.R * z0);
  const efficiency = componentQ / (componentQ + qNet);
  return -10 * Math.log10(efficiency);
}

/**
 * Configuration for an idealised ATU sited at the base of the mast: a short
 * feedline runs up the mast to the antenna (carrying its native SWR), the
 * tuner conjugate-matches at the base, and a longer main run continues to the
 * shack at ~1:1. Both runs are assumed to be the same cable type.
 */
export interface AtuMatchConfig {
  /** The characteristic impedance of the upmast cable. */
  readonly z0: number;
  /** The matched loss (dB) of the up-mast run (feedpoint → ATU). */
  readonly upmastMatchedLossDb: number;
  /** The matched loss (dB) of the main run (ATU → shack). */
  readonly mainMatchedLossDb: number;
  /** Unloaded Q of the tuner's reactive components. */
  readonly componentQ: number;
}

/** Feedpoint metrics as actually presented to the user. */
export interface DisplayedFeedMetrics {
  /** Impedance the radio sees (after any idealised display-side transformer). */
  readonly displayedZ: ImpedanceResult;
  /** SWR vs 50 Ω matching `displayedZ`. */
  readonly displayedSwr: number;
  /**
   * Peak realized gain (dBi) the user is shown: intrinsic gain reduced by
   * feedpoint mismatch loss and any transformer insertion loss. Undefined when
   * the mismatch loss cannot be evaluated (total reflection / non-passive R).
   */
  readonly displayedRealizedGainDbi: number | undefined;
  /** Per-stage loss (dB) when a mast-base ATU is modelled; undefined otherwise. */
  readonly atuLoss?: {
    /** Up-mast feedline loss under the antenna's native SWR. */
    readonly upmastDb: number;
    /** Main feedline loss (matched, ~1:1). */
    readonly mainDb: number;
    /** Tuner insertion loss (Q-based). */
    readonly tunerDb: number;
  };
}

/**
 * Resolve the feedpoint metrics shown to the user, accounting for an impedance
 * transformer that is either modelled directly in NEC (feedline present, so
 * `result.impedance`/`maxRealizedGainDbi` already include it) or applied as an
 * idealised display-side transform (no feedline, nowhere physical to place it).
 *
 * Mismatch loss (1 − |Γ|²) and the transformer's fixed insertion loss are both
 * direction-independent scalars, so `displayedRealizedGainDbi` always differs
 * from `result.maxGainDbi` by a single constant — the exact offset the 3D
 * pattern applies to render realized gain. Centralising the rule here keeps the
 * stats readout and the pattern bubble in lock-step.
 */
export function displayedFeedMetrics(
  result: Pick<SimulationResult, 'impedance' | 'swr' | 'maxGainDbi' | 'maxRealizedGainDbi'>,
  config: {
    transformerEnabled: boolean;
    transformerRatio: number;
    feedlineActive: boolean;
    /** When present, an idealised ATU at the mast base supersedes the transformer. */
    atu?: AtuMatchConfig;
  },
): DisplayedFeedMetrics {
  const { transformerEnabled, transformerRatio, feedlineActive, atu } = config;

  if (atu) {
    // The tuner conjugate-matches whatever impedance reaches the mast base, so
    // the rig sees 50 Ω at 1:1 and mismatch loss → 0. `result.impedance` is the
    // impedance at the foot of the (lossless-in-NEC) up-mast feedline — exactly
    // where the tuner sits — so it is both the load the tuner matches and the
    // point whose |Γ| sets the up-mast standing-wave loss. What remains:
    //   • up-mast feedline loss under the antenna's native SWR,
    //   • main feedline loss (matched, ~1:1),
    //   • the tuner's own Q-based loss.
    const z = result.impedance;
    const gammaUpmast = atu.z0 > 0 ? reflectionCoefficientMag(z, atu.z0) : 0;
    const upmastDb = feedlineLossUnderSwrDb(atu.upmastMatchedLossDb, gammaUpmast);
    const mainDb = atu.mainMatchedLossDb;
    const tunerDb = atuLossDb(z, atu.componentQ);
    return {
      displayedZ: { R: Z0_SYSTEM, X: 0 },
      displayedSwr: 1,
      // A non-passive feedpoint (R ≤ 0) can't be matched — leave realized gain
      // undefined so the readout hides it, consistent with the other branches.
      displayedRealizedGainDbi:
        z.R > 0 ? result.maxGainDbi - upmastDb - mainDb - tunerDb : undefined,
      atuLoss: { upmastDb, mainDb, tunerDb },
    };
  }

  const transformerInDisplay = transformerEnabled && !feedlineActive && transformerRatio > 1;

  const displayedZ: ImpedanceResult = transformerInDisplay
    ? { R: result.impedance.R / transformerRatio, X: result.impedance.X / transformerRatio }
    : result.impedance;
  const displayedSwr = transformerInDisplay ? swr(displayedZ) : result.swr;

  let displayedRealizedGainDbi: number | undefined;
  if (transformerInDisplay) {
    // Phantom transformer: NEC never saw it, so derive realized gain from the
    // intrinsic gain and the mismatch against the transformed (radio-side) Z.
    const mlf = mismatchLossFactor(displayedZ);
    if (mlf > 0) {
      displayedRealizedGainDbi =
        result.maxGainDbi + 10 * Math.log10(mlf) - TRANSFORMER_INSERTION_LOSS_DB;
    }
  } else if (transformerEnabled) {
    // Transformer (or choke-only, ratio 1) modelled in NEC: its realized gain
    // already reflects the matched feedpoint; just deduct the hardware loss.
    displayedRealizedGainDbi = result.maxRealizedGainDbi != null
      ? result.maxRealizedGainDbi - TRANSFORMER_INSERTION_LOSS_DB
      : undefined;
  } else {
    displayedRealizedGainDbi = result.maxRealizedGainDbi ?? undefined;
  }

  return { displayedZ, displayedSwr, displayedRealizedGainDbi };
}

/**
 * Forward propagation through a lossless transmission line: given the load
 * (far-end) impedance, returns the input (near-end) impedance seen looking
 * into a line of characteristic impedance `z0Line` and electrical length
 * `lengthLambdas` (cable length / cable wavelength).
 *
 *   Z_in = Z0 · (Z_load + j·Z0·tan(βd)) / (Z0 + j·Z_load·tan(βd))
 */
export function transformThroughLine(
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
  // numerator = Z_load + j·Z0·t = zLoad.R + j·(zLoad.X + Z0·t)
  const numR = zLoad.R;
  const numI = zLoad.X + z0Line * t;
  // denominator = Z0 + j·Z_load·t = (Z0 − zLoad.X·t) + j·(zLoad.R·t)
  const denR = z0Line - zLoad.X * t;
  const denI = zLoad.R * t;
  const denMag2 = denR * denR + denI * denI;
  if (denMag2 === 0) return zLoad;
  return {
    R: (z0Line * (numR * denR + numI * denI)) / denMag2,
    X: (z0Line * (numI * denR - numR * denI)) / denMag2,
  };
}

/**
 * De-embeds an impedance reading taken at the source end of a lossless
 * transmission line: given Z measured at the source, returns the load-side
 * impedance at the far end of the line.
 *
 *   Z_load = Z0 · (Z_src − j·Z0·tan(βd)) / (Z0 − j·Z_src·tan(βd))
 *
 * `lengthLambdas` is the electrical length of the line (physical length
 * divided by the cable's in-line wavelength, i.e. `length / (vf · λ_air)`).
 *
 * NEC's TL card is lossless; the matching inverse-transform here is also
 * lossless, so for the differential signal this is exact. It does NOT
 * account for any common-mode current on the cable shield (modelled as a
 * separate wire in NEC), so for antennas with significant shield current
 * the de-embedded value is an estimate of the antenna terminals only.
 */
export function deembedThroughLine(
  zSrc: ImpedanceResult,
  z0Line: number,
  lengthLambdas: number,
): ImpedanceResult {
  if (!Number.isFinite(lengthLambdas) || !Number.isFinite(z0Line) || z0Line <= 0) {
    return zSrc;
  }
  const betaL = 2 * Math.PI * lengthLambdas;
  const t = Math.tan(betaL);
  if (!Number.isFinite(t)) {
    // tan diverges at ¼-wavelength multiples; in the limit Z_load = Z0² / Z_src.
    const denMag2 = zSrc.R * zSrc.R + zSrc.X * zSrc.X;
    if (denMag2 === 0) return zSrc;
    return {
      R: (z0Line * z0Line * zSrc.R) / denMag2,
      X: -(z0Line * z0Line * zSrc.X) / denMag2,
    };
  }
  // numerator = Z_src − j·Z0·t = zSrc.R + j·(zSrc.X − Z0·t)
  const numR = zSrc.R;
  const numI = zSrc.X - z0Line * t;
  // denominator = Z0 − j·Z_src·t = (Z0 + zSrc.X·t) + j·(−zSrc.R·t)
  const denR = z0Line + zSrc.X * t;
  const denI = -zSrc.R * t;
  const denMag2 = denR * denR + denI * denI;
  if (denMag2 === 0) return zSrc;
  // Z0 · (num / den), complex division.
  return {
    R: (z0Line * (numR * denR + numI * denI)) / denMag2,
    X: (z0Line * (numI * denR - numR * denI)) / denMag2,
  };
}

/**
 * Suggest the impedance-transformer ratio that best matches the antenna
 * feedpoint — independent of the current ratio, so applying it does not
 * oscillate.
 *
 * The NEC source impedance means different things by configuration:
 *   • no feedline (`z0Line <= 0`) → it IS the antenna feedpoint; the optimal
 *     ratio brings it to the 50 Ω system impedance: round(R / 50).
 *   • feedline present → it's the rig-end impedance (the coax, with any
 *     in-model NT transformer, sits between the rig and the antenna). De-embed
 *     the line to recover the antenna terminals, then undo the NT transformer
 *     (in the model only when ratio > 1) to get the raw feedpoint R. The
 *     optimal ratio matches that to the line's own characteristic impedance,
 *     flattening the line: round(R / z0Line).
 *
 * NOTE: with a feedline present this is only *approximately* stable — it has to
 * back the antenna feedpoint out of the rig-end reading, which (because the
 * source sits on the radiating shield) is contaminated by common-mode current
 * that does not divide by the ratio, so applying the suggestion and re-solving
 * can drift the value. Prefer `matchRatioForFeedpoint` against a bare-antenna
 * feedpoint (solved with the transformer/feedline stripped) when one is
 * available; this de-embed form is retained for the no-feedline case and as a
 * fallback.
 *
 * Returns an integer ≥ 1.
 */
export function suggestedTransformerRatio(
  zSrcReportedByNec: ImpedanceResult,
  currentRatio: number,
  z0Line: number = 0,
  lineLengthLambdas: number = 0,
): number {
  let antennaR: number;
  let target: number;
  if (!Number.isFinite(z0Line) || z0Line <= 0) {
    antennaR = zSrcReportedByNec.R;
    target = Z0_SYSTEM;
  } else {
    const zLoad = deembedThroughLine(zSrcReportedByNec, z0Line, lineLengthLambdas);
    antennaR = currentRatio > 1 ? zLoad.R * currentRatio : zLoad.R;
    target = z0Line;
  }
  return matchRatioForFeedpoint(antennaR, target);
}

/**
 * Integer impedance-transformer ratio that best matches a real feedpoint
 * resistance to a target impedance: round(R / target), clamped to ≥ 1.
 *
 * Fed a *transformer-independent* antenna feedpoint R (and the target = the
 * feedline's characteristic impedance, or 50 Ω with no feedline), this yields a
 * single stable suggestion that does not move when the suggestion is applied —
 * because the bare feedpoint does not depend on the fitted transformer at all.
 */
export function matchRatioForFeedpoint(antennaR: number, target: number): number {
  if (!Number.isFinite(antennaR) || antennaR <= 0 || target <= 0) return 1;
  return Math.max(1, Math.round(antennaR / target));
}
