// Ray paths through a spherically stratified ionosphere.
//
// With no geomagnetic field and no collisions, the refractive index is
// n² = 1 − fN²/f², and Bouguer's law n·r·cos β = R₀ cos β₀ holds along the
// ray. A ray turns where n·r = R₀ cos β₀; if it never does it escapes. The
// ground angle to the turning point is
//     θ = ∫ a / (r √(n²r² − a²)) dr,  a = R₀ cos β₀,
// and the single-hop ground range is 2R₀θ (the layers are assumed the same
// along the path). This is the ordinary (O) wave in the no-field
// approximation: the extraordinary wave reflects up to about fH/2 higher.

const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;

export interface Profile {
  /** Lowest and highest altitudes of the sampled profile, km. */
  readonly h0: number;
  readonly dh: number;
  /** Plasma frequency squared, MHz², at h0 + i·dh. */
  readonly fN2: Float64Array;
}

/** Sample a plasma-frequency profile once so many rays can reuse it. */
export function sampleProfile(
  plasmaFrequencyMHz: (hKm: number) => number,
  h0 = 50,
  h1 = 1000,
  dh = 0.5,
): Profile {
  const n = Math.round((h1 - h0) / dh) + 1;
  const fN2 = new Float64Array(n);
  for (let i = 0; i < n; i++) fN2[i] = plasmaFrequencyMHz(h0 + i * dh) ** 2;
  return { h0, dh, fN2 };
}

export interface RayResult {
  readonly elevationDeg: number;
  /** False where the ray passes through the ionosphere. */
  readonly returns: boolean;
  /** Single-hop ground range, km; undefined when the ray escapes. */
  readonly rangeKm?: number;
  /** Height of the turning point, km. */
  readonly apexKm?: number;
}

/** g(h) = n²r² − a² with linear interpolation of fN² between samples. */
function makeG(profile: Profile, f2: number, a2: number) {
  const { h0, dh, fN2 } = profile;
  return (h: number) => {
    const x = (h - h0) / dh;
    const i = Math.min(fN2.length - 2, Math.max(0, Math.floor(x)));
    const t = x - i;
    const p = fN2[i]! + t * (fN2[i + 1]! - fN2[i]!);
    const r = EARTH_RADIUS_KM + h;
    return r * r * (1 - p / f2) - a2;
  };
}

/** Gauss–Legendre nodes and weights on [0, 1]. */
function gaussLegendre01(n: number): { x: Float64Array; w: Float64Array } {
  const x = new Float64Array(n), w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5));
    let dp = 0;
    for (let iter = 0; iter < 100; iter++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k;
        p0 = p1; p1 = p2;
      }
      dp = n * (z * p1 - p0) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x[i] = (1 - z) / 2;
    w[i] = 1 / ((1 - z * z) * dp * dp); // 2/((1−z²)p'²) on [−1, 1], halved
  }
  return { x, w };
}

const GL = gaussLegendre01(48);
/** Subintervals in the substituted variable; more where the layer bends the ray. */
const PANELS = 8;

/**
 * Trace one ray of elevation `elevationDeg` at `frequencyMHz` through a
 * sampled profile. Below the profile's base the ray is straight.
 */
export function traceRay(profile: Profile, frequencyMHz: number, elevationDeg: number): RayResult {
  const beta = Math.min(90, Math.max(0, elevationDeg)) * DEG;
  const f2 = frequencyMHz * frequencyMHz;
  // cos(π/2) is not exactly zero in floating point.
  const a = elevationDeg >= 90 ? 0 : EARTH_RADIUS_KM * Math.cos(beta);
  const g = makeG(profile, f2, a * a);
  const { h0, dh, fN2 } = profile;

  // First turning point above the base: the first sign change of g.
  let hTurn = NaN;
  let previous = g(h0);
  if (previous <= 0) hTurn = h0;
  for (let i = 1; i < fN2.length && Number.isNaN(hTurn); i++) {
    const h = h0 + i * dh;
    const value = g(h);
    if (value <= 0) {
      hTurn = h - dh * value / (value - previous); // g is linear within a sample
    }
    previous = value;
  }
  if (Number.isNaN(hTurn)) return { elevationDeg, returns: false };

  const rBase = EARTH_RADIUS_KM + h0;
  const rTurn = EARTH_RADIUS_KM + hTurn;
  if (a === 0) return { elevationDeg, returns: true, rangeKm: 0, apexKm: hTurn };
  // Straight path from the ground to the profile base.
  let theta = Math.acos(Math.min(1, a / rBase)) - beta;
  // Inside: r = rTurn − (rTurn − rBase)·u², which cancels the 1/√ at rTurn.
  const span = rTurn - rBase;
  if (span > 0) {
    for (let p = 0; p < PANELS; p++) {
      for (let k = 0; k < GL.x.length; k++) {
        const u = (p + GL.x[k]!) / PANELS;
        const r = rTurn - span * u * u;
        const gv = g(r - EARTH_RADIUS_KM);
        if (gv <= 0) continue;
        theta += GL.w[k]! / PANELS * a * 2 * span * u / (r * Math.sqrt(gv));
      }
    }
  }
  return { elevationDeg, returns: true, rangeKm: 2 * EARTH_RADIUS_KM * theta, apexKm: hTurn };
}

/** Rays at a fixed elevation step, 0° to 90°. */
export function traceFan(profile: Profile, frequencyMHz: number, stepDeg = 0.5): RayResult[] {
  const n = Math.round(90 / stepDeg);
  return Array.from({ length: n + 1 }, (_, i) => traceRay(profile, frequencyMHz, i * stepDeg));
}

/**
 * Highest frequency that returns at an elevation (bisection on `traceRay`).
 * At 90° this is the profile's peak plasma frequency.
 */
export function maxReturningFrequencyMHz(profile: Profile, elevationDeg: number): number {
  let peak = 0;
  for (const v of profile.fN2) peak = Math.max(peak, v);
  let lo = 0.1, hi = Math.sqrt(peak) * 40;
  if (!traceRay(profile, lo, elevationDeg).returns) return 0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (traceRay(profile, mid, elevationDeg).returns) lo = mid; else hi = mid;
  }
  return lo;
}
