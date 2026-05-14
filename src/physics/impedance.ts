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
