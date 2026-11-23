// Monthly-median ionosphere at one place and time: IRI F2, F1 and E layer
// peaks and the Epstein-layer electron-density profile built from them.
//
// Ported from PyIRI 0.1.7 `main_library.py` (MIT licence, Copyright (c) 2023
// victoriyaforsythe; see THIRD_PARTY_NOTICES.md): the path of
// `IRI_density_1day` with URSI-88 foF2 and CCIR M(3000)F2 maps, which is the
// classic IRI F2 option. The port evaluates a single location instead of a
// grid; one grid-dependent normalisation is fixed (see `f1Layer`).
//
// Reference: Forsythe et al. (2023), PyIRI: Whole-Globe Approach to the
// International Reference Ionosphere Modeling Implemented in Python, Space
// Weather; Bilitza et al. (2022), The International Reference Ionosphere
// model: A review and description of an ionospheric benchmark, Rev. Geophys.

import { decimalYear, dipLatitudeDeg, inclinationDeg, modipDeg } from './igrf';

const DEG = Math.PI / 180;

/** foF2 maps: 13 diurnal × 76 global terms; M(3000)F2: 9 × 49. */
const FOF2 = { nj: 13, nk: 76, qm: [12, 12, 9, 5, 2, 1, 1, 1, 1] } as const;
const M3000 = { nj: 9, nk: 49, qm: [7, 8, 6, 3, 2, 1, 1] } as const;

/** One month's maps, flat in Fortran order over [j, k, solar level]. */
export interface MonthCoefficients {
  readonly foF2: ArrayLike<number>;
  readonly m3000: ArrayLike<number>;
}

export type CoefficientLoader = (month: number) => Promise<MonthCoefficients>;

const monthModules = import.meta.glob<MonthCoefficients>('./data/month-*.json', { import: 'default' });

/** Load a month's coefficients (code-split: each month is its own chunk). */
export const loadMonthCoefficients: CoefficientLoader = async (month) => {
  const key = `./data/month-${String(month).padStart(2, '0')}.json`;
  const load = monthModules[key];
  if (!load) throw new Error(`No ionosphere coefficients for month ${month}`);
  return load();
};

export interface LayerParameters {
  /** Critical frequencies, MHz. foF1 is NaN when there is no F1 layer. */
  readonly foF2: number;
  readonly foF1: number;
  readonly foE: number;
  /** Peak heights, km. hmF1 is NaN when there is no F1 layer. */
  readonly hmF2: number;
  readonly hmF1: number;
  readonly hmE: number;
  /** Epstein thickness parameters, km. */
  readonly bF2Bot: number;
  readonly bF2Top: number;
  readonly bF1Bot: number;
  readonly bEBot: number;
  readonly bETop: number;
  /** Propagation factor M(3000)F2. */
  readonly m3000: number;
  readonly modipDeg: number;
  /** Solar zenith used for the E and F1 layers (mid-month, this UT). */
  readonly solarZenithDeg: number;
  /** Ionosonde index IG12 the parameters were interpolated to. */
  readonly ig12: number;
}

// ---- solar index conversions (sunspot series version 2) ----

export function r12ToF107(r12: number): number {
  return 63.75 + 0.728 * r12 + 8.9e-4 * r12 ** 2;
}

export function f107ToR12(f107: number): number {
  const a = 8.9e-4, b = 0.728, c = 63.75 - f107;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

export function r12ToIg12(r12: number): number {
  return -11.5634 + 1.5332 * r12 - 0.0031 * r12 ** 2;
}

export function ig12ToR12(ig12: number): number {
  const a = -0.0031, b = 1.5332, c = -11.5634 - ig12;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

export function f107ToIg12(f107: number): number {
  return r12ToIg12(f107ToR12(f107));
}

function fexp(x: number): number {
  if (x > 80) return 5.5406e34;
  if (x < -80) return 1.8049e-35;
  return Math.exp(x);
}

/** Electron density, m⁻³, of a plasma frequency in MHz. */
export function freqToDensity(freqMHz: number): number {
  return 1.24e10 * freqMHz ** 2;
}

export function densityToFreq(density: number): number {
  return Math.sqrt(density / 1.24e10);
}

// ---- sun ----

function julianDate(year: number, month: number, day: number, hour: number, minute: number): number {
  return 367 * year
    - Math.trunc((7 * (year + Math.trunc((month + 9) / 12))) / 4)
    + Math.trunc((275 * month) / 9) + day + 1721013.5
    + (hour + minute / 60) / 24
    - 0.5 * Math.sign(100 * year + month - 190002.5)
    + 0.5;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Subsolar longitude and latitude, degrees. */
export function subsolarPoint(jd: number): { lon: number; lat: number } {
  const t = (jd - 2451545) / 36525;
  const lms = mod(280.46 + 36000.771 * t, 360);
  const anom = mod(357.527723 + 35999.05034 * t, 360);
  const ecplon = lms + 1.914666471 * Math.sin(anom * DEG) + 0.01999464 * Math.sin(2 * anom * DEG);
  const epsilon = 23.439291 - 0.0130042 * t;
  const dec = Math.asin(Math.sin(epsilon * DEG) * Math.sin(ecplon * DEG)) / DEG;
  let gmst = 67310.54841 + (876600 * 3600 + 8640184.812866) * t + 0.93104 * t ** 2 - 6.2e-6 * t ** 3;
  gmst = mod(gmst, 86400) / 240;
  const num = Math.cos(epsilon * DEG) * Math.sin(ecplon * DEG) / Math.cos(dec * DEG);
  const den = Math.cos(ecplon * DEG) / Math.cos(dec * DEG);
  const ra = Math.atan2(num, den) / DEG;
  let lon = -(gmst - ra);
  lon -= Math.trunc(Math.abs(lon) / 360) * 360 * Math.sign(lon);
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lon, lat: dec };
}

/** Solar zenith at a location on the 15th of a month at a UT hour, as PyIRI
 * evaluates it for the monthly-median E and F1 layers. */
export function midMonthSolarZenithDeg(year: number, month: number, utHour: number, lon: number, lat: number): number {
  const hour = Math.trunc(utHour);
  const minute = Math.trunc((utHour - hour) * 60);
  const sun = subsolarPoint(julianDate(year, month, 15, hour, minute));
  const cosZ = Math.sin(sun.lat * DEG) * Math.sin(lat * DEG) +
    Math.cos(sun.lat * DEG) * Math.cos(lat * DEG) * Math.cos((sun.lon - lon) * DEG);
  return Math.acos(Math.max(-1, Math.min(1, cosZ))) / DEG;
}

function effectiveSolarZenith(chi: number): number {
  const chi0 = 86.23292796211615;
  const f1 = 90 - 0.24 * fexp(20 - 0.2 * chi);
  const ee = fexp(12 * (chi - chi0));
  const value = (f1 * ee + chi) / (ee + 1);
  return Number.isFinite(value) ? value : 0;
}

// ---- map evaluation ----

function diurnal(nj: number, utHour: number): number[] {
  const hou = (15 * utHour - 180) * DEG;
  const D: number[] = [];
  for (let j = 0; j < nj && D.length < nj; j++) {
    for (let i = 0; i < 2; i++) {
      if (D.length >= nj) break;
      D.push(i % 2 === 0 ? Math.cos(hou * (i + j)) : Math.sin(hou * (i + j)));
    }
  }
  return D;
}

function globalFunctions(qm: readonly number[], nk: number, lon: number, lat: number, modip: number): number[] {
  const G: number[] = [];
  for (let j = 0; j < qm.length; j++) {
    for (let i = 0; i < qm[j]!; i++) {
      for (let m = 0; m < 2; m++) {
        if (j === 0 && m === 1) continue; // sin(0·lon) is identically zero
        const f3 = m === 0 ? Math.cos(lon * j * DEG) : Math.sin(lon * j * DEG);
        G.push(Math.sin(modip * DEG) ** i * Math.cos(lat * DEG) ** j * f3);
      }
    }
  }
  if (G.length !== nk) throw new Error('global function count mismatch');
  return G;
}

function evaluateMap(
  coeffs: ArrayLike<number>,
  spec: { nj: number; nk: number; qm: readonly number[] },
  utHour: number,
  lon: number,
  lat: number,
  modip: number,
): [number, number] {
  const D = diurnal(spec.nj, utHour);
  const G = globalFunctions(spec.qm, spec.nk, lon, lat, modip);
  const out: [number, number] = [0, 0];
  for (let s = 0; s < 2; s++) {
    let sum = 0;
    for (let k = 0; k < spec.nk; k++) {
      let dj = 0;
      for (let j = 0; j < spec.nj; j++) dj += D[j]! * coeffs[j + spec.nj * (k + spec.nk * s)]!;
      sum += dj * G[k]!;
    }
    out[s] = sum;
  }
  return out;
}

// ---- layers at the two solar levels IG12 = 0 and 100 ----

type Levels = [number, number];
const IG_LEVELS: Levels = [0, 100];

function foE(month: number, chiEff: number, lat: number, f107: number): number {
  const seas = [11, 12, 1, 2].includes(month) ? -1 : [3, 4, 9, 10].includes(month) ? 0 : 1;
  const ee = fexp(0.3 * lat * DEG);
  const seasp = seas * (ee - 1) / (ee + 1);
  // A negative cosine gives NaN here, which PyIRI then zeroes.
  const value = Math.sqrt(0.49 + (1.112 - 0.019 * seasp) ** 2 * Math.sqrt(f107) * Math.cos(chiEff * DEG) ** 0.6);
  return Number.isFinite(value) ? value : 0;
}

/**
 * F1 critical frequency, or NaN where the F1 layer is absent (the sun lower
 * than about 70.5° zenith). PyIRI normalises the F1/E blending weight by its
 * maximum over the whole evaluated grid, which for a global grid is the cap
 * of 10; at a single point that maximum would be the point itself. The cap is
 * used here so a single point matches the global-grid result.
 */
function f1Layer(chi: number, magDipLatAbs: number, r12: number, foEValue: number): number {
  const n = 0.093 + 0.0046 * magDipLatAbs - 0.000054 * magDipLatAbs ** 2 + 0.0003 * r12;
  const f100 = 5.348 + 0.011 * magDipLatAbs - 0.00023 * magDipLatAbs ** 2;
  const f0 = 4.35 + 0.0058 * magDipLatAbs - 0.00012 * magDipLatAbs ** 2;
  const fs = f0 + (f100 - f0) * r12 / 100;
  const cos = Math.cos(chi * DEG);
  const foF1 = cos > 0 ? fs * cos ** n : 0;
  const weight = Math.min(10, -10 + 30 * cos) / 10;
  if (weight < 0) return NaN;
  return weight * foF1 + Math.abs(weight - 1) * foEValue;
}

interface MonthLayers {
  foF2: Levels; m3000: Levels; foE: Levels; foF1: Levels;
  hmF2: Levels; hmF1: Levels; hmE: Levels;
  bF2Bot: Levels; bF2Top: Levels; bF1Bot: Levels; bEBot: Levels; bETop: Levels;
  modip: number; solarZenith: number;
}

function monthLayers(
  coeffs: MonthCoefficients,
  year: number,
  month: number,
  utHour: number,
  lon: number,
  lat: number,
): MonthLayers {
  const inc = inclinationDeg(decimalYear(year, month, 15), lon, lat, 300);
  const modip = modipDeg(inc, lat);
  const dipLatAbs = Math.abs(dipLatitudeDeg(inc));
  const foF2 = evaluateMap(coeffs.foF2, FOF2, utHour, lon, lat, modip);
  const m3000 = evaluateMap(coeffs.m3000, M3000, utHour, lon, lat, modip);
  const chi = midMonthSolarZenithDeg(year, month, utHour, lon, lat);
  const chiEff = effectiveSolarZenith(chi);
  const r12 = IG_LEVELS.map(ig12ToR12) as Levels;
  const fE = IG_LEVELS.map((ig) => foE(month, chiEff, lat, r12ToF107(ig12ToR12(ig)))) as Levels;
  const fF1 = [0, 1].map((s) => f1Layer(chi, dipLatAbs, r12[s]!, fE[s]!)) as Levels;

  const hmE: Levels = [110, 110];
  const hmF2 = [0, 1].map((s) => {
    const ratio = Math.max(1.7, foF2[s]! / fE[s]!);
    const R = r12[s]!;
    const f1 = 0.00232 * R + 0.222;
    const f2 = 1 - R / 150 * Math.exp(-((modip / 40) ** 2));
    const f3 = 1.2 - 0.0116 * Math.exp(R / 41.84);
    const f4 = 0.096 * (R - 25) / 150;
    return 1490 / (m3000[s]! + f1 * f2 / (ratio - f3) + f4) - 176;
  }) as Levels;

  const bF2Bot = [0, 1].map((s) => {
    const nm = freqToDensity(foF2[s]!);
    const dNdH = 0.01 * fexp(-3.467 + 1.714 * Math.log(foF2[s]!) + 2.02 * Math.log(m3000[s]!));
    return 3.85e-12 * nm / dNdH;
  }) as Levels;
  const bF2Top = [0, 1].map((s) => {
    const k = 3.22 - 0.0538 * foF2[s]! - 0.00664 * hmF2[s]! + 0.113 * hmF2[s]! / bF2Bot[s]! + 0.00257 * r12[s]!;
    const x = (k * bF2Bot[s]! - 150) / 100;
    return (100 * x + 150) / (0.041163 * x ** 2 - 0.183981 * x + 1.424472);
  }) as Levels;

  const hmF1 = [0, 1].map((s) => {
    const b = 2 - 4 * freqToDensity(foF2[s]!) / freqToDensity(fF1[s]!);
    const d = b * b - 4;
    if (!(d >= 0)) return NaN;
    const x = (-b - Math.sqrt(d)) / 2;
    if (!(x > 0)) return NaN;
    const h = bF2Bot[s]! * Math.log(x) + hmF2[s]!;
    return h <= 110 ? NaN : h;
  }) as Levels;
  const bF1Bot = [0, 1].map((s) => 0.5 * (hmF1[s]! - hmE[s]!)) as Levels;

  return {
    foF2, m3000, foE: fE, foF1: fF1, hmF2, hmF1, hmE, bF2Bot, bF2Top, bF1Bot,
    bEBot: [5, 5], bETop: [7, 7], modip, solarZenith: chi,
  };
}

/** The two monthly medians bracketing a date and their weights (PyIRI's
 * `day_of_the_month_corr`: medians are centred on the 15th). */
export function bracketingMonths(year: number, month: number, day: number) {
  const mid = Date.UTC(year, month - 1, 15);
  const event = Date.UTC(year, month - 1, day);
  const shifted = new Date(mid + (day >= 15 ? 30 : -30) * 86_400_000);
  const other = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 15);
  const [t0, t1] = day >= 15 ? [mid, other] : [other, mid];
  const days = (ms: number) => Math.round(ms / 86_400_000);
  const span = days(t1 - t0);
  const before = new Date(t0), after = new Date(t1);
  return {
    before: { year: before.getUTCFullYear(), month: before.getUTCMonth() + 1 },
    after: { year: after.getUTCFullYear(), month: after.getUTCMonth() + 1 },
    weightBefore: days(t1 - event) / span,
    weightAfter: days(event - t0) / span,
  };
}

export interface IonosphereInputs {
  /** UTC instant. Day and hour pick the bracketing monthly medians and UT. */
  readonly date: Date;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  /** Solar 10.7 cm flux, solar flux units; a 12-month smoothed value suits
   * these monthly-median maps. */
  readonly f107: number;
}

/**
 * Monthly-median layer parameters at a place and time. `coeffs` maps month
 * number (1–12) to that month's maps; both bracketing months are needed.
 */
export function ionosphereParameters(
  coeffs: (month: number) => MonthCoefficients,
  input: IonosphereInputs,
): LayerParameters {
  const year = input.date.getUTCFullYear();
  const month = input.date.getUTCMonth() + 1;
  const day = input.date.getUTCDate();
  const ut = input.date.getUTCHours() + input.date.getUTCMinutes() / 60 + input.date.getUTCSeconds() / 3600;
  const lon = input.longitudeDeg, lat = input.latitudeDeg;
  const span = bracketingMonths(year, month, day);
  const a = monthLayers(coeffs(span.before.month), span.before.year, span.before.month, ut, lon, lat);
  const b = monthLayers(coeffs(span.after.month), span.after.year, span.after.month, ut, lon, lat);
  const ig12 = f107ToIg12(input.f107);
  const pick = (get: (m: MonthLayers) => Levels): number => {
    const lo = get(a)[0] * span.weightBefore + get(b)[0] * span.weightAfter;
    const hi = get(a)[1] * span.weightBefore + get(b)[1] * span.weightAfter;
    return lo * (100 - ig12) / 100 + hi * ig12 / 100;
  };
  // Densities below 1e6 m⁻³ are floored, as PyIRI does for F2 and E.
  const floorFreq = (f: number) => densityToFreq(Math.max(1e6, Number.isFinite(f) ? freqToDensity(f) : 0));
  return {
    foF2: floorFreq(pick((m) => m.foF2)),
    foF1: pick((m) => m.foF1),
    foE: floorFreq(pick((m) => m.foE)),
    hmF2: pick((m) => m.hmF2),
    hmF1: pick((m) => m.hmF1),
    hmE: pick((m) => m.hmE),
    bF2Bot: pick((m) => m.bF2Bot),
    bF2Top: pick((m) => m.bF2Top),
    bF1Bot: pick((m) => m.bF1Bot),
    bEBot: pick((m) => m.bEBot),
    bETop: pick((m) => m.bETop),
    m3000: pick((m) => m.m3000),
    modipDeg: a.modip * span.weightBefore + b.modip * span.weightAfter,
    solarZenithDeg: a.solarZenith * span.weightBefore + b.solarZenith * span.weightAfter,
    ig12,
  };
}

// ---- electron-density profile ----

function epstein(A: number, hm: number, B: number, h: number): number {
  const alpha = B !== 0 ? (h - hm) / B : 30;
  if (alpha > 25) return 0;
  const e = fexp(alpha);
  return A * e / (1 + e) ** 2;
}

function epsteinTop(A: number, hm: number, B: number, h: number): number {
  const g = 0.125, r = 100;
  const dh = h - hm;
  const z = dh / (B * (1 + (r * g * dh / (r * B + g * dh))));
  const e = fexp(z);
  return e > 1e11 ? A / e : A * e / (e + 1) ** 2;
}

/** Electron density, m⁻³, at an altitude, km (PyIRI's `EDP_builder`). */
export function electronDensity(p: LayerParameters, h: number): number {
  const nmF2 = freqToDensity(p.foF2);
  const nmF1 = freqToDensity(p.foF1);
  const nmE = freqToDensity(p.foE);
  const A1 = 4 * nmF2, A2 = 4 * nmF1, A3 = 4 * nmE;
  const bF1Bot = p.bF1Bot <= 0 ? 10 : p.bF1Bot;
  const bF2Top = p.bF2Top <= 0 ? 30 : p.bF2Top;
  let dF2 = 0, dF1 = 0, dE = 0;
  if (h >= p.hmF2) dF2 = epsteinTop(A1, p.hmF2, bF2Top, h);
  if (h <= p.hmE) dE = epstein(A3, p.hmE, p.bEBot, h);
  const hasF1 = Number.isFinite(nmF1) && Number.isFinite(bF1Bot) && Number.isFinite(p.hmF1);
  if (hasF1 && h < p.hmF2 && h >= p.hmF1) dF2 = epstein(A1, p.hmF2, p.bF2Bot, h);
  if (h > p.hmE && h < p.hmF1) {
    const span = p.hmF1 - p.hmE;
    dE = epstein(A3, p.hmE, p.bETop, h) * (1 - ((h - p.hmE) / span) ** 4);
    dF1 = epstein(A2, p.hmF1, bF1Bot, h) * (1 - ((p.hmF1 - h) / span) ** 4);
  }
  if (!hasF1 && h < p.hmF2 && h > p.hmE) {
    const span = p.hmF2 - p.hmE;
    dE = epstein(A3, p.hmE, p.bETop, h) * (1 - ((h - p.hmE) / span) ** 4);
    dF2 = epstein(A1, p.hmF2, p.bF2Bot, h) * (1 - ((p.hmF2 - h) / span) ** 4);
  }
  const total = dF2 + dF1 + dE;
  return total <= 1 ? 1 : total;
}

/** Plasma frequency, MHz, at an altitude, km. */
export function plasmaFrequencyMHz(p: LayerParameters, h: number): number {
  return densityToFreq(electronDensity(p, h));
}
