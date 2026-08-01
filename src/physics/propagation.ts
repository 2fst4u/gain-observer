// HF sky-wave propagation estimator.
//
// Inputs the user supplies:
//   • T-index   — the Australian IPS / BOM ionospheric T-index (dimensionless,
//                 conventionally ranges roughly -50 (very disturbed) to +200
//                 (very active solar conditions); ~30 ≈ quiet, ~100 ≈ active).
//   • frequency — operating frequency, MHz (already in the antenna store).
//   • take-off  — elevation angle of the antenna's main lobe (already
//                 produced by the NEC-2 worker as result.takeoffElevationDeg).
//   • month     — 1..12, typically auto-filled from the browser clock.
//   • UTC hour  — 0..24, typically auto-filled from the browser clock.
//   • latitude  — geographic latitude, degrees (-90..+90). We use it in place
//                 of geomagnetic latitude — accurate enough for the fidelity
//                 of this model and avoids shipping an IGRF table.
//
// Outputs:
//   • foF2      — F2-layer critical frequency, MHz.
//   • hmF2      — F2-layer virtual reflection height, km.
//   • MUF       — maximum usable frequency for the user's take-off geometry.
//   • LUF       — lower usable frequency (heuristic; see caveats).
//   • hops[1..3]— ground range and open/marginal/closed status per hop.
//
// MODEL CAVEATS (deliberately surfaced in the UI):
//
//   This module is NOT IRI, ASAPS, or VOACAP. It is a published-style
//   closed-form approximation that captures the right monotonic behaviours
//   (foF2 rises with T-index, MUF rises with shallower take-off, range
//   grows with hop count) and is good enough to drive intuition for an
//   antenna visualiser. It is NOT a propagation-prediction product.
//
//   Specifically:
//     - foF2 is approximated from T-index, solar zenith angle, and latitude
//       using the form long-established in HF prediction literature (e.g.
//       ITU-R Recommendation P.533 family of methods, simplified). It does
//       not consult URSI/CCIR coefficient maps.
//     - hmF2 follows a simple diurnal sinusoid centred on canonical
//       day/night values (~280 km / ~340 km).
//     - MUF uses the secant law with a curved-Earth correction.
//     - LUF is a D-layer absorption heuristic from solar zenith angle and
//       T-index. The LUF model is the least reliable part of this module.
//     - The user's latitude is taken to be the path-midpoint latitude.
//       Fine for short hops; less so for transcontinental paths.
//     - No sporadic-E, auroral, polar, or path-asymmetry effects.
//
// References (for the curious — none of these is a verbatim implementation):
//   • ITU-R Recommendation P.533: "Method for the prediction of the
//     performance of HF circuits" — for the secant-law MUF and the general
//     foF2/hmF2 framework.
//   • IPS Radio & Space Services (Australia): definition of T-index.
//   • Davies, K. (1990), Ionospheric Radio: zenith-angle absorption model.

import type { GainPattern } from './types';

/**
 * Inputs to a hop prediction.
 */
export interface PropagationInputs {
  /** Operating frequency, MHz. */
  readonly frequencyMHz: number;
  /** T-index (dimensionless). Typical range -50..+200. */
  readonly tIndex: number;
  /** Antenna take-off elevation, degrees (0=horizon, 90=zenith). */
  readonly takeoffElevationDeg: number;
  /** Month, 1..12. */
  readonly month: number;
  /** UTC hour, 0..24 (fractional allowed). */
  readonly utcHour: number;
  /** Path-midpoint latitude, degrees (-90..+90). */
  readonly latitudeDeg: number;
  /** Path-midpoint longitude, degrees (-180..+180). Optional; defaults to 0
   *  (Greenwich) if omitted, which collapses local-noon to UTC noon. */
  readonly longitudeDeg?: number;
  /** Optional full gain pattern to allow directional range calculations. */
  readonly pattern?: GainPattern;
  /** Operating SWR (to account for mismatch loss). */
  readonly swr?: number;
}

type HopStatus = 'open' | 'marginal' | 'closed';
type LinkQuality = 'useful' | 'weak' | 'unusable';

export interface HopPrediction {
  /** Hop number, 1-based. */
  readonly n: number;
  /** Ground range from antenna to receiver after this many hops, km. */
  readonly rangeKm: number;
  readonly status: HopStatus;
  /** Human-readable reason ('f > MUF', 'f < LUF', 'within MUF margin', …). */
  readonly reason: string;
  /** Antenna/link quality for this selected ray. This does not alter range geometry. */
  readonly linkQuality: LinkQuality;
  /** Effective antenna gain after mismatch loss, if pattern data is available. */
  readonly effectiveGainDbi?: number;
  /** Elevation angle used for this hop's geometry. */
  readonly takeoffElevationDeg: number;
}

export interface PropagationPrediction {
  readonly foF2MHz: number;
  readonly hmF2Km: number;
  readonly mufMHz: number;
  readonly lufMHz: number;
  readonly hops: readonly HopPrediction[];
  /** Elevation used for the scalar/best-bearing hop readout. */
  readonly selectedTakeoffElevationDeg: number;
  /** SWR mismatch loss, dB. Reported separately from path geometry. */
  readonly mismatchLossDb: number;
  /** Solar zenith angle at path midpoint, degrees (0=overhead, 90=horizon, >90=below horizon). */
  readonly solarZenithDeg: number;
  /** Ranges for each azimuth, if a pattern was provided. */
  readonly azimuthalHops?: {
    readonly phiDeg: number;
    readonly takeoffElevationDeg: number;
    readonly rangeKm: number[];
    readonly status: HopStatus;
    readonly reason: string;
    readonly linkQuality: LinkQuality;
    readonly effectiveGainDbi?: number;
  }[];
}

/** Earth's mean radius, km. */
const EARTH_RADIUS_KM = 6371;

/** Maximum hops we model. */
const MAX_HOPS = 3;

/** "Marginal" margin around MUF/LUF as a fraction (10%). */
const MARGIN_FRAC = 0.10;

/** Display thresholds for link quality. These do not change hop geometry. */
const USEFUL_SIGNAL_DBI = -5;
const WEAK_SIGNAL_DBI = -15;

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Solar geometry
// ---------------------------------------------------------------------------

/**
 * Solar declination, degrees, for the given month.
 *
 * We approximate using a sinusoid peaking on June 21 (declination ≈ +23.44°)
 * and bottoming on December 21 (≈ −23.44°), evaluated at mid-month for a
 * stable monthly estimate. Good to ~1° which is more than fine here.
 */
export function solarDeclinationDeg(month: number): number {
  const m = clamp(month, 1, 12);
  // Day-of-year of the middle of the given month (not leap-aware; fine).
  const midDoy: Record<number, number> = {
    1: 15, 2: 46, 3: 75, 4: 105, 5: 135, 6: 162,
    7: 196, 8: 227, 9: 258, 10: 288, 11: 318, 12: 349,
  };
  const doy = midDoy[Math.round(m) as keyof typeof midDoy] ?? 80;
  // Standard approximation: -23.44 cos((doy + 10) * 360/365).
  const arg = ((doy + 10) / 365) * 2 * Math.PI;
  return -23.44 * Math.cos(arg);
}

/**
 * Solar zenith angle at the given location and UTC time, degrees.
 * 0 = sun directly overhead, 90 = on the horizon, >90 = below the horizon.
 *
 * Uses the standard cosχ = sinφ·sinδ + cosφ·cosδ·cosH formula, where H is
 * the local hour angle. Longitude 0 (default) gives Greenwich-local time.
 */
export function solarZenithDeg(
  latitudeDeg: number,
  longitudeDeg: number,
  month: number,
  utcHour: number,
): number {
  const lat = clamp(latitudeDeg, -90, 90) * DEG;
  const dec = solarDeclinationDeg(month) * DEG;
  // Local solar time hour ≈ utcHour + longitude/15. Hour angle = (LST - 12) * 15°.
  const lst = utcHour + longitudeDeg / 15;
  const H = (((lst - 12) % 24) + 24) % 24;
  const Hwrapped = H > 12 ? H - 24 : H; // -12..+12
  const Hrad = Hwrapped * 15 * DEG;
  const cosChi = Math.sin(lat) * Math.sin(dec) +
                 Math.cos(lat) * Math.cos(dec) * Math.cos(Hrad);
  return Math.acos(clamp(cosChi, -1, 1)) / DEG;
}

// ---------------------------------------------------------------------------
// Ionospheric layer estimates
// ---------------------------------------------------------------------------

/**
 * Estimate F2-layer critical frequency (foF2), MHz.
 *
 * Form: foF2 = base(zenith) * tIndexFactor(T) * latitudeFactor(lat)
 *
 *   base(zenith) — diurnal cosine; ~10 MHz at local noon, dropping to a
 *   night-time floor of ~3 MHz when the sun is well below the horizon.
 *
 *   tIndexFactor(T) — IPS T-index is normalised so that T=0 corresponds to
 *   approximately the long-term ionospheric median; positive values raise
 *   foF2, negative values depress it. We use a smooth scaling that covers
 *   the practical range:
 *     T =  -50 → factor ≈ 0.72 (badly disturbed; foF2 floor)
 *     T =    0 → factor ≈ 1.00 (median)
 *     T =  100 → factor ≈ 1.46
 *     T =  200 → factor ≈ 1.58 (very active conditions)
 *
 *   latitudeFactor(lat) — equatorial enhancement and polar depression.
 *   ~1.10 at the geomagnetic equator, ~0.85 at high latitudes.
 *
 * Returns at least 1.5 MHz so downstream MUF math stays sane.
 */
export function estimateFoF2MHz(
  tIndex: number,
  month: number,
  utcHour: number,
  latitudeDeg: number,
  longitudeDeg = 0,
): number {
  const chi = solarZenithDeg(latitudeDeg, longitudeDeg, month, utcHour);
  const cosChi = Math.cos(chi * DEG);
  // Diurnal base: smoothly transition between night (~3 MHz) and day (~10 MHz).
  // Use a soft step at the horizon: factor goes 0..1 over chi ∈ [108°..0°]
  // (108° includes astronomical twilight).
  const dayFraction = clamp((108 - chi) / 108, 0, 1);
  const noonGain = Math.max(0, cosChi); // additional bump near local noon
  const base = 3.0 + dayFraction * 5.5 + noonGain * 1.5; // MHz

  // T-index scaling: smooth, monotonic, asymptotic.
  const t = clamp(tIndex, -100, 250);
  const tFactor = 1 + 0.6 * Math.tanh(t / 100);

  // Latitude factor: equatorial bump, polar dip.
  const absLat = Math.abs(clamp(latitudeDeg, -90, 90));
  const latFactor = 1.10 - 0.30 * (absLat / 90);

  const fof2 = base * tFactor * latFactor;
  return Math.max(1.5, fof2);
}

/**
 * Estimate the F2 virtual reflection height (hmF2), km.
 *
 * Day F2 sits a bit lower (~280 km), night F2 rises (~340 km). We add a
 * weak T-index dependence (active conditions push hmF2 up slightly) and a
 * mild diurnal sinusoid driven by solar zenith angle.
 */
export function estimateHmF2Km(
  tIndex: number,
  month: number,
  utcHour: number,
  latitudeDeg: number,
  longitudeDeg = 0,
): number {
  const chi = solarZenithDeg(latitudeDeg, longitudeDeg, month, utcHour);
  // dayFraction = 1 at noon, 0 at deep night.
  const dayFraction = clamp((108 - chi) / 108, 0, 1);
  const day = 285;
  const night = 340;
  const base = night + (day - night) * dayFraction;
  const tBump = clamp(tIndex, -100, 250) * 0.05; // ≈ ±5 km over the typical range
  return clamp(base + tBump, 220, 420);
}

// ---------------------------------------------------------------------------
// Hop geometry (curved-Earth)
// ---------------------------------------------------------------------------

/**
 * Compute the great-circle ground range (km) covered by a single hop given
 * the take-off elevation angle and the F2 reflection height.
 *
 * Geometry: triangle (Earth centre, antenna, virtual reflection point).
 *   • antenna at radius R_e, take-off elevation ε above local horizon
 *   • reflection point at radius R_e + h
 *   • by sine rule the central angle 2·θ subtended at Earth's centre gives
 *     the hop ground range = R_e · 2·θ
 *
 * We compute θ via the law of sines:
 *   sin(angle at reflection point) / R_e = sin(90°+ε) / (R_e + h)
 *   → sin(γ) = R_e · cos(ε) / (R_e + h)
 *   → θ = π - (π/2 + ε) - γ  (interior angle sum)
 * Range = R_e · 2θ for one hop landed and re-departed at the same elevation.
 */
export function hopRangeKm(takeoffElevationDeg: number, hmF2Km: number): number {
  const eps = clamp(takeoffElevationDeg, 0.5, 89.5) * DEG;
  const Re = EARTH_RADIUS_KM;
  const h = clamp(hmF2Km, 50, 1000);
  // Half-hop central angle θ (antenna → reflection point only).
  const sinGamma = (Re * Math.cos(eps)) / (Re + h);
  const gamma = Math.asin(clamp(sinGamma, -1, 1));
  const theta = Math.PI - (Math.PI / 2 + eps) - gamma;
  // Full hop = 2θ on the ground.
  return Re * 2 * theta;
}

/**
 * Maximum usable frequency for a single hop, MHz.
 *
 * Secant law with curved-Earth correction:
 *   MUF = foF2 · sec(φ_i)
 * where φ_i is the angle of incidence at the reflection point.
 *
 * For a flat earth, φ_i = 90° − ε (take-off elevation). The finite shell
 * height changes this angle for a given ε; we account for that below.
 */
export function estimateMUFMHz(
  foF2MHz: number,
  takeoffElevationDeg: number,
  hmF2Km: number,
): number {
  const eps = clamp(takeoffElevationDeg, 0.5, 89.5) * DEG;
  const Re = EARTH_RADIUS_KM;
  const h = clamp(hmF2Km, 50, 1000);
  // Angle of incidence at the layer: from triangle geometry.
  // Using the law of sines in the triangle (Earth centre, antenna, reflection point):
  //   (Re + h) / sin(90° + eps) = Re / sin(phi_i)
  //   sin(phi_i) = Re * cos(eps) / (Re + h)
  // The angle of incidence phi_i is the angle at the reflection point,
  // measured from the local zenith there (i.e. the layer normal).
  const sinPhiI = (Re * Math.cos(eps)) / (Re + h);
  const phi_i = Math.asin(clamp(sinPhiI, -1, 1));
  // sec(φ_i) — at vertical incidence eps=90°, cos(eps)=0, phi_i=0, sec=1, MUF=foF2.
  const sec = 1 / Math.max(0.1, Math.cos(phi_i));
  return foF2MHz * sec;
}

/**
 * Estimate the lower usable frequency (LUF), MHz.
 *
 * D-layer absorption is the dominant loss below the MUF. It is strongly
 * driven by solar zenith angle (peaks at local noon) and modulated by
 * solar activity (T-index).
 *
 * This is a HEURISTIC — surface this to the user.
 *
 *   LUF ≈ LUF_floor + amplitude · max(0, cosχ) · (1 + 0.5·tanh(T/100))
 *
 *   LUF_floor       — night-time floor (~1.8 MHz, top of the LF/MF band).
 *   amplitude       — peak day-time absorption (~5 MHz at quiet sun).
 */
export function estimateLUFMHz(
  tIndex: number,
  month: number,
  utcHour: number,
  latitudeDeg: number,
  longitudeDeg = 0,
): number {
  const chi = solarZenithDeg(latitudeDeg, longitudeDeg, month, utcHour);
  const cosChi = Math.cos(chi * DEG);
  const day = Math.max(0, cosChi);
  const tFactor = 1 + 0.5 * Math.tanh(clamp(tIndex, -100, 250) / 100);
  const luf = 1.8 + 5.0 * day * tFactor;
  return clamp(luf, 1.0, 12.0);
}

// ---------------------------------------------------------------------------
// Top-level prediction
// ---------------------------------------------------------------------------

/**
 * Predict the per-hop range and open/closed status for the given inputs.
 * Returns rangeKm for hops 1, 2, 3 and a status reflecting the user's
 * frequency vs the hop's MUF and the LUF.
 */
export function predictPropagation(input: PropagationInputs): PropagationPrediction {
  const lon = input.longitudeDeg ?? 0;
  const fof2 = estimateFoF2MHz(input.tIndex, input.month, input.utcHour, input.latitudeDeg, lon);
  const hmF2 = estimateHmF2Km(input.tIndex, input.month, input.utcHour, input.latitudeDeg, lon);
  const chi = solarZenithDeg(input.latitudeDeg, lon, input.month, input.utcHour);

  // Account for mismatch loss if SWR is provided.
  const s = input.swr ?? 1;
  const mismatchLossDb = Number.isFinite(s) && s > 1
    ? -10 * Math.log10(1 - Math.pow((s - 1) / (s + 1), 2))
    : 0;
  const luf = estimateLUFMHz(input.tIndex, input.month, input.utcHour, input.latitudeDeg, lon);

  const azimuthalHops: PropagationPrediction['azimuthalHops'] = [];
  if (input.pattern) {
    const p = input.pattern;
    // We sample at most 72 radials (5° steps) to keep radar rendering fast.
    const phiStride = Math.max(1, Math.floor(p.phiSteps / 72));

    // PRECOMPUTE invariant physics metrics over theta.
    // MUF, range, and status only depend on elevation (theta), not azimuth (phi).
    const baseRays = new Array<{
      takeoffElevationDeg: number;
      rangeKm: number;
      status: HopStatus;
      reason: string;
      statusRankValue: number;
    } | null>(p.thetaSteps);

    for (let ti = 0; ti < p.thetaSteps; ti++) {
      const elevationDeg = 90 - ti * p.dTheta;
      if (elevationDeg < 0.5) {
        baseRays[ti] = null;
        continue;
      }

      const mufMHz = estimateMUFMHz(fof2, elevationDeg, hmF2);
      const { status, reason } = classifyPath(input.frequencyMHz, mufMHz, luf);

      baseRays[ti] = {
        takeoffElevationDeg: clamp(elevationDeg, 0.5, 89.5),
        rangeKm: hopRangeKm(elevationDeg, hmF2),
        status,
        reason,
        statusRankValue: statusRank(status),
      };
    }

    const bestTiArr = new Int32Array(p.phiSteps).fill(-1);
    const bestEffectiveGainDbiArr = new Float32Array(p.phiSteps).fill(-Infinity);
    const bestQualityRankArr = new Int32Array(p.phiSteps).fill(-1);

    for (let ti = 0; ti < p.thetaSteps; ti++) {
      const baseRay = baseRays[ti];
      if (!baseRay) continue;

      const rowOffset = ti * p.phiSteps;
      const candidateStatusRank = baseRay.statusRankValue;
      const candidateRangeKm = baseRay.rangeKm;

      for (let pi = 0; pi < p.phiSteps; pi += phiStride) {
        // The original code used ?? -Infinity on p.data which meant it handled undefined.
        // On TypedArrays out of bounds gives undefined, but we are in bounds.
        // However, some tests might pass standard arrays with sparse values.
        let gainDbi = p.data[rowOffset + pi];
        if (gainDbi === undefined) gainDbi = -Infinity;

        const effectiveGainDbi = gainDbi - mismatchLossDb;
        const linkQuality = classifyLinkQuality(effectiveGainDbi);
        const actualQRank = qualityRank(linkQuality);

        const bestTi = bestTiArr[pi];
        if (
          bestTi === -1 ||
          isBetterRay(
            candidateStatusRank,
            baseRays[bestTi]!.statusRankValue,
            actualQRank,
            bestQualityRankArr[pi],
            candidateRangeKm,
            baseRays[bestTi]!.rangeKm
          )
        ) {
          bestTiArr[pi] = ti;
          bestEffectiveGainDbiArr[pi] = effectiveGainDbi;
          bestQualityRankArr[pi] = actualQRank;
        }
      }
    }

    for (let pi = 0; pi < p.phiSteps; pi += phiStride) {
      const bestTi = bestTiArr[pi];
      if (bestTi !== -1) {
        const bestBase = baseRays[bestTi]!;
        const effectiveGainDbi = bestEffectiveGainDbiArr[pi];
        const linkQuality = classifyLinkQuality(effectiveGainDbi);

        azimuthalHops.push({
          phiDeg: pi * p.dPhi,
          takeoffElevationDeg: bestBase.takeoffElevationDeg,
          rangeKm: [bestBase.rangeKm, bestBase.rangeKm * 2, bestBase.rangeKm * 3],
          status: bestBase.status,
          reason: bestBase.reason,
          linkQuality,
          effectiveGainDbi,
        });
      }
    }
  }

  const selectedRay = azimuthalHops.length > 0
    ? selectBestAzimuthalRay(azimuthalHops)
    : predictRay(
      input.frequencyMHz,
      fof2,
      luf,
      hmF2,
      input.takeoffElevationDeg,
      effectiveGainForElevation(input.pattern, input.takeoffElevationDeg, mismatchLossDb),
    );

  const muf = estimateMUFMHz(fof2, selectedRay.takeoffElevationDeg, hmF2);

  // Each subsequent hop adds the same single-hop ground range for the selected
  // ray. Link quality is reported alongside the path status; it never changes
  // the geometric skip distance.
  const hops: HopPrediction[] = [];
  for (let n = 1; n <= MAX_HOPS; n++) {
    hops.push({
      n,
      rangeKm: selectedRay.rangeKm * n,
      status: selectedRay.status,
      reason: selectedRay.reason,
      linkQuality: selectedRay.linkQuality,
      effectiveGainDbi: selectedRay.effectiveGainDbi,
      takeoffElevationDeg: selectedRay.takeoffElevationDeg,
    });
  }

  return {
    foF2MHz: fof2,
    hmF2Km: hmF2,
    mufMHz: muf,
    lufMHz: luf,
    selectedTakeoffElevationDeg: selectedRay.takeoffElevationDeg,
    mismatchLossDb,
    solarZenithDeg: chi,
    hops,
    azimuthalHops: azimuthalHops.length > 0 ? azimuthalHops : undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

interface RayPrediction {
  readonly takeoffElevationDeg: number;
  readonly rangeKm: number;
  readonly status: HopStatus;
  readonly reason: string;
  readonly linkQuality: LinkQuality;
  readonly effectiveGainDbi?: number;
}

function predictRay(
  frequencyMHz: number,
  foF2MHz: number,
  lufMHz: number,
  hmF2Km: number,
  takeoffElevationDeg: number,
  effectiveGainDbi?: number,
): RayPrediction {
  const mufMHz = estimateMUFMHz(foF2MHz, takeoffElevationDeg, hmF2Km);
  const { status, reason } = classifyPath(frequencyMHz, mufMHz, lufMHz);
  return {
    takeoffElevationDeg: clamp(takeoffElevationDeg, 0.5, 89.5),
    rangeKm: hopRangeKm(takeoffElevationDeg, hmF2Km),
    status,
    reason,
    linkQuality: classifyLinkQuality(effectiveGainDbi),
    effectiveGainDbi,
  };
}

function classifyPath(frequencyMHz: number, mufMHz: number, lufMHz: number): Pick<RayPrediction, 'status' | 'reason'> {
  if (frequencyMHz > mufMHz) {
    return { status: 'closed', reason: `f (${frequencyMHz.toFixed(2)} MHz) > MUF (${mufMHz.toFixed(2)} MHz)` };
  }
  if (frequencyMHz < lufMHz) {
    return { status: 'closed', reason: `f (${frequencyMHz.toFixed(2)} MHz) < LUF (${lufMHz.toFixed(2)} MHz)` };
  }
  if (frequencyMHz > mufMHz * (1 - MARGIN_FRAC)) {
    return { status: 'marginal', reason: `within ${(MARGIN_FRAC * 100).toFixed(0)}% of MUF` };
  }
  if (frequencyMHz < lufMHz * (1 + MARGIN_FRAC)) {
    return { status: 'marginal', reason: `within ${(MARGIN_FRAC * 100).toFixed(0)}% of LUF` };
  }
  return { status: 'open', reason: 'between LUF and MUF' };
}

function classifyLinkQuality(effectiveGainDbi?: number): LinkQuality {
  if (effectiveGainDbi === undefined || !Number.isFinite(effectiveGainDbi)) return 'useful';
  if (effectiveGainDbi >= USEFUL_SIGNAL_DBI) return 'useful';
  if (effectiveGainDbi >= WEAK_SIGNAL_DBI) return 'weak';
  return 'unusable';
}

function compareRays(a: RayPrediction, b: RayPrediction): number {
  const statusDelta = statusRank(a.status) - statusRank(b.status);
  if (statusDelta !== 0) return statusDelta;

  const qualityDelta = qualityRank(a.linkQuality) - qualityRank(b.linkQuality);
  if (qualityDelta !== 0) return qualityDelta;

  return a.rangeKm - b.rangeKm;
}

function statusRank(status: HopStatus): number {
  if (status === 'open') return 2;
  if (status === 'marginal') return 1;
  return 0;
}

function qualityRank(quality: LinkQuality): number {
  if (quality === 'useful') return 2;
  if (quality === 'weak') return 1;
  return 0;
}

function selectBestAzimuthalRay(azimuthal: NonNullable<PropagationPrediction['azimuthalHops']>): RayPrediction {
  let best = azimuthal[0]!;
  for (let i = 1; i < azimuthal.length; i++) {
    const ray = azimuthal[i]!;
    const candidate: RayPrediction = {
      takeoffElevationDeg: ray.takeoffElevationDeg,
      rangeKm: ray.rangeKm[0] ?? 0,
      status: ray.status,
      reason: ray.reason,
      linkQuality: ray.linkQuality,
      effectiveGainDbi: ray.effectiveGainDbi,
    };
    const current: RayPrediction = {
      takeoffElevationDeg: best.takeoffElevationDeg,
      rangeKm: best.rangeKm[0] ?? 0,
      status: best.status,
      reason: best.reason,
      linkQuality: best.linkQuality,
      effectiveGainDbi: best.effectiveGainDbi,
    };
    if (compareRays(candidate, current) > 0) best = ray;
  }
  return {
    takeoffElevationDeg: best.takeoffElevationDeg,
    rangeKm: best.rangeKm[0] ?? 0,
    status: best.status,
    reason: best.reason,
    linkQuality: best.linkQuality,
    effectiveGainDbi: best.effectiveGainDbi,
  };
}

function effectiveGainForElevation(p: GainPattern | undefined, elevationDeg: number, mismatchLossDb: number): number | undefined {
  if (!p) return undefined;
  const ti = Math.round((90 - elevationDeg) / p.dTheta);
  const clampedTi = Math.max(0, Math.min(p.thetaSteps - 1, ti));
  let tiMaxG = -Infinity;
  for (let pi = 0; pi < p.phiSteps; pi++) {
    const g = p.data[clampedTi * p.phiSteps + pi]!;
    if (g > tiMaxG) tiMaxG = g;
  }
  return tiMaxG - mismatchLossDb;
}

function isBetterRay(
  candidateStatusRank: number,
  bestStatusRank: number,
  candidateQualityRank: number,
  bestQualityRank: number,
  candidateRangeKm: number,
  bestRangeKm: number
): boolean {
  if (candidateStatusRank !== bestStatusRank) {
    return candidateStatusRank > bestStatusRank;
  }
  if (candidateQualityRank !== bestQualityRank) {
    return candidateQualityRank > bestQualityRank;
  }
  return candidateRangeKm > bestRangeKm;
}
