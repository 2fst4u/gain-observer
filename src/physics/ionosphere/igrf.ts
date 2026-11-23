// Magnetic inclination from IGRF-13, for the modified dip latitude (MODIP)
// the CCIR/URSI foF2 maps are expanded in.
//
// Ported from PyIRI 0.1.7 `igrf_library.py` (MIT licence, Copyright (c) 2023
// victoriyaforsythe; see THIRD_PARTY_NOTICES.md), which in turn follows the
// IAGA reference synthesis. Coefficients: IGRF-13, IAGA Working Group V-MOD.

import igrfData from './data/igrf.json';

const NMAX = 13;
const DEG = Math.PI / 180;
/** IGRF reference radius, km. */
const REFERENCE_RADIUS_KM = 6371.2;

interface IgrfData {
  readonly epochs: readonly number[];
  readonly coeffs: readonly (readonly number[])[];
}

const IGRF = igrfData as IgrfData;

/** Decimal year as PyIRI computes it: (day-of-year − 1) / days in the year. */
export function decimalYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const doy = Math.round((Date.UTC(year, month - 1, day) - start) / 86_400_000) + 1;
  const daysInYear = Math.round((Date.UTC(year + 1, 0, 1) - start) / 86_400_000);
  return year + (doy - 1) / daysInYear;
}

/** Coefficients at a date by linear interpolation between the bundled
 * epochs, extrapolating from the end segments (as scipy's interp1d does). */
function coefficientsAt(dateDecimal: number): number[] {
  const { epochs, coeffs } = IGRF;
  let i = 0;
  while (i < epochs.length - 2 && dateDecimal > epochs[i + 1]!) i++;
  const t0 = epochs[i]!, t1 = epochs[i + 1]!;
  const f = (dateDecimal - t0) / (t1 - t0);
  const a = coeffs[i]!, b = coeffs[i + 1]!;
  return a.map((value, k) => value + f * (b[k]! - value));
}

/** Geodetic height and colatitude to geocentric radius and colatitude (WGS-84). */
function geodeticToGeocentric(heightKm: number, geodeticColatDeg: number) {
  const eqrad = 6378.137;
  const flat = 1 / 298.257223563;
  const plrad = eqrad * (1 - flat);
  const ctgd = Math.cos(geodeticColatDeg * DEG);
  const stgd = Math.sin(geodeticColatDeg * DEG);
  const a2 = eqrad * eqrad, a4 = a2 * a2;
  const b2 = plrad * plrad, b4 = b2 * b2;
  const c2 = ctgd * ctgd, s2 = 1 - c2;
  const rho = Math.sqrt(a2 * s2 + b2 * c2);
  const rad = Math.sqrt(heightKm * (heightKm + 2 * rho) + (a4 * s2 + b4 * c2) / rho ** 2);
  const cd = (heightKm + rho) / rad;
  const sd = (a2 - b2) * ctgd * stgd / (rho * rad);
  const cthc = Math.min(1, Math.max(-1, ctgd * cd - stgd * sd));
  return { radiusKm: rad, colatDeg: Math.acos(cthc) / DEG, sd, cd };
}

/** Schmidt semi-normalised associated Legendre functions and their theta
 * derivatives, packed as in PyIRI: P[n][m] for m ≤ n, dP in P[m][n + 1]. */
function legendre(thetaDeg: number): number[][] {
  const costh = Math.cos(thetaDeg * DEG);
  const sinth = Math.sqrt(1 - costh * costh);
  const P = Array.from({ length: NMAX + 1 }, () => new Array<number>(NMAX + 2).fill(0));
  P[0]![0] = 1;
  P[1]![1] = sinth;
  const rootn = Array.from({ length: 2 * NMAX * NMAX + 1 }, (_, i) => Math.sqrt(i));
  for (let m = 0; m < NMAX; m++) {
    const tmp = rootn[m + m + 1]! * P[m]![m]!;
    P[m + 1]![m] = costh * tmp;
    if (m > 0) P[m + 1]![m + 1] = sinth * tmp / rootn[m + m + 2]!;
    for (let n = m + 2; n <= NMAX; n++) {
      const d = n * n - m * m;
      const e = n + n - 1;
      P[n]![m] = (e * costh * P[n - 1]![m]! - rootn[d - e]! * P[n - 2]![m]!) / rootn[d]!;
    }
  }
  P[0]![2] = -P[1]![1]!;
  P[1]![2] = P[1]![0]!;
  for (let n = 2; n <= NMAX; n++) {
    P[0]![n + 1] = -Math.sqrt((n * n + n) / 2) * P[n]![1]!;
    P[1]![n + 1] = (Math.sqrt(2 * (n * n + n)) * P[n]![0]! - Math.sqrt(n * n + n - 2) * P[n]![2]!) / 2;
    for (let m = 2; m < n; m++) {
      P[m]![n + 1] = 0.5 * Math.sqrt((n + m) * (n - m + 1)) * P[n]![m - 1]! -
        Math.sqrt((n + m + 1) * (n - m)) * P[n]![m + 1]!;
    }
    P[n]![n + 1] = Math.sqrt(2 * n) * P[n]![n - 1]! / 2;
  }
  return P;
}

/**
 * Magnetic inclination (dip), degrees, positive downward, at a geodetic
 * latitude/longitude and height. Synthesised to degree 13.
 */
export function inclinationDeg(
  dateDecimal: number,
  longitudeDeg: number,
  latitudeDeg: number,
  heightKm = 300,
): number {
  const coeffs = coefficientsAt(dateDecimal);
  const geo = geodeticToGeocentric(heightKm, 90 - latitudeDeg);
  const theta = geo.colatDeg;
  const radius = geo.radiusKm / REFERENCE_RADIUS_KM;
  const P = legendre(theta);
  const sinth = P[1]![1]!;
  const phi = longitudeDeg * DEG;
  let rN = radius ** -3;
  let br = 0, bt = 0, bp = 0;
  let num = 0;
  for (let n = 1; n <= NMAX; n++) {
    br += (n + 1) * P[n]![0]! * rN * coeffs[num]!;
    bt += -P[0]![n + 1]! * rN * coeffs[num]!;
    num += 1;
    for (let m = 1; m <= n; m++) {
      const cos = Math.cos(m * phi), sin = Math.sin(m * phi);
      const g = coeffs[num]!, h = coeffs[num + 1]!;
      br += (n + 1) * P[n]![m]! * rN * (g * cos + h * sin);
      bt += -P[m]![n + 1]! * rN * (g * cos + h * sin);
      const divP = theta === 0 ? P[m]![n + 1]! : theta === 180 ? -P[m]![n + 1]! : P[n]![m]! / sinth;
      bp += m * divP * rN * (g * sin - h * cos);
      num += 2;
    }
    rN /= radius;
  }
  let X = -bt;
  const Y = bp;
  let Z = -br;
  const t = X;
  X = X * geo.cd + Z * geo.sd;
  Z = Z * geo.cd - t * geo.sd;
  return Math.atan2(Z, Math.hypot(X, Y)) / DEG;
}

/** Modified dip latitude (Rawer): atan(I / √cos φ). */
export function modipDeg(inclination: number, latitudeDeg: number): number {
  const inc = Math.max(-90, Math.min(90, inclination));
  return Math.atan((inc / Math.sqrt(Math.cos(latitudeDeg * DEG))) * DEG) / DEG;
}

/** Magnetic dip latitude: atan(½ tan I). */
export function dipLatitudeDeg(inclination: number): number {
  const inc = Math.max(-90, Math.min(90, inclination));
  return Math.atan(0.5 * Math.tan(inc * DEG)) / DEG;
}
