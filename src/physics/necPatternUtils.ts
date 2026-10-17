import type { GainPattern } from './types';

// NEC prints gains to 0.01 dB, so tied directions arrive as bit-identical
// Float32s. This epsilon only absorbs float noise — it deliberately does not
// merge directions NEC itself distinguishes.
const TIE_EPSILON_DB = 1e-6;

function findPeakGain(data: ArrayLike<number>): number {
  let maxGain = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    if (v > maxGain) maxGain = v;
  }
  return maxGain;
}

function findFirstPeakInThetaRow(pattern: GainPattern, ti: number, threshold: number): number {
  const row = ti * pattern.phiSteps;
  for (let pi = 0; pi < pattern.phiSteps; pi++) {
    if (pattern.data[row + pi]! >= threshold) return pi;
  }
  return -1;
}

function findBestPeakGridIndex(pattern: GainPattern, threshold: number): { bestTi: number; bestPi: number } {
  const horizonTi = Math.min(pattern.thetaSteps - 1, Math.round(90 / pattern.dTheta));

  // Walk theta rows from the horizon back up to the zenith so the first row
  // holding a tied peak is the lowest-elevation one.
  for (let ti = horizonTi; ti >= 0; ti--) {
    const pi = findFirstPeakInThetaRow(pattern, ti, threshold);
    if (pi >= 0) return { bestTi: ti, bestPi: pi };
  }

  // Peak lies below the horizon (θ > 90°, only reachable in free space).
  for (let ti = horizonTi + 1; ti < pattern.thetaSteps; ti++) {
    const pi = findFirstPeakInThetaRow(pattern, ti, threshold);
    if (pi >= 0) return { bestTi: ti, bestPi: pi };
  }

  return { bestTi: 0, bestPi: 0 };
}

/**
 * Locate the maximum-gain direction and report it as an elevation angle and a
 * NEC azimuth φ, both in degrees.
 *
 * Ties matter. A pattern is frequently flat to within NEC's 0.01 dB print
 * resolution over a whole span of directions — a free-space dipole is exactly
 * as strong straight up as it is broadside, and a lobe over ground is often
 * equal-valued across several elevation rows. Scanning the flat grid and
 * keeping the first strict maximum resolves every one of those ties toward
 * θ = 0 (the zenith), because row 0 is visited first. That produced a
 * take-off elevation of 90° for free-space patterns, and made the azimuth cut
 * a featureless circle: at the zenith every φ holds the same value.
 *
 * So among directions tied at the peak we keep the *lowest* elevation, which
 * is both the useful HF take-off angle and the direction whose azimuth cut
 * actually carries the pattern's shape. Remaining ties keep the lowest φ.
 */
export function findMaxGainDirection(pattern: GainPattern): { maxGain: number; elevationDeg: number; phiDeg: number } {
  const maxGain = findPeakGain(pattern.data);
  const threshold = maxGain - TIE_EPSILON_DB;
  const { bestTi, bestPi } = findBestPeakGridIndex(pattern, threshold);

  const thetaDeg = bestTi * pattern.dTheta;
  const phiDeg = bestPi * pattern.dPhi;
  // Convert NEC theta (0 = +z zenith) to elevation (0 = horizon).
  const elevationDeg = 90 - thetaDeg;

  return { maxGain, elevationDeg, phiDeg };
}
