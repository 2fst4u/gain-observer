// Non-deviative (D-layer) absorption of a skywave hop.
//
// Source: K. Davies, "Ionospheric Radio Propagation", National Bureau of
// Standards Monograph 80, US Department of Commerce, 1965 (a work of the US
// Government, not subject to copyright), section 5.3.4.5:
//
//   La = 430 (1 + 0.0035 R) cos^0.75(χ) sec(φD) (f ± fL)^-2   dB per hop   (5.19)
//
// "a formula given by Rawer", based on vertical-incidence measurements at
// Slough, for middle latitudes; R is the sunspot number, χ the solar zenith
// angle, φD the angle of incidence in the D region, f and fL (the longitudinal
// gyrofrequency) in MHz, + for the ordinary wave. For winter months in dipole
// latitudes 40°–70° the result is multiplied by the factors of table 5.1
// (the "winter anomaly"); on individual days the factor varies from below 1
// to about 2.

const DEG = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;
/** Representative height of the absorbing D region, km, for sec φD. */
export const D_REGION_HEIGHT_KM = 90;

/** Angle of incidence, degrees, at a height for a ray leaving the ground at an elevation. */
export function incidenceAtHeightDeg(elevationDeg: number, heightKm: number): number {
  const s = EARTH_RADIUS_KM * Math.cos(elevationDeg * DEG) / (EARTH_RADIUS_KM + heightKm);
  return Math.asin(Math.min(1, s)) / DEG;
}

/**
 * Davies table 5.1: winter-anomaly multiplier for dipole latitudes 40°–70°.
 * Northern hemisphere Nov, Dec, Jan, Feb = 1.2, 1.5, 1.5, 1.2; southern
 * hemisphere May–Aug likewise. 1 elsewhere.
 */
export function winterAnomalyFactor(month: number, dipoleLatitudeDeg: number): number {
  const lat = Math.abs(dipoleLatitudeDeg);
  if (lat < 40 || lat > 70) return 1;
  const north: Record<number, number> = { 11: 1.2, 12: 1.5, 1: 1.5, 2: 1.2 };
  const south: Record<number, number> = { 5: 1.2, 6: 1.5, 7: 1.5, 8: 1.2 };
  return (dipoleLatitudeDeg >= 0 ? north : south)[month] ?? 1;
}

export interface AbsorptionInputs {
  /** Sunspot number (12-month smoothed). */
  readonly sunspotNumber: number;
  /** Solar zenith angle at the hop's absorbing region, degrees. */
  readonly solarZenithDeg: number;
  /** Elevation of the ray at the ground, degrees. */
  readonly elevationDeg: number;
  readonly frequencyMHz: number;
  /** Longitudinal gyrofrequency, MHz. */
  readonly longitudinalGyroMHz: number;
  /** Table 5.1 factor (1 outside winter or the 40°–70° dipole band). */
  readonly winterFactor?: number;
}

/** Absorption of one hop, dB (ordinary wave). Zero with the sun below the horizon. */
export function hopAbsorptionDb(input: AbsorptionInputs): number {
  if (!(input.solarZenithDeg < 90)) return 0;
  const cosChi = Math.cos(input.solarZenithDeg * DEG);
  const phiD = incidenceAtHeightDeg(input.elevationDeg, D_REGION_HEIGHT_KM) * DEG;
  const effective = input.frequencyMHz + Math.max(0, input.longitudinalGyroMHz);
  const r = Math.max(0, input.sunspotNumber);
  return 430 * (1 + 0.0035 * r) * cosChi ** 0.75 / Math.cos(phiD) / effective ** 2 * (input.winterFactor ?? 1);
}
