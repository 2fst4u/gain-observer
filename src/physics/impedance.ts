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
