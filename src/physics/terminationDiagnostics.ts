// Termination-effectiveness diagnostics derived from NEC output.
//
// These metrics measure whether the far-end resistor on a sloping-V
// is actually absorbing the travelling wave.  They are distinct from SWR
// (which only measures feedpoint reflection) and must not be described as
// feedpoint-match metrics in any UI copy.

import type {
  SegmentCurrent,
  PowerBudget,
  GainPattern,
  CurrentRipple,
  TerminationDiagnostics,
} from './types';

/**
 * Computes per-tag current ripple from parsed segment currents.
 *
 * ripple = max(|I|) / min(|I|)
 * rippleDb = 20 * log10(ripple)
 *
 * A ripple of 1.0 (0 dB) indicates a pure travelling wave (uniform
 * current envelope).  High ripple indicates a standing-wave component.
 *
 * Tags with fewer than 2 segments are excluded — a single-segment wire
 * cannot have a ripple profile.
 */
export function computeCurrentRippleByTag(currents: SegmentCurrent[]): CurrentRipple[] {
  const byTag = new Map<number, number[]>();
  for (const c of currents) {
    let mags = byTag.get(c.tagNo);
    if (!mags) {
      mags = [];
      byTag.set(c.tagNo, mags);
    }
    mags.push(c.magnitude);
  }

  const result: CurrentRipple[] = [];
  for (const [tagNo, mags] of byTag) {
    if (mags.length < 2) continue;
    let maxMag = mags[0]!;
    let minMag = mags[0]!;
    for (let i = 1; i < mags.length; i++) {
      const val = mags[i]!;
      if (val > maxMag) maxMag = val;
      if (val < minMag) minMag = val;
    }
    const ripple = minMag > 0 ? maxMag / minMag : Infinity;
    const rippleDb = Number.isFinite(ripple) ? 20 * Math.log10(ripple) : Infinity;
    result.push({ tagNo, magnitudes: mags, ripple, rippleDb });
  }

  // Stable ordering by tag number.
  result.sort((a, b) => a.tagNo - b.tagNo);
  return result;
}

/**
 * Computes the front-to-back ratio from the radiation pattern.
 *
 * "Front" = the direction of peak gain (takeoffAzimuthDeg at the
 *   take-off elevation).
 * "Back"  = the same elevation, but phi + 180°.
 *
 * Returns null when the pattern has too few phi steps to sample both
 * directions (< 2 steps), or when the elevation maps outside the pattern.
 */
export function computeFrontBackDb(
  pattern: GainPattern,
  takeoffElevationDeg: number,
  takeoffAzimuthDeg: number,
): number | null {
  if (pattern.phiSteps < 2) return null;

  // NEC theta = 0 at zenith; elevation = 0 at horizon.
  const thetaDeg = 90 - takeoffElevationDeg;
  // When thetaSteps === 1, dTheta is Infinity and Math.round(x/Infinity) === 0,
  // which correctly maps to the single available row (index 0).
  const ti = Math.round(thetaDeg / pattern.dTheta);
  if (ti < 0 || ti >= pattern.thetaSteps) return null;

  const frontPhi = ((takeoffAzimuthDeg % 360) + 360) % 360;
  const backPhi = (frontPhi + 180) % 360;

  const frontPi = Math.round(frontPhi / pattern.dPhi) % pattern.phiSteps;
  const backPi = Math.round(backPhi / pattern.dPhi) % pattern.phiSteps;

  const frontGain = pattern.data[ti * pattern.phiSteps + frontPi]!;
  const backGain = pattern.data[ti * pattern.phiSteps + backPi]!;

  return frontGain - backGain;
}

/**
 * Assembles all termination-effectiveness diagnostics from parsed NEC data.
 */
export function computeTerminationDiagnostics(
  currents: SegmentCurrent[],
  powerBudget: PowerBudget | null,
  pattern: GainPattern,
  takeoffElevationDeg: number,
  takeoffAzimuthDeg: number,
): TerminationDiagnostics {
  return {
    currentRippleByTag: computeCurrentRippleByTag(currents),
    powerBudget,
    frontBackDb: computeFrontBackDb(pattern, takeoffElevationDeg, takeoffAzimuthDeg),
  };
}
