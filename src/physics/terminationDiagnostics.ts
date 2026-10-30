// Current-envelope range and attributed termination heat from NEC output.
// These are distinct from source SWR. Envelope variation alone does not
// determine the amplitude or power of a reflected wave on a radiating wire.

import type {
  SegmentCurrent,
  PowerBudget,
  GainPattern,
  CurrentRipple,
  TerminationDiagnostics,
  SegmentLoad,
} from './types';

/**
 * Computes per-tag current ripple from parsed segment currents.
 *
 * ripple = max(|I|) / min(|I|)
 * rippleDb = 20 * log10(ripple)
 *
 * This is envelope dynamic range, not a reflected-wave estimate. A forward
 * travelling wave can attenuate along a radiating wire without reflection.
 *
 * Tags with fewer than 2 segments are excluded — a single-segment wire
 * cannot have a ripple profile.
 */
export function computeCurrentRippleByTag(currents: SegmentCurrent[]): CurrentRipple[] {
  const byTag = new Map<number, number[]>();
  for (let i = 0; i < currents.length; i++) {
    const c = currents[i]!;
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
  loads: readonly SegmentLoad[] = [],
): TerminationDiagnostics {
  return {
    currentRippleByTag: computeCurrentRippleByTag(currents),
    powerBudget,
    terminationPowerW: computeTerminationPower(currents, loads),
    frontBackDb: computeFrontBackDb(pattern, takeoffElevationDeg, takeoffAzimuthDeg),
  };
}

/** NEC currents are peak phasors, hence resistor dissipation is R |I|² / 2. */
export function computeTerminationPower(currents: SegmentCurrent[], loads: readonly SegmentLoad[]): number {
  let power = 0;
  for (const load of loads) {
    if (load.role !== 'termination' || load.param1 <= 0) continue;
    const tagged = load.wireTag === 0 ? currents : currents.filter(c => c.tagNo === load.wireTag);
    const start = load.segmentStart === 0 ? 0 : load.segmentStart - 1;
    const end = load.segmentEnd === 0 ? tagged.length : load.segmentEnd;
    for (let i = start; i < Math.min(end, tagged.length); i++) {
      power += 0.5 * load.param1 * tagged[i]!.magnitude ** 2;
    }
  }
  return power;
}
