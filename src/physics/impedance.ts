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
 */
export function swr(z: ImpedanceResult, z0: number = Z0_SYSTEM): number {
  const gamma = reflectionCoefficientMag(z, z0);
  if (gamma >= 1) return 999;
  const s = (1 + gamma) / (1 - gamma);
  return Math.min(s, 999);
}

/**
 * Ideal impedance-ratio matching transformer placed at the antenna feedpoint.
 *
 * A real n²:1 unun/balun at the antenna terminals divides the antenna's
 * differential feedpoint impedance by the ratio when looking toward the
 * antenna from the radio. That is the convention used here: passing the
 * raw feedpoint Z and a ratio of 9 returns Z / 9, so a 450 Ω feedpoint
 * looks like 50 Ω to the radio (giving 1:1 SWR against a 50 Ω system).
 *
 * Note: this is a post-process correction applied to the impedance reported
 * by NEC. The NEC deck itself does not include the transformer, so radiation
 * pattern and currents are computed for the bare antenna.
 */
export function applyImpedanceTransformer(z: ImpedanceResult, ratio: number = 1): ImpedanceResult {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return {
    R: z.R / safeRatio,
    X: z.X / safeRatio,
  };
}
