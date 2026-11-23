// Relative skywave power density over the ground around the station.
//
// Each traced ray carries the power the antenna radiates into its elevation
// band (gain × cos ε × Δε × Δφ / 4π for unit input power). For 1–3 hops the
// band lands across a stretch of ground [n·D(ε), n·D(ε+Δε)], and its power is
// spread over the area of that stretch on a spherical Earth. This is the ray
// tube: where neighbouring rays land close together (near the skip distance)
// the power concentrates, where they spread apart it thins. Each extra hop
// loses power to ground reflection, from Fresnel coefficients of the
// configured ground, averaged over horizontal and vertical polarisation
// because the ionosphere rotates and splits the wave's polarisation.
//
// Not included: D-layer absorption (no sourced quiet-day model is used, so
// low-band daytime multi-hop and low-angle paths are shown too strong),
// focusing by Earth curvature beyond the ray-tube area, and anything on the
// receiving side. The result is relative: dB below the strongest cell.

import type { RayResult } from './ionosphere/raytrace';
import type { GainPattern } from './types';
import { phiToBearingDeg } from './angles';

const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;
/** Speed of light, m/s, for the ground's complex permittivity. */
const C = 299_792_458;
/** Range bins across the plot radius. */
export const COVERAGE_BINS = 64;
/** Cells weaker than this, relative to the strongest, are not drawn. */
export const COVERAGE_FLOOR_DB = -30;

export interface GroundConstants {
  /** Conductivity, S/m (Infinity for a perfect conductor). */
  readonly sigma: number;
  /** Relative permittivity. */
  readonly epsilon: number;
}

/** Ground used for path reflections when the antenna is in free space. */
export const AVERAGE_GROUND: GroundConstants = { sigma: 0.005, epsilon: 13 };

export interface CoverageMap {
  readonly maxRangeKm: number;
  readonly binKm: number;
  /** Compass bearing at the centre of each sector, degrees. */
  readonly bearingsDeg: readonly number[];
  readonly sectorWidthDeg: number;
  /** dB relative to the strongest cell, [sector × COVERAGE_BINS + bin];
   * -Infinity where nothing lands. */
  readonly relativeDb: Float64Array;
  /** How many hops reach each cell's strongest contribution (1–3; 0 = none). */
  readonly dominantHops: Uint8Array;
  /** Power density of the strongest cell per unit radiated power, km⁻². */
  readonly peakDensity: number;
}

// ---- complex arithmetic for the Fresnel coefficients ----

type Complex = readonly [number, number];
const sub = (a: Complex, b: Complex): Complex => [a[0] - b[0], a[1] - b[1]];
const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const abs2 = (a: Complex) => a[0] * a[0] + a[1] * a[1];
function csqrt(a: Complex): Complex {
  const r = Math.hypot(a[0], a[1]);
  const re = Math.sqrt((r + a[0]) / 2);
  const im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2));
  return [re, im];
}

/**
 * Fraction of power reflected by the ground at a grazing angle, the mean of
 * the horizontal and vertical Fresnel power coefficients.
 */
export function groundReflectionPower(ground: GroundConstants, frequencyMHz: number, grazingDeg: number): number {
  if (!Number.isFinite(ground.sigma)) return 1; // perfect conductor
  const psi = Math.max(0, Math.min(90, grazingDeg)) * DEG;
  const lambda = C / (frequencyMHz * 1e6);
  const eps: Complex = [ground.epsilon, -60 * lambda * ground.sigma];
  const sin: Complex = [Math.sin(psi), 0];
  const root = csqrt(sub(eps, [Math.cos(psi) ** 2, 0]));
  const rh = abs2(sub(sin, root)) / abs2(add(sin, root));
  const epsSin = mul(eps, sin);
  const rv = abs2(sub(epsSin, root)) / abs2(add(epsSin, root));
  return (rh + rv) / 2;
}

/** Linear gain at an elevation in one pattern column (dB interpolation). */
function gainAt(pattern: GainPattern, phiIndex: number, elevationDeg: number): number {
  const x = (90 - elevationDeg) / pattern.dTheta;
  const i = Math.max(0, Math.min(pattern.thetaSteps - 2, Math.floor(x)));
  const t = x - i;
  const a = pattern.data[i * pattern.phiSteps + phiIndex];
  const b = pattern.data[(i + 1) * pattern.phiSteps + phiIndex];
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return 10 ** ((a + t * (b - a)) / 10);
}

/** Ground area, km², of a ring sector between two surface distances. */
function ringArea(r1: number, r2: number, widthRad: number): number {
  return widthRad * EARTH_RADIUS_KM ** 2 * (Math.cos(r1 / EARTH_RADIUS_KM) - Math.cos(r2 / EARTH_RADIUS_KM));
}

/**
 * Map relative power density over bearings and ground range.
 * `fan` is the ray fan at the operating frequency, evenly spaced from 0° to 90°.
 */
export function computeCoverage(
  pattern: GainPattern,
  fan: readonly RayResult[],
  frequencyMHz: number,
  ground: GroundConstants,
  maxHops = 3,
): CoverageMap | undefined {
  // First pass over the widest possible range finds the farthest cell that
  // will be drawn; the second recomputes at that radius for finer bins.
  const wide = mapCoverage(pattern, fan, frequencyMHz, ground, maxHops);
  if (!wide) return undefined;
  let lastBin = 0;
  for (let cell = 0; cell < wide.relativeDb.length; cell++) {
    if (wide.relativeDb[cell]! >= COVERAGE_FLOOR_DB) lastBin = Math.max(lastBin, cell % COVERAGE_BINS);
  }
  const radius = Math.min(wide.maxRangeKm, (lastBin + 1) * wide.binKm * 1.05);
  return mapCoverage(pattern, fan, frequencyMHz, ground, maxHops, radius) ?? wide;
}

/** The map out to a fixed radius (or the farthest significant landing). */
export function mapCoverage(
  pattern: GainPattern,
  fan: readonly RayResult[],
  frequencyMHz: number,
  ground: GroundConstants,
  maxHops: number,
  radiusKm?: number,
): CoverageMap | undefined {
  if (fan.length < 2 || pattern.phiSteps < 1) return undefined;
  const step = fan[1]!.elevationDeg - fan[0]!.elevationDeg;
  const sectors = pattern.phiSteps;
  const widthRad = Math.min(360, pattern.dPhi) * DEG;

  // Plot radius: the farthest landing of any ray within the floor of the
  // pattern's peak, after the last hop.
  let peakGain = 0;
  for (let pi = 0; pi < sectors; pi++) {
    for (const ray of fan) peakGain = Math.max(peakGain, gainAt(pattern, pi, ray.elevationDeg));
  }
  if (!(peakGain > 0)) return undefined;
  const significant = peakGain * 10 ** (COVERAGE_FLOOR_DB / 10);
  let farthest = 0;
  for (let pi = 0; pi < sectors; pi++) {
    for (const ray of fan) {
      if (ray.returns && gainAt(pattern, pi, ray.elevationDeg) >= significant) {
        farthest = Math.max(farthest, ray.rangeKm! * maxHops);
      }
    }
  }
  if (!(farthest > 0)) return undefined;
  const maxRangeKm = Math.min(radiusKm ?? farthest, Math.PI * EARTH_RADIUS_KM * 0.999);
  const binKm = maxRangeKm / COVERAGE_BINS;

  const power = new Float64Array(sectors * COVERAGE_BINS);
  const hopPower = new Float64Array(sectors * COVERAGE_BINS * maxHops);

  for (let pi = 0; pi < sectors; pi++) {
    for (let k = 0; k + 1 < fan.length; k++) {
      const a = fan[k]!, b = fan[k + 1]!;
      if (!a.returns || !b.returns) continue;
      const mid = (a.elevationDeg + b.elevationDeg) / 2;
      const radiated = gainAt(pattern, pi, mid) * Math.cos(mid * DEG) * step * DEG * widthRad / (4 * Math.PI);
      if (!(radiated > 0)) continue;
      const reflect = groundReflectionPower(ground, frequencyMHz, mid);
      let carried = radiated;
      for (let n = 1; n <= maxHops; n++) {
        if (n > 1) carried *= reflect;
        const lo = Math.min(a.rangeKm!, b.rangeKm!) * n;
        const hi = Math.max(a.rangeKm!, b.rangeKm!) * n;
        if (lo >= maxRangeKm) continue;
        // Spread the band's power evenly along its ground stretch, then
        // into the bins it crosses.
        const span = Math.max(hi - lo, 1e-6);
        const first = Math.floor(lo / binKm);
        const last = Math.min(COVERAGE_BINS - 1, Math.floor(hi / binKm));
        for (let bin = first; bin <= last; bin++) {
          const overlap = Math.min(hi, (bin + 1) * binKm) - Math.max(lo, bin * binKm);
          if (overlap <= 0 && span > 1e-6) continue;
          const share = span > 1e-6 ? overlap / span : 1;
          const cell = pi * COVERAGE_BINS + bin;
          power[cell] += carried * share;
          hopPower[cell * maxHops + n - 1] += carried * share;
        }
      }
    }
  }

  const density = new Float64Array(power.length);
  let maxDensity = 0;
  for (let pi = 0; pi < sectors; pi++) {
    for (let bin = 0; bin < COVERAGE_BINS; bin++) {
      const cell = pi * COVERAGE_BINS + bin;
      density[cell] = power[cell]! / ringArea(bin * binKm, (bin + 1) * binKm, widthRad);
      maxDensity = Math.max(maxDensity, density[cell]!);
    }
  }
  const relativeDb = new Float64Array(power.length);
  const dominantHops = new Uint8Array(power.length);
  for (let cell = 0; cell < power.length; cell++) {
    relativeDb[cell] = density[cell]! > 0 ? 10 * Math.log10(density[cell]! / maxDensity) : -Infinity;
    let best = 0;
    for (let n = 0; n < maxHops; n++) {
      if (hopPower[cell * maxHops + n]! > (best ? hopPower[cell * maxHops + best - 1]! : 0)) best = n + 1;
    }
    dominantHops[cell] = best;
  }
  return {
    maxRangeKm,
    binKm,
    bearingsDeg: Array.from({ length: sectors }, (_, pi) => phiToBearingDeg(pi * pattern.dPhi)),
    sectorWidthDeg: Math.min(360, pattern.dPhi),
    relativeDb,
    dominantHops,
    peakDensity: maxDensity,
  };
}
