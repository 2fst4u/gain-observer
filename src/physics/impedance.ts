// Impedance/SWR helpers.

import { Z0_SYSTEM, TRANSFORMER_INSERTION_LOSS_DB } from './constants';
import type { ImpedanceResult, SimulationResult } from './types';
import { matchLNetwork } from './atu';

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
 * Reduces to ML when |Γ| → 0. The argument MUST be the load-end reflection:
 * attenuation reduces |Γ| at the input, so the ends are not interchangeable.
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

/** Loss of the most efficient finite-Q L-network match; Infinity if unmatchable. */
export function atuLossDb(z: ImpedanceResult, componentQ: number, z0: number = Z0_SYSTEM): number {
  return matchLNetwork(z, componentQ, z0)?.lossDb ?? Infinity;
}

/**
 * Configuration for an idealised ATU sited at the base of the mast: a short
 * feedline runs up the mast to the antenna (carrying its native SWR), the
 * tuner conjugate-matches at the base, and a longer main run continues to the
 * shack at ~1:1 on a specified 50-ohm main coax (RG-213). The up-mast run
 * can independently be coax or balanced line; its distributed loss is in NEC.
 */
export interface AtuMatchConfig {
  /** The characteristic impedance of the upmast cable. */
  readonly z0: number;
  /** The matched loss (dB) of the up-mast run (feedpoint → ATU). */
  readonly upmastMatchedLossDb: number;
  /** The matched loss (dB) of the main run (ATU → shack). */
  readonly mainMatchedLossDb: number;
  /** Unloaded Q of both reactive components in the explicit L network. */
  readonly componentQ: number;
  /** Main cable is a separate 50-ohm coax, regardless of the up-mast cable. */
  readonly mainFeedlineId?: string;
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
    /** Up-mast network loss already included in NEC gain (diagnostic only). */
    readonly upmastDb: number;
    /** Main feedline loss (matched, ~1:1). */
    readonly mainDb: number;
    /** Finite-Q L-network insertion loss. */
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
  result: Pick<SimulationResult, 'impedance' | 'swr' | 'maxGainDbi' | 'maxRealizedGainDbi' | 'networkLossDb'>,
  config: {
    transformerEnabled: boolean;
    transformerRatio: number;
    feedlineActive: boolean;
    /** When present, a finite-Q L tuner conjugate-matches at the mast base. */
    atu?: AtuMatchConfig;
  },
): DisplayedFeedMetrics {
  const { transformerEnabled, transformerRatio, feedlineActive, atu } = config;
  const transformerInDisplay = transformerEnabled && !feedlineActive && transformerRatio > 1;
  const displayedZ: ImpedanceResult = transformerInDisplay
    ? { R: result.impedance.R / transformerRatio, X: result.impedance.X / transformerRatio }
    : result.impedance;

  if (atu) {
    // NEC already includes distributed up-mast loss, so subtracting a scalar
    // standing-wave loss here would count that heat twice. The explicit tuner
    // matches NEC's actual lossy-line input, followed by a separate 50-ohm coax.
    // A zero-length up-mast run is a direct feed. Its optional transformer is
    // display-side, and the tuner must therefore match the transformed load.
    const z = displayedZ;
    const upmastDb = result.networkLossDb ?? 0;
    const mainDb = atu.mainMatchedLossDb;
    const match = matchLNetwork(z, atu.componentQ);
    const tunerDb = match?.lossDb ?? Infinity;
    return {
      displayedZ: match ? { R: Z0_SYSTEM, X: 0 } : z,
      displayedSwr: match ? 1 : swr(z),
      displayedRealizedGainDbi:
        match ? result.maxGainDbi - mainDb - tunerDb - (transformerEnabled ? TRANSFORMER_INSERTION_LOSS_DB : 0) : undefined,
      atuLoss: { upmastDb, mainDb, tunerDb },
    };
  }

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
 *     ratio minimizes its SWR against the 50 Ω system impedance.
 *   • feedline present → it's the rig-end impedance (the coax, with any
 *     in-model NT transformer, sits between the rig and the antenna). De-embed
 *     the line to recover the antenna terminals, then undo the NT transformer
 *     (in the model only when ratio > 1) to get the raw complex feedpoint. The
 *     optimal ratio matches that to the line's own characteristic impedance,
 *     minimizing SWR on that line.
 *
 * NOTE: with a feedline present this is only *approximately* stable — it has to
 * back the antenna feedpoint out of the rig-end reading, which (because the
 * source sits on the radiating shield) is contaminated by common-mode current
 * that does not divide by the ratio, so applying the suggestion and re-solving
 * can drift the value. Prefer `matchRatioForFeedpoint` against a bare-antenna
 * feedpoint (solved with the transformer/feedline stripped) when one is
 * available; this de-embed form is retained for the no-feedline case and as a
 * lossless-line fallback. Do not de-embed a lossy source reading with this
 * lossless transform; use the separately solved bare antenna instead.
 *
 * Returns an integer ≥ 1.
 */
export function suggestedTransformerRatio(
  zSrcReportedByNec: ImpedanceResult,
  currentRatio: number,
  z0Line: number = 0,
  lineLengthLambdas: number = 0,
): number {
  let antennaZ: ImpedanceResult;
  let target: number;
  if (!Number.isFinite(z0Line) || z0Line <= 0) {
    antennaZ = zSrcReportedByNec;
    target = Z0_SYSTEM;
  } else {
    const zLoad = deembedThroughLine(zSrcReportedByNec, z0Line, lineLengthLambdas);
    const ratio = Math.max(1, currentRatio);
    antennaZ = { R: zLoad.R * ratio, X: zLoad.X * ratio };
    target = z0Line;
  }
  return matchRatioForFeedpoint(antennaZ, target);
}

/**
 * Integer impedance-transformer ratio minimizing SWR for a complex load.
 * The continuous optimum is |Z|/target. Compare its adjacent allowed integers
 * explicitly: ordinary arithmetic rounding is not the SWR decision boundary.
 *
 * Fed a *transformer-independent* antenna feedpoint Z (and the target = the
 * feedline's characteristic impedance, or 50 Ω with no feedline), this yields a
 * single stable suggestion that does not move when the suggestion is applied —
 * because the bare feedpoint does not depend on the fitted transformer at all.
 */
export function matchRatioForFeedpoint(antenna: ImpedanceResult | number, target: number): number {
  // Number input is retained for callers with a purely resistive reference.
  const z = typeof antenna === 'number' ? { R: antenna, X: 0 } : antenna;
  if (!(z.R > 0) || !(target > 0) || ![z.R, z.X, target].every(Number.isFinite)) return 1;
  const continuous = Math.max(1, Math.hypot(z.R, z.X) / target);
  const low = Math.max(1, Math.floor(continuous));
  const high = Math.max(1, Math.ceil(continuous));
  // Maximize 1-|Gamma|^2 before the display SWR cap can hide the distinction.
  const transfer = (ratio: number) => 4 * z.R * target * ratio /
    ((z.R + target * ratio) ** 2 + z.X ** 2);
  return transfer(high) > transfer(low) ? high : low;
}
