// Ideal spherical-shell ray geometry for comparing antenna elevations.
//
// This is a geometry illustration, not an ionospheric propagation forecast.
// A shell of an explicitly chosen height reflects straight rays specularly.
// A real ionosphere refracts rays through a frequency-dependent density
// profile: hmF2 (the true density-peak height) is not a virtual reflection
// height. No foF2, MUF, LUF, absorption, received SNR, or circuit availability
// is inferred from T-index or arbitrary antenna-gain thresholds here.

import { phiToBearingDeg } from './angles';
import type { GainPattern } from './types';

export interface PropagationInputs {
  /** Antenna elevation above the horizon, used if no pattern is available. */
  readonly takeoffElevationDeg: number;
  /** Height of the ideal reflecting shell above mean Earth, km. */
  readonly shellHeightKm: number;
  readonly month: number;
  readonly utcHour: number;
  /** Observer location, used only for the solar-angle context. */
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly pattern?: GainPattern;
  /** Direction-independent offset from NEC gain to system realized gain.
   * Obtained from the same feed-system metrics as Results and the 3D view.
   * Undefined means realized gain is unavailable; -Infinity means zero
   * available power is delivered. This does not change the selected ray. */
  readonly realizedGainOffsetDb?: number;
}

export interface HopPrediction {
  readonly n: number;
  /** Arc distance in the ideal shell geometry, not a coverage radius. */
  readonly rangeKm: number;
  readonly takeoffElevationDeg: number;
  /** Antenna gain of the selected direction, dBi. */
  readonly antennaGainDbi?: number;
  /** Antenna gain including the configured feed-system power losses. */
  readonly realizedGainDbi?: number;
}

export interface PropagationPrediction {
  readonly shellHeightKm: number;
  readonly hops: readonly HopPrediction[];
  readonly selectedTakeoffElevationDeg: number;
  readonly realizedGainOffsetDb?: number;
  /** Monthly approximate solar zenith at the observer, not along a path. */
  readonly solarZenithDeg: number;
  readonly azimuthalHops?: {
    readonly phiDeg: number;
    readonly bearingDeg: number;
    readonly takeoffElevationDeg: number;
    readonly rangeKm: number[];
    readonly antennaGainDbi: number;
    readonly realizedGainDbi?: number;
  }[];
}

const EARTH_RADIUS_KM = 6371;
const MAX_HOPS = 3;
const DEG = Math.PI / 180;

/** Monthly mid-month solar declination approximation, degrees. */
export function solarDeclinationDeg(month: number): number {
  const midDoy = [15, 46, 75, 105, 135, 166, 196, 227, 258, 288, 319, 349];
  const doy = midDoy[Math.round(clamp(month, 1, 12)) - 1]!;
  return -23.44 * Math.cos(((doy + 10) / 365) * 2 * Math.PI);
}

/** Solar zenith from spherical astronomy. Uses mean solar time (no equation
 * of time), and mid-month declination; this is monthly context, not an
 * ephemeris. Positive longitude is east. */
export function solarZenithDeg(
  latitudeDeg: number,
  longitudeDeg: number,
  month: number,
  utcHour: number,
): number {
  const lat = clamp(latitudeDeg, -90, 90) * DEG;
  const dec = solarDeclinationDeg(month) * DEG;
  const hourAngle = (utcHour + longitudeDeg / 15 - 12) * 15 * DEG;
  const cosChi = Math.sin(lat) * Math.sin(dec) +
    Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  return Math.acos(clamp(cosChi, -1, 1)) / DEG;
}

/**
 * Full ground arc for one specular reflection from a spherical shell.
 * The half-hop central angle is π/2 − ε − asin(R cos ε / (R + h)).
 * Vertical incidence returns exactly zero; a horizontal ray has the finite
 * horizon-to-horizon range 2R acos(R / (R + h)). No range is inferred from
 * antenna gain, mismatch, or the existence of a real ionospheric path.
 */
export function hopRangeKm(takeoffElevationDeg: number, shellHeightKm: number): number {
  const elevation = clamp(takeoffElevationDeg, 0, 90);
  if (elevation === 90) return 0;
  const eps = elevation * DEG;
  const height = clamp(shellHeightKm, 50, 1000);
  const gamma = Math.asin(EARTH_RADIUS_KM * Math.cos(eps) / (EARTH_RADIUS_KM + height));
  const halfAngle = Math.PI / 2 - eps - gamma;
  return Math.max(0, 2 * EARTH_RADIUS_KM * halfAngle);
}

/**
 * Compare the ground arcs of antenna lobes in an explicitly chosen shell.
 * Per bearing, the strongest upper-hemisphere antenna lobe supplies the ray.
 * Feed losses change only realized gain; they cannot improve geometric range
 * or switch lobes by crossing arbitrary signal-quality thresholds.
 */
export function predictPropagation(input: PropagationInputs): PropagationPrediction {
  const shellHeightKm = clamp(input.shellHeightKm, 50, 1000);
  const pattern = input.pattern;
  const azimuthalHops: NonNullable<PropagationPrediction['azimuthalHops']> = [];
  const offset = input.realizedGainOffsetDb;
  const realizedGainOffsetDb = offset !== undefined && (Number.isFinite(offset) || offset === -Infinity)
    ? offset : undefined;

  if (pattern && pattern.dTheta > 0 && pattern.dPhi > 0) {
    // Include all bearings used by the NEC output. Downsampling can miss the
    // true peak of a narrow lobe and is unnecessary at these pattern sizes.
    for (let pi = 0; pi < pattern.phiSteps; pi++) {
      let bestGain = -Infinity;
      let bestElevation = 90;
      for (let ti = 0; ti < pattern.thetaSteps; ti++) {
        const elevation = 90 - ti * pattern.dTheta;
        if (elevation < 0) break;
        const gain = pattern.data[ti * pattern.phiSteps + pi];
        if (gain === undefined || !Number.isFinite(gain)) continue;
        if (gain > bestGain || (gain === bestGain && elevation < bestElevation)) {
          bestGain = gain;
          bestElevation = elevation;
        }
      }
      if (!Number.isFinite(bestGain)) continue;
      const range = hopRangeKm(bestElevation, shellHeightKm);
      azimuthalHops.push({
        phiDeg: pi * pattern.dPhi,
        bearingDeg: phiToBearingDeg(pi * pattern.dPhi),
        takeoffElevationDeg: bestElevation,
        rangeKm: Array.from({ length: MAX_HOPS }, (_, n) => range * (n + 1)),
        antennaGainDbi: bestGain,
        realizedGainDbi: realizedGainOffsetDb === undefined ? undefined : bestGain + realizedGainOffsetDb,
      });
    }
  }

  let bestRay: (typeof azimuthalHops)[number] | undefined;
  for (const ray of azimuthalHops) {
    if (!bestRay || ray.antennaGainDbi > bestRay.antennaGainDbi ||
      (ray.antennaGainDbi === bestRay.antennaGainDbi && ray.rangeKm[0]! > bestRay.rangeKm[0]!)) {
      bestRay = ray;
    }
  }
  const selectedTakeoffElevationDeg = bestRay?.takeoffElevationDeg ?? clamp(input.takeoffElevationDeg, 0, 90);
  const singleHopKm = hopRangeKm(selectedTakeoffElevationDeg, shellHeightKm);
  return {
    shellHeightKm,
    selectedTakeoffElevationDeg,
    realizedGainOffsetDb,
    solarZenithDeg: solarZenithDeg(input.latitudeDeg, input.longitudeDeg, input.month, input.utcHour),
    hops: Array.from({ length: MAX_HOPS }, (_, n) => ({
      n: n + 1,
      rangeKm: singleHopKm * (n + 1),
      takeoffElevationDeg: selectedTakeoffElevationDeg,
      antennaGainDbi: bestRay?.antennaGainDbi,
      realizedGainDbi: bestRay?.realizedGainDbi,
    })),
    azimuthalHops: azimuthalHops.length > 0 ? azimuthalHops : undefined,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum;
}
