// Where an antenna's rays land after one or more ionospheric hops.
//
// The ionosphere is the IRI monthly median above the station (see
// ./ionosphere/iri.ts); rays at the operating frequency are traced through it
// (./ionosphere/raytrace.ts) and either return at a ground range or pass
// through. Per bearing, the antenna pattern supplies the strongest lobe and
// the half-power beam. Not modelled: day-to-day departures from the monthly
// median (storms, sporadic E), the geomagnetic field (X-mode), horizontal
// gradients along the path, absorption, noise and received signal, so no
// circuit availability or signal level is claimed.

import { phiToBearingDeg } from './angles';
import { AVERAGE_GROUND, computeCoverage, type CoverageMap, type GroundConstants } from './coverage';
import { f107ToR12 } from './ionosphere/iri';
import type { LayerParameters } from './ionosphere/iri';
import { plasmaFrequencyMHz } from './ionosphere/iri';
import {
  maxReturningFrequencyMHz,
  sampleProfile,
  traceFan,
  type Profile,
  type RayResult,
} from './ionosphere/raytrace';
import type { GainPattern } from './types';

export interface PropagationInputs {
  readonly frequencyMHz: number;
  /** Monthly-median ionosphere above the station. */
  readonly layers: LayerParameters;
  /** Antenna elevation above the horizon, used if no pattern is available. */
  readonly takeoffElevationDeg: number;
  readonly pattern?: GainPattern;
  /** Direction-independent offset from NEC gain to system realized gain.
   * Obtained from the same feed-system metrics as Results and the 3D view.
   * Undefined means realized gain is unavailable; -Infinity means zero
   * available power is delivered. This does not change the selected ray. */
  readonly realizedGainOffsetDb?: number;
  /** Ground at the reflection points of later hops. Free space (εr = 1,
   * σ = 0) has no ground, so average ground is used instead. */
  readonly ground?: GroundConstants;
  /** Transmitter and circumstances for absolute received power. Without
   * them the coverage map is relative. */
  readonly link?: {
    readonly txPowerW: number;
    readonly date: Date;
    readonly latitudeDeg: number;
    readonly longitudeDeg: number;
    /** 12-month smoothed 10.7 cm solar flux, sfu. */
    readonly f107: number;
  };
}

export interface HopPrediction {
  readonly n: number;
  /** Ground range after n hops, km; undefined when the ray passes through. */
  readonly rangeKm?: number;
  readonly takeoffElevationDeg: number;
  /** Antenna gain of the selected direction, dBi. */
  readonly antennaGainDbi?: number;
  /** Antenna gain including the configured feed-system power losses. */
  readonly realizedGainDbi?: number;
}

export interface PropagationPrediction {
  readonly frequencyMHz: number;
  readonly layers: LayerParameters;
  /** Highest frequency a vertical ray returns at: the profile's peak plasma frequency. */
  readonly verticalCriticalMHz: number;
  /** Highest frequency the strongest lobe's ray returns at. */
  readonly selectedMufMHz: number;
  readonly hops: readonly HopPrediction[];
  readonly selectedTakeoffElevationDeg: number;
  /** Whether the strongest lobe's ray returns at this frequency. */
  readonly selectedReturns: boolean;
  /** Height the strongest lobe's ray turns at, km. */
  readonly selectedApexKm?: number;
  readonly realizedGainOffsetDb?: number;
  /** Mid-month solar zenith at the station at this UT. */
  readonly solarZenithDeg: number;
  /** Relative power density over bearing and ground range (all rays, 1–3 hops). */
  readonly coverage?: CoverageMap;
  readonly azimuthalHops?: {
    readonly phiDeg: number;
    readonly bearingDeg: number;
    readonly takeoffElevationDeg: number;
    /** Whether this bearing's strongest-lobe ray returns. */
    readonly returns: boolean;
    /** Ground range after 1..n hops of the strongest-lobe ray; empty when it passes through. */
    readonly rangeKm: number[];
    readonly antennaGainDbi: number;
    readonly realizedGainDbi?: number;
    /** Elevation span at this bearing where gain is within HALF_POWER_DB of
     * the pattern's overall peak. Undefined where no ray here comes that
     * close. A broad high-angle (NVIS) beam includes the zenith. */
    readonly halfPowerElevationDeg?: { readonly lowDeg: number; readonly highDeg: number };
    /** Nearest and farthest single-hop landing points of the half-power
     * beam's returning rays. Undefined where the whole beam passes through. */
    readonly halfPowerRangeKm?: { readonly nearKm: number; readonly farKm: number };
  }[];
}

const EARTH_RADIUS_KM = 6371;
const MAX_HOPS = 3;
const DEG = Math.PI / 180;
/** Half-power beamwidth criterion: the standard antenna-beam definition,
 * relative to the pattern's own peak, not a signal-quality threshold. */
export const HALF_POWER_DB = 3;
/** Elevation step of the traced fan of rays, degrees. */
const FAN_STEP_DEG = 0.25;

/**
 * Full ground arc for one specular reflection from a spherical shell: the
 * thin-layer limit of the ray tracer, kept as its reference.
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

/** A ray at any elevation, interpolated from the traced fan. Between a
 * returning and an escaping sample, the nearer sample decides. */
export function rayAt(fan: readonly RayResult[], elevationDeg: number): RayResult {
  const x = Math.max(0, Math.min(90, elevationDeg)) / FAN_STEP_DEG;
  const i = Math.min(fan.length - 2, Math.floor(x));
  const t = x - i;
  const a = fan[i]!, b = fan[i + 1]!;
  if (a.returns && b.returns) {
    return {
      elevationDeg,
      returns: true,
      rangeKm: a.rangeKm! + t * (b.rangeKm! - a.rangeKm!),
      apexKm: a.apexKm! + t * (b.apexKm! - a.apexKm!),
    };
  }
  return { ...(t < 0.5 ? a : b), elevationDeg };
}

/** Landing range of the returning rays across an elevation span. */
function spanReach(fan: readonly RayResult[], lowDeg: number, highDeg: number) {
  const elevations = [lowDeg, highDeg];
  for (let e = Math.ceil(lowDeg / FAN_STEP_DEG) * FAN_STEP_DEG; e < highDeg; e += FAN_STEP_DEG) {
    if (e > lowDeg) elevations.push(e);
  }
  let nearKm = Infinity, farKm = -Infinity;
  for (const e of elevations) {
    const ray = rayAt(fan, e);
    if (!ray.returns) continue;
    nearKm = Math.min(nearKm, ray.rangeKm!);
    farKm = Math.max(farKm, ray.rangeKm!);
  }
  return Number.isFinite(nearKm) ? { nearKm, farKm } : undefined;
}

/** Trace the operating frequency through the ionosphere's profile. */
export function traceIonosphere(layers: LayerParameters, frequencyMHz: number): { profile: Profile; fan: RayResult[] } {
  const profile = sampleProfile((h) => plasmaFrequencyMHz(layers, h));
  return { profile, fan: traceFan(profile, frequencyMHz, FAN_STEP_DEG) };
}

/**
 * Where each bearing's strongest lobe and half-power beam land at the
 * operating frequency. Feed losses change only realized gain; they cannot
 * change which rays return or where.
 */
export function predictPropagation(input: PropagationInputs): PropagationPrediction {
  const { profile, fan } = traceIonosphere(input.layers, input.frequencyMHz);
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
      bestElevation = refinePeakElevation(pattern, pi, bestElevation);
      const ray = rayAt(fan, bestElevation);
      azimuthalHops.push({
        phiDeg: pi * pattern.dPhi,
        bearingDeg: phiToBearingDeg(pi * pattern.dPhi),
        takeoffElevationDeg: bestElevation,
        returns: ray.returns,
        rangeKm: ray.returns ? Array.from({ length: MAX_HOPS }, (_, n) => ray.rangeKm! * (n + 1)) : [],
        antennaGainDbi: bestGain,
        realizedGainDbi: realizedGainOffsetDb === undefined ? undefined : bestGain + realizedGainOffsetDb,
      });
    }
  }

  if (pattern && azimuthalHops.length > 0) {
    const peak = Math.max(...azimuthalHops.map((ray) => ray.antennaGainDbi));
    for (let i = 0; i < azimuthalHops.length; i++) {
      const ray = azimuthalHops[i]!;
      const span = halfPowerElevationSpan(pattern, Math.round(ray.phiDeg / pattern.dPhi), peak - HALF_POWER_DB);
      if (!span) continue;
      azimuthalHops[i] = {
        ...ray,
        halfPowerElevationDeg: span,
        halfPowerRangeKm: spanReach(fan, span.lowDeg, span.highDeg),
      };
    }
  }

  let bestRay: (typeof azimuthalHops)[number] | undefined;
  for (const ray of azimuthalHops) {
    if (!bestRay || ray.antennaGainDbi > bestRay.antennaGainDbi ||
      (ray.antennaGainDbi === bestRay.antennaGainDbi && (ray.rangeKm[0] ?? -1) > (bestRay.rangeKm[0] ?? -1))) {
      bestRay = ray;
    }
  }
  const selectedTakeoffElevationDeg = bestRay?.takeoffElevationDeg ?? clamp(input.takeoffElevationDeg, 0, 90);
  const selected = rayAt(fan, selectedTakeoffElevationDeg);
  let peakFN2 = 0;
  for (const v of profile.fN2) peakFN2 = Math.max(peakFN2, v);
  const g = input.ground;
  const ground = g && typeof g.sigma === 'number' && !Number.isNaN(g.sigma) && Number.isFinite(g.epsilon) &&
    !(g.sigma === 0 && g.epsilon <= 1) ? g : AVERAGE_GROUND;
  const coverage = pattern && pattern.dTheta > 0 && pattern.dPhi > 0
    ? computeCoverage(pattern, fan, input.frequencyMHz, ground, MAX_HOPS, input.link && {
      txPowerW: input.link.txPowerW,
      realizedGainOffsetDb: realizedGainOffsetDb !== undefined && Number.isFinite(realizedGainOffsetDb)
        ? realizedGainOffsetDb : realizedGainOffsetDb === -Infinity ? -300 : 0,
      date: input.link.date,
      latitudeDeg: input.link.latitudeDeg,
      longitudeDeg: input.link.longitudeDeg,
      sunspotNumber: f107ToR12(input.link.f107),
    }) : undefined;
  return {
    coverage,
    frequencyMHz: input.frequencyMHz,
    layers: input.layers,
    verticalCriticalMHz: Math.sqrt(peakFN2),
    selectedMufMHz: maxReturningFrequencyMHz(profile, selectedTakeoffElevationDeg),
    selectedTakeoffElevationDeg,
    selectedReturns: selected.returns,
    selectedApexKm: selected.apexKm,
    realizedGainOffsetDb,
    solarZenithDeg: input.layers.solarZenithDeg,
    hops: Array.from({ length: MAX_HOPS }, (_, n) => ({
      n: n + 1,
      rangeKm: selected.returns ? selected.rangeKm! * (n + 1) : undefined,
      takeoffElevationDeg: selectedTakeoffElevationDeg,
      antennaGainDbi: bestRay?.antennaGainDbi,
      realizedGainDbi: bestRay?.realizedGainDbi,
    })),
    azimuthalHops: azimuthalHops.length > 0 ? azimuthalHops : undefined,
  };
}

/** Neighbours further than this below the peak are a null or the below-ground
 * sentinel, not part of the lobe, and cannot shape a parabola through it. */
const PEAK_FIT_MAX_DROP_DB = 20;

/**
 * Locate a lobe's elevation between pattern rows. The NEC grid is 2° apart,
 * and at low take-off angles one degree moves a 300 km shell hop by roughly
 * 150–200 km, so the nearest sample alone quantises range coarsely. A
 * parabola through the peak row and its two neighbours (in dB, the standard
 * beam-peak estimator) moves the elevation by at most half a step. The
 * reported gain stays the solved sample. At the zenith, or where a neighbour
 * is missing, at the horizon or in a null, the sampled elevation is kept.
 */
export function refinePeakElevation(pattern: GainPattern, phiIndex: number, elevationDeg: number): number {
  const ti = Math.round((90 - elevationDeg) / pattern.dTheta);
  if (ti <= 0 || ti + 1 >= pattern.thetaSteps) return elevationDeg;
  const at = (t: number) => pattern.data[t * pattern.phiSteps + phiIndex];
  const above = at(ti - 1), peak = at(ti), below = at(ti + 1);
  if (above === undefined || peak === undefined || below === undefined) return elevationDeg;
  if (![above, peak, below].every(Number.isFinite)) return elevationDeg;
  if (peak - above > PEAK_FIT_MAX_DROP_DB || peak - below > PEAK_FIT_MAX_DROP_DB) return elevationDeg;
  const curvature = above - 2 * peak + below;
  if (!(curvature < 0)) return elevationDeg;
  const offsetRows = Math.max(-0.5, Math.min(0.5, 0.5 * (above - below) / curvature));
  return clamp(90 - (ti + offsetRows) * pattern.dTheta, 0, 90);
}

/**
 * Highest and lowest upper-hemisphere elevations at one bearing where gain is
 * at least `thresholdDbi`. Each edge is placed between rows by linear
 * interpolation in dB against its neighbouring row; an edge at the zenith, or
 * beside a missing sample, stays on the sampled row. A bearing whose rays
 * cross the threshold twice (two separate lobes) reports the outermost edges.
 */
export function halfPowerElevationSpan(
  pattern: GainPattern,
  phiIndex: number,
  thresholdDbi: number,
): { lowDeg: number; highDeg: number } | undefined {
  const at = (t: number) => {
    const gain = pattern.data[t * pattern.phiSteps + phiIndex];
    return gain !== undefined && Number.isFinite(gain) ? gain : undefined;
  };
  const elevationOf = (t: number) => 90 - t * pattern.dTheta;
  let first = -1;
  let last = -1;
  for (let ti = 0; ti < pattern.thetaSteps && elevationOf(ti) >= 0; ti++) {
    const gain = at(ti);
    if (gain === undefined || gain < thresholdDbi) continue;
    if (first < 0) first = ti;
    last = ti;
  }
  if (first < 0) return undefined;
  const edge = (inside: number, outside: number): number => {
    const gIn = at(inside)!;
    const gOut = outside >= 0 && outside < pattern.thetaSteps && elevationOf(outside) >= 0
      ? at(outside) : undefined;
    if (gOut === undefined || !(gIn > gOut)) return elevationOf(inside);
    const fraction = (gIn - thresholdDbi) / (gIn - gOut);
    return elevationOf(inside) + fraction * (elevationOf(outside) - elevationOf(inside));
  };
  return {
    highDeg: clamp(edge(first, first - 1), 0, 90),
    lowDeg: clamp(edge(last, last + 1), 0, 90),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum;
}
