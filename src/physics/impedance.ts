// Impedance/SWR helpers.

import { Z0_SYSTEM } from './constants';
import type { ImpedanceResult } from './types';

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
