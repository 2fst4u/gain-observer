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
    case 'vertical-whip':
      // Quarter-wave monopole resonant length.
      return lambda * 0.25 * endEffect;
    case 'inverted-l':
      // Total wire (vertical + horizontal) for a resonant quarter-wave.
      // The horizontal top-loading section adds electrical length so the
      // mast can be shorter than a full ¼λ vertical.
      return lambda * 0.25 * endEffect;
    case 'folded-dipole':
      // Each conductor is a resonant half-wave, same as a standard dipole.
      // The fold (the second parallel conductor) raises the feedpoint
      // impedance ~4× but does not change the resonant length.
      return lambda * 0.5 * endEffect;
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
 * centre. A single short horizontal "bridge" wire spans the gap between the
 * two inner ends; the terminating resistor sits on that bridge, dissipating
 * the round-trip wave that propagates around the loop from the apex feed.
 *
 * This is the canonical T2FD / aperiodic-loop topology: one resistor across
 * the gap (not two resistors to ground). Bridge termination flattens the
 * feedpoint impedance broadband, at the cost of efficiency on the
 * fundamental — exactly the trade a broadband loop is for.
 */
export const TERMINATED_DELTA_LEFT_BASE_TAG = 9;
export const TERMINATED_DELTA_RIGHT_BASE_TAG = 10;
export const TERMINATED_DELTA_BRIDGE_TAG = 11;

/**
 * Wire tag for the vertical whip (single-wire monopole).
 * Distinct from DIPOLE_TAG so the renderer can place the feedpoint marker
 * at the base of the whip rather than at its midpoint.
 */
export const VERTICAL_WHIP_TAG = 12;

/**
 * Default whip length in metres = 32 ft (32 × 0.3048).
 * Chosen as a common ham-radio whip length (e.g. surplus military whips,
 * MFJ-1979, full-size 40 m monopole when mast-mounted).
 */
export const DEFAULT_WHIP_LENGTH_M = 32 * 0.3048;

/**
 * Mechanical gap between the whip's base and z = 0 when the user sets the
 * base height to "ground level", metres. The whip is electrically isolated
 * from ground (sitting on a mount, tripod, or insulator). Without this
 * gap NEC would automatically connect a z = 0 endpoint to its image via
 * the GN card and turn the antenna into a properly-grounded monopole,
 * which is not what the user-visible "whip resting on the ground" model
 * is meant to be.
 */
export const VERTICAL_WHIP_BASE_GAP_M = 0.01;

/**
 * Tag for the optional counterpoise radial wires deployed at the base of
 * a vertical whip when the user enables the counterpoise toggle. All
 * radials share the same tag so they group cleanly in NEC current /
 * ripple diagnostics.
 */
export const VERTICAL_WHIP_RADIAL_TAG = 13;

/**
 * Wire tag for the vertical section of an Inverted-L antenna.
 * The base of this wire carries the NEC excitation (segment 1).
 */
export const INVERTED_L_VERTICAL_TAG = 14;

/**
 * Wire tag for the horizontal top-loading section of an Inverted-L.
 * Shares the bend-point junction with INVERTED_L_VERTICAL_TAG.
 */
export const INVERTED_L_HORIZONTAL_TAG = 15;

/**
 * Wire tag for the optional counterpoise radials at the base of an
 * Inverted-L. Kept separate from VERTICAL_WHIP_RADIAL_TAG so that
 * current-ripple diagnostics can distinguish the two antenna types.
 */
export const INVERTED_L_RADIAL_TAG = 16;

/**
 * Wire tags for the Folded Dipole antenna.
 *
 * Two parallel half-wave conductors joined at both ends form a narrow loop.
 * The lower conductor is fed at its centre (split into DIPOLE_LEFT_TAG /
 * DIPOLE_RIGHT_TAG halves around the FEED_BRIDGE_TAG = 3 source bridge, the
 * same split-fed convention as the standard dipole). The upper conductor is
 * continuous (FOLDED_DIPOLE_OPPOSITE_TAG); in a *terminated* folded dipole
 * (TFD) a resistor sits at the centre segment of that conductor. Two short
 * end-connector wires across the aperture share FOLDED_DIPOLE_CONNECTOR_TAG.
 *
 *   FOLDED_DIPOLE_OPPOSITE_TAG  (17) — un-fed parallel conductor
 *   FOLDED_DIPOLE_CONNECTOR_TAG (18) — both end connectors across the aperture
 */
export const FOLDED_DIPOLE_OPPOSITE_TAG = 17;
export const FOLDED_DIPOLE_CONNECTOR_TAG = 18;

/**
 * Default conductor spacing (aperture) of the folded dipole, metres.
 * 0.3 m is a typical wide-spaced HF folded-dipole gap (e.g. window-line
 * spreaders). For equal-diameter conductors the feedpoint stays ~4× a plain
 * dipole (~300 Ω) regardless of spacing; the spacing mainly trades off
 * bandwidth and the onset of array-like pattern effects at large apertures.
 */
export const FOLDED_DIPOLE_DEFAULT_APERTURE_M = 0.3;

/**
 * Maximum folded-dipole conductor spacing, metres. Two long, closely-spaced
 * parallel wires converge slowly in NEC's thin-wire kernel: the segment length
 * must shrink with the spacing, and beyond ~0.5 m the structure would need
 * more than `MAX_SEGS_PER_LEG` segments to solve accurately (and is morphing
 * toward a loop rather than a folded dipole). 0.5 m comfortably covers every
 * realistic folded-dipole spacing across the HF range.
 */
export const FOLDED_DIPOLE_MAX_APERTURE_M = 0.5;

/**
 * Number of counterpoise radials, equally spaced in azimuth, deployed
 * when the counterpoise toggle is enabled. 4 is the commonly-cited
 * minimum for a usable ground-plane vertical; more radials reduce ground
 * loss but with rapidly diminishing returns past ~8 at HF.
 */
export const VERTICAL_WHIP_RADIAL_COUNT = 4;

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

const GROUND_PRESET_MAP = new Map<string, GroundPreset>(
  GROUND_PRESETS.map((p) => [p.id, p])
);

export function findGroundPreset(id: string): GroundPreset {
  const preset = GROUND_PRESET_MAP.get(id);
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

const FEEDLINE_PRESET_MAP = new Map<string, FeedlinePreset>(
  FEEDLINE_PRESETS.map((p) => [p.id, p])
);

export function findFeedlinePreset(id: string): FeedlinePreset {
  return FEEDLINE_PRESET_MAP.get(id) ?? FEEDLINE_PRESETS[0];
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
