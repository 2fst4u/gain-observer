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
  const num = Math.hypot(numR, numX);
  const den = Math.hypot(denR, denX);
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
  config: { transformerEnabled: boolean; transformerRatio: number; feedlineActive: boolean },
): DisplayedFeedMetrics {
  const { transformerEnabled, transformerRatio, feedlineActive } = config;
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
 * Apply an ideal impedance transformer: Z_transformed = Z_raw / ratio.
 * Divides both R and X by the impedance ratio (n²). Post-processing display
 * only — does not affect radiation pattern, currents, or NEC simulation.
 * Returns the original z unchanged for invalid ratios (≤ 0 or non-finite).
 */
export function transformImpedance(z: ImpedanceResult, ratio: number): ImpedanceResult {
  if (!Number.isFinite(ratio) || ratio <= 0) return z;
  return { R: z.R / ratio, X: z.X / ratio };
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
 * Computes the impedance the radio sees when an ideal `n²`-ratio transformer
 * is fitted at the antenna terminals (between antenna and feedline).
 *
 * If `lineLengthLambdas` is 0 or undefined (no feedline), this is just the
 * antenna impedance divided by the ratio. With a feedline present, the
 * antenna feedpoint is de-embedded from the NEC-reported source-side Z,
 * divided by the ratio (the transformer's effect on the load presented to
 * the cable), then re-embedded through the cable to get what the radio
 * sees.
 *
 * De-embedding accuracy depends on the absence of significant common-mode
 * current on the cable shield — which is guaranteed in the simulation
 * because enabling a transformer also engages a choke on the shield.
 */
export function transformWithTransformerAtAntenna(
  zSrcReportedByNec: ImpedanceResult,
  ratio: number,
  z0Line: number = Z0_SYSTEM,
  lineLengthLambdas: number = 0,
): ImpedanceResult {
  if (!Number.isFinite(ratio) || ratio <= 0) return zSrcReportedByNec;
  if (lineLengthLambdas === 0 || !Number.isFinite(lineLengthLambdas)) {
    // No feedline → NEC's reported Z is the antenna feedpoint directly.
    return { R: zSrcReportedByNec.R / ratio, X: zSrcReportedByNec.X / ratio };
  }
  const zAntenna = deembedThroughLine(zSrcReportedByNec, z0Line, lineLengthLambdas);
  const zXfmrPrimary = { R: zAntenna.R / ratio, X: zAntenna.X / ratio };
  return transformThroughLine(zXfmrPrimary, z0Line, lineLengthLambdas);
}

/**
 * Realized gain after a transformer fitted at the antenna terminals: the
 * NEC-computed `gainDbi` (intrinsic radiation) minus the mismatch loss
 * computed against the radio-side impedance with the transformer in
 * place, minus a fixed insertion loss for the transformer hardware.
 */
export function realizedGainWithTransformer(
  gainDbi: number,
  zSrcReportedByNec: ImpedanceResult,
  ratio: number,
  z0Line: number = Z0_SYSTEM,
  lineLengthLambdas: number = 0,
): number | undefined {
  const zRadio = transformWithTransformerAtAntenna(zSrcReportedByNec, ratio, z0Line, lineLengthLambdas);
  const mlf = mismatchLossFactor(zRadio);
  if (mlf <= 0) return undefined;
  return gainDbi + 10 * Math.log10(mlf) - TRANSFORMER_INSERTION_LOSS_DB;
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
 * Because the recovered feedpoint R does not depend on the current ratio
 * (the de-embed inverts the line exactly and the ×ratio undoes the NT card),
 * the suggestion is stable: applying it and re-simulating yields the same
 * value rather than chasing its own tail.
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
  if (!Number.isFinite(antennaR) || antennaR <= 0 || target <= 0) return 1;
  return Math.max(1, Math.round(antennaR / target));
}
