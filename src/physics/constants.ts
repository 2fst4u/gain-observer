// Physical and engineering constants used throughout the app.
//
// IMPORTANT: We standardise internally on metric (SI) units. The UI may
// display imperial but the physics layer and stored state are always metric.

import { type AntennaType } from './types';

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

/**
 * Topology-aware reference length (metres).
 *
 *   - dipole: 0.475λ total (0.5λ × 0.95 end-effect).
 *   - inverted-v: 0.485λ total (0.5λ × 0.97 end-effect) per spec.
 *   - delta-loop: 1λ perimeter.
 *   - sloping-v: 2λ total (1λ per leg).
 *   - terminated-delta: 1λ perimeter (same triangle as delta-loop).
 *
 * Applies the standard HF end-effect factor k ~ 0.95 where noted.
 */
export function referenceLength(type: AntennaType, frequencyMHz: number, endEffect = 0.95): number {
  const lambda = wavelengthMeters(frequencyMHz);
  switch (type) {
    case 'dipole':
      return lambda * 0.5 * endEffect;
    case 'inverted-v':
      // Slightly higher end-effect than a dipole due to the V geometry.
      return lambda * 0.5 * 0.97;
    case 'delta-loop':
      return lambda * 1.0 * endEffect;
    case 'sloping-v':
      return lambda * 2.0 * endEffect;
    case 'terminated-delta':
      // Same physical perimeter as a delta loop. Resonance is irrelevant in
      // a true terminated configuration (the wave is absorbed before it can
      // reflect), but 1λ is the canonical starting point.
      return lambda * 1.0 * endEffect;
    default:
      return lambda * 0.5 * endEffect;
  }
}

// --- Geometry Tags ---
export const DIPOLE_TAG = 1; // single-wire dipole (no feedline)
export const DIPOLE_LEFT_TAG = 1; // left half of split dipole
export const DIPOLE_RIGHT_TAG = 2; // right half of split dipole
export const FEED_BRIDGE_TAG = 3; // 1-segment source bridge
export const FEEDLINE_SHIELD_TAG = 4; // coax shield (radiating outer surface)
export const DELTA_LOOP_RIGHT_LEG_TAG = 5; // right leg of delta loop (apex to right corner) — superseded by DIPOLE_RIGHT_TAG; kept for compatibility
export const DELTA_BASE_TAG = 6; // base wire of delta loop (left corner to right corner)

/**
 * Length of the source bridge segment for apex-fed or split-fed antennas (metres).
 * Chosen to be small enough to not affect pattern, but large enough to
 * remain NEC-valid at HF for typical wire radii.
 */
export const FEED_BRIDGE_LENGTH_M = 0.1;

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

/**
 * Recommended minimum height for antenna wire tips above ground (metres)
 * to avoid unphysical results or NEC wire-touching-ground warnings.
 */
export const SLOPING_V_MIN_TIP_Z_M = 0.5;

/**
 * Wire tags for the short vertical stub wires that connect each sloping-V
 * tip to near-ground, modelling the physical tip-to-earth terminating
 * resistor (a current path from the wire tip down to a ground rod).
 */
export const SLOPING_V_LEFT_STUB_TAG = 7;
export const SLOPING_V_RIGHT_STUB_TAG = 8;

/**
 * Wire tags for the Terminated Delta antenna.
 *
 * The terminated delta is the same isosceles triangle as a delta loop with
 * the apex at the top and feedpoint at the apex (DIPOLE_LEFT_TAG /
 * DIPOLE_RIGHT_TAG carry the two top legs, exactly as in the delta loop).
 *
 * The base wire is **split** in the middle into two independent half-base
 * wires, each running inward from its corner toward (but not touching) the
 * centre. At the inner end of each half-base, a short vertical stub drops
 * to near-ground and carries the terminating resistor — the same per-tip
 * shunt-to-earth topology used by the sloping-V termination.
 */
export const TERMINATED_DELTA_LEFT_BASE_TAG = 9;
export const TERMINATED_DELTA_RIGHT_BASE_TAG = 10;
export const TERMINATED_DELTA_LEFT_STUB_TAG = 11;
export const TERMINATED_DELTA_RIGHT_STUB_TAG = 12;

/**
 * Gap (metres) between the inner ends of the two terminated-delta
 * half-base wires at the centre of the base. The two halves must not meet
 * (otherwise they'd short across the termination), so we leave a small
 * physical gap matched to FEED_BRIDGE_LENGTH_M so the geometry stays
 * NEC-valid (no coincident wires) without materially altering the
 * radiating perimeter.
 */
export const TERMINATED_DELTA_CENTRE_GAP_M = FEED_BRIDGE_LENGTH_M;

/**
 * Z-coordinate of the bottom endpoint of the sloping-V termination stubs,
 * metres above ground.  Must be > 0 (NEC wires cannot touch z = 0).
 * 0.01 m (1 cm) places the stub end essentially at ground level while
 * remaining within the Sommerfeld-Norton model's accuracy envelope.
 */
export const SLOPING_V_STUB_BOTTOM_Z_M = 0.01;

export function findGroundPreset(id: string): GroundPreset {
  const preset = GROUND_PRESETS.find((g) => g.id === id);
  if (!preset) {
    throw new Error(`Unknown ground preset id: ${id}`);
  }
  return preset;
}

/**
 * Common feedline (coaxial cable / parallel line) presets.
 *
 * The loss model is `loss(f_MHz) = k1·√f + k2·f` dB per 100 metres, which
 * captures both copper (skin-effect, ∝ √f) and dielectric (∝ f) losses.
 * Coefficients were fitted from manufacturer datasheets at 10 MHz and
 * 100 MHz. shieldOuterRadiusM is the physical radius of the cable's outer
 * shield — used to model the radiating "outside-of-coax" wire in NEC.
 *
 * `id: 'none'` is the sentinel for "no feedline" (default behaviour).
 */
export interface FeedlinePreset {
  readonly id: string;
  readonly label: string;
  /** Characteristic impedance, Ω. 0 for the 'none' sentinel. */
  readonly z0: number;
  /** Velocity factor (0..1). 1 for the 'none' sentinel. */
  readonly velocityFactor: number;
  /** Loss coefficient: dB/100m at 1 MHz from skin effect (∝ √f). */
  readonly lossK1: number;
  /** Loss coefficient: dB/100m per MHz from dielectric loss (∝ f). */
  readonly lossK2: number;
  /** Outer-shield physical radius, metres. 0 for the 'none' sentinel. */
  readonly shieldOuterRadiusM: number;
  /** Short UI hint. */
  readonly hint: string;
}

export const FEEDLINE_PRESETS: ReadonlyArray<FeedlinePreset> = [
  {
    id: 'none',
    label: 'No feedline',
    z0: 0,
    velocityFactor: 1,
    lossK1: 0,
    lossK2: 0,
    shieldOuterRadiusM: 0,
    hint: 'Direct feed at the antenna terminals (idealised).',
  },
  {
    id: 'rg58',
    label: 'RG-58 (50 Ω, ~5 mm)',
    z0: 50,
    velocityFactor: 0.66,
    // Datasheet: ~4.6 dB/100 m @ 10 MHz, ~16.1 @ 100 MHz.
    lossK1: 1.3828,
    lossK2: 0.0227,
    shieldOuterRadiusM: 0.00248, // ~4.95 mm OD ÷ 2
    hint: 'Common thin coax. Higher loss; flexible.',
  },
  {
    id: 'rg213',
    label: 'RG-213 (50 Ω, ~10 mm)',
    z0: 50,
    velocityFactor: 0.66,
    // Datasheet: ~1.9 dB/100 m @ 10 MHz, ~6.2 @ 100 MHz.
    lossK1: 0.5920,
    lossK2: 0.0028,
    shieldOuterRadiusM: 0.00515, // ~10.3 mm OD ÷ 2
    hint: 'Standard low-loss coax for HF runs.',
  },
  {
    id: 'lmr400',
    label: 'LMR-400 (50 Ω, ~10 mm)',
    z0: 50,
    velocityFactor: 0.85,
    // Datasheet: ~1.3 dB/100 m @ 10 MHz, ~4.3 @ 100 MHz.
    lossK1: 0.4024,
    lossK2: 0.0028,
    shieldOuterRadiusM: 0.00515, // ~10.3 mm OD ÷ 2
    hint: 'Low-loss foamed-PE coax. Stiffer than RG-213.',
  },
  {
    id: 'rg8x',
    label: 'RG-8X (50 Ω, ~6 mm)',
    z0: 50,
    velocityFactor: 0.78,
    lossK1: 0.95,
    lossK2: 0.012,
    shieldOuterRadiusM: 0.0031, // ~6.2 mm OD ÷ 2
    hint: 'Mini-8 coax. Compromise loss/flexibility.',
  },
  {
    id: 'ladder450',
    label: 'Ladder line (450 Ω)',
    z0: 450,
    velocityFactor: 0.91,
    lossK1: 0.10,
    lossK2: 0.0,
    // Treated as a single-wire equivalent for shield modelling. The outer
    // common-mode "radiator" radius approximates the spacing/geometry.
    shieldOuterRadiusM: 0.0006,
    hint: 'Open-wire / window line. Very low loss; needs balanced match.',
  },
];

export const DEFAULT_FEEDLINE_ID = 'rg58';
export const DEFAULT_FEEDLINE_LENGTH_M = 10;

export function findFeedlinePreset(id: string): FeedlinePreset {
  const preset = FEEDLINE_PRESETS.find((f) => f.id === id);
  if (!preset) {
    throw new Error(`Unknown feedline preset id: ${id}`);
  }
  return preset;
}

/**
 * Total cable loss for a given feedline at a given frequency, dB.
 * Uses the `k1·√f + k2·f` skin+dielectric model.
 */
export function feedlineLossDb(preset: FeedlinePreset, frequencyMHz: number, lengthM: number): number {
  const lossPer100m = preset.lossK1 * Math.sqrt(frequencyMHz) + preset.lossK2 * frequencyMHz;
  return lossPer100m * (lengthM / 100);
}

/**
 * Common-mode choke impedance presented at the antenna-side of the feedline
 * shield when a transformer (any ratio, including 1:1) is fitted at the
 * feedpoint. Real-world current baluns (W2DU, ferrite-bead string) typically
 * present 1 kΩ to 5 kΩ across HF; 2 kΩ is a moderate resistive value — high
 * enough to substantially suppress common-mode current, low enough to remain
 * physical.
 */
export const TRANSFORMER_CHOKE_OHMS = 2000;

/**
 * Standard insertion loss applied to realized gain when a transformer is
 * fitted. 0.2 dB is typical of well-built HF baluns/ununs (W2DU choke ~0.1
 * dB; ferrite-core 9:1 unun ~0.2–0.3 dB). Not user-configurable — a single
 * representative number, deliberately conservative.
 */
export const TRANSFORMER_INSERTION_LOSS_DB = 0.2;
