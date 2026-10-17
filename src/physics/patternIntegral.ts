// Whole-sphere integration of a NEC gain pattern.
//
// NEC's RP card with D = 0 reports *power gain*: G(θ,φ) = 4π U(θ,φ) / P_in.
// Integrating that over the sphere therefore recovers the fraction of the
// input power that actually left as a far field:
//
//   ⟨G⟩ = (1/4π) ∮ G(θ,φ) dΩ = P_far-field / P_in
//
// This is NEC's classical "average gain test". Two things fall out of it:
//
//   • Directivity. D = 4π U_max / P_rad = G_max / ⟨G⟩, which in dB is
//     G_max(dBi) − 10·log10⟨G⟩. Deriving it from the POWER BUDGET block
//     instead (D = G / η) is only equivalent in free space: NEC's budget
//     counts conductor and network loss, but knows nothing about power the
//     ground absorbs on reflection. Over average soil roughly a quarter of
//     the radiated power is lost that way, so the budget reports η = 100 %
//     and the directivity collapses onto the gain, understating it by well
//     over a dB.
//
//   • A model sanity check. For a lossless antenna in free space ⟨G⟩ must
//     come out at 1.0; a value far from that means the segmentation or the
//     geometry is not converged.

import type { GainPattern } from './types';

const DB_TO_LINEAR_SCALE = Math.LN10 / 10;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Converts degrees to radians.
 */
export function degToRad(deg: number): number {
  return deg * DEG_TO_RAD;
}

/**
 * Converts dB power gain to a linear ratio.
 */
export function dbToLinear(db: number): number {
  return Math.exp(db * DB_TO_LINEAR_SCALE);
}

/**
 * Returns the trapezoidal rule integration weight for a given theta index.
 */
export function thetaWeight(ti: number, thetaSteps: number): number {
  return ti === 0 || ti === thetaSteps - 1 ? 0.5 : 1;
}

/**
 * Sums the linear power values across all phi steps for a given theta row.
 */
export function sumRowLinearPower(
  data: ArrayLike<number>,
  rowOffset: number,
  phiSteps: number,
): number {
  let rowSum = 0;
  for (let pi = 0; pi < phiSteps; pi++) {
    rowSum += dbToLinear(data[rowOffset + pi]!);
  }
  return rowSum;
}

/**
 * Average of the power gain over the whole sphere, as a linear ratio.
 *
 * The pattern is a regular θ/φ grid, so this is a midpoint sum in φ (which is
 * periodic and therefore exact for the sampling) and a trapezoidal sum in θ
 * weighted by the sin θ area element. The θ endpoints carry half weight; both
 * sit at a pole where sin θ = 0, so they contribute nothing either way.
 *
 * Directions NEC never computed (below-ground rows over a ground plane, and
 * true nulls) arrive as a large negative dB sentinel, which contributes ~0 to
 * the sum — correct in both cases, since no power goes there.
 *
 * Returns 0 for a pattern with no usable grid.
 */
export function averageGainLinear(pattern: GainPattern): number {
  const { data, thetaSteps, phiSteps, dTheta, dPhi } = pattern;
  if (thetaSteps < 2 || phiSteps < 1 || data.length < thetaSteps * phiSteps) return 0;

  const dThetaRad = degToRad(dTheta);
  const dPhiRad = degToRad(dPhi);

  let sum = 0;
  for (let ti = 0; ti < thetaSteps; ti++) {
    const sinTheta = Math.sin(degToRad(ti * dTheta));
    if (sinTheta === 0) continue;

    const weight = thetaWeight(ti, thetaSteps);
    const rowOffset = ti * phiSteps;
    const rowSum = sumRowLinearPower(data, rowOffset, phiSteps);

    sum += rowSum * sinTheta * weight;
  }

  return (sum * dThetaRad * dPhiRad) / (4 * Math.PI);
}

/**
 * Peak directivity in dBi: D = G_max / ⟨G⟩.
 *
 * Returns undefined when the pattern cannot be integrated (degenerate grid, or
 * a pattern that radiates nowhere), so callers can fall back or hide the row.
 */
export function directivityDbi(pattern: GainPattern, maxGainDbi: number): number | undefined {
  const avg = averageGainLinear(pattern);
  if (!Number.isFinite(avg) || avg <= 1e-12) return undefined;
  return maxGainDbi - 10 * Math.log10(avg);
}
