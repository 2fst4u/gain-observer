// Physical and engineering constants used throughout the app.
//
// IMPORTANT: We standardise internally on metric (SI) units. The UI may
// display imperial but the physics layer and stored state are always metric.

/** Speed of light in a vacuum, m/s. */
const SPEED_OF_LIGHT = 299_792_458;

/** Speed of light expressed as MHz·m (useful: λ_m = C_MHZ_M / f_MHz). */
const C_MHZ_M = SPEED_OF_LIGHT / 1_000_000;

/** System / feedline reference impedance, ohms. */
export const Z0_SYSTEM = 50;

/** Default wire radius for HF antennas, metres (≈ 14 AWG copper ~ 2 mm). */
export const DEFAULT_WIRE_RADIUS_M = 0.001;

/**
 * Convenience: wavelength in metres for a given frequency in MHz.
 */
export function wavelengthMeters(frequencyMHz: number): number {
  return C_MHZ_M / frequencyMHz;
}

/**
 * Convenience: half-wave dipole physical length (free-space), meters.
 * Applies the standard end-effect factor k ~ 0.95 for thin wire at HF.
 */
export function halfWaveLength(frequencyMHz: number, endEffect = 0.95): number {
  return wavelengthMeters(frequencyMHz) * 0.5 * endEffect;
}

/** Amateur HF band centres (MHz) for quick presets. */
export const HF_BAND_PRESETS: Array<{ name: string; mhz: number }> = [
  { name: '160m', mhz: 1.900 },
  { name: '80m', mhz: 3.650 },
  { name: '60m', mhz: 5.358 },
  { name: '40m', mhz: 7.100 },
  { name: '30m', mhz: 10.125 },
  { name: '20m', mhz: 14.150 },
  { name: '17m', mhz: 18.118 },
  { name: '15m', mhz: 21.200 },
  { name: '12m', mhz: 24.940 },
  { name: '10m', mhz: 28.500 },
];

/**
 * Ground conductivity presets (σ = S/m, εr = relative permittivity).
 * Sources: ITU-R P.527 and the ARRL Antenna Book 24th ed.
 */
export interface GroundPreset {
  readonly id: string;
  readonly label: string;
  readonly sigma: number;
  readonly epsilon: number;
  /** Short UI hint describing the material. */
  readonly hint: string;
}

export const GROUND_PRESETS: ReadonlyArray<GroundPreset> = [
  { id: 'free', label: 'Free space', sigma: 0, epsilon: 1, hint: 'No ground (height = infinity)' },
  { id: 'perfect', label: 'Perfect conductor', sigma: Infinity, epsilon: 1, hint: 'Ideal reflector (benchmark)' },
  { id: 'sea', label: 'Sea water', sigma: 5.0, epsilon: 81, hint: 'Coastal / over-sea paths' },
  { id: 'fresh', label: 'Fresh water', sigma: 0.01, epsilon: 80, hint: 'Large lake / river' },
  { id: 'pastoral', label: 'Pastoral (avg)', sigma: 0.005, epsilon: 13, hint: 'UK/EU farmland, default' },
  { id: 'dry-rocky', label: 'Dry rocky', sigma: 0.002, epsilon: 10, hint: 'Arid uplands' },
  { id: 'city', label: 'Urban / industrial', sigma: 0.001, epsilon: 5, hint: 'Built-up areas, roof-mount' },
];

export const DEFAULT_GROUND_ID = 'pastoral';

export function findGroundPreset(id: string): GroundPreset {
  const preset = GROUND_PRESETS.find((g) => g.id === id);
  if (!preset) {
    throw new Error(`Unknown ground preset id: ${id}`);
  }
  return preset;
}

export interface FeedlinePreset {
  readonly id: string;
  readonly label: string;
  readonly Z0: number;
  readonly vf: number;
  /** k1 coefficient for loss: loss_dB_per_100m = k1 * sqrt(f_MHz) + k2 * f_MHz */
  readonly k1: number;
  /** k2 coefficient for loss: loss_dB_per_100m = k1 * sqrt(f_MHz) + k2 * f_MHz */
  readonly k2: number;
}

export const FEEDLINE_PRESETS: ReadonlyArray<FeedlinePreset> = [
  { id: 'custom', label: 'None (Direct Feed)', Z0: 50, vf: 1, k1: 0, k2: 0 },
  { id: 'rg58', label: 'RG-58 (Generic)', Z0: 50, vf: 0.66, k1: 1.3828, k2: 0.0227 },
  { id: 'rg213', label: 'RG-213', Z0: 50, vf: 0.66, k1: 0.5920, k2: 0.0028 },
  { id: 'lmr400', label: 'LMR-400', Z0: 50, vf: 0.85, k1: 0.4024, k2: 0.0028 },
  { id: 'ladder450', label: '450Ω Ladder Line', Z0: 450, vf: 0.91, k1: 0.1, k2: 0.001 },
];

export const DEFAULT_FEEDLINE_ID = 'custom';

export function findFeedlinePreset(id: string): FeedlinePreset {
  const preset = FEEDLINE_PRESETS.find((f) => f.id === id);
  if (!preset) {
    throw new Error(`Unknown feedline preset id: ${id}`);
  }
  return preset;
}
