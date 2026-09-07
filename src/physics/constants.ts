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

/** Lower bound for the SWR-sweep display window (MHz). */
export const SWEEP_F_MIN_MHZ = 1.0;

/** Upper bound for the SWR-sweep display window (MHz). */
export const SWEEP_F_MAX_MHZ = 30;

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

const REFERENCE_LENGTH_STRATEGIES: Record<AntennaType, (lambda: number, endEffect: number) => number> = {
  dipole: (lambda, endEffect) => lambda * 0.5 * endEffect,
  'inverted-v': (lambda) => {
    // The V geometry reduces the effective horizontal current component;
    // slightly more wire than a flat dipole is needed to restore resonance.
    return lambda * 0.5 * 0.97;
  },
  'delta-loop': (lambda) => {
    // Full-wave loop: no free ends, so end-effect does not apply.
    // Default length is exactly 1.0λ.
    return lambda;
  },
  'sloping-v': (lambda) => {
    // Traveling-wave V antenna: 1λ per leg. End-effect correction does not
    // apply to non-resonant traveling-wave structures.
    return lambda * 2.0;
  },
  'terminated-delta': (lambda) => {
    // Same perimeter as delta-loop. Resonance is irrelevant in a true
    // terminated configuration, but 1.0λ is the canonical starting point.
    return lambda;
  },
  'vertical-whip': (lambda, endEffect) => {
    // Quarter-wave monopole resonant length.
    return lambda * 0.25 * endEffect;
  },
  'inverted-l': (lambda, endEffect) => {
    // Total wire (vertical + horizontal) for a resonant quarter-wave.
    // The horizontal top-loading section adds electrical length so the
    // mast can be shorter than a full ¼λ vertical.
    return lambda * 0.25 * endEffect;
  },
  'folded-dipole': (lambda, endEffect) => {
    // Each conductor is a resonant half-wave, same as a standard dipole.
    // The fold (the second parallel conductor) raises the feedpoint
    // impedance ~4× but does not change the resonant length.
    return lambda * 0.5 * endEffect;
  }
};

/**
 * Topology-aware reference length (metres).
 *
 *   - dipole: 0.475λ total (0.5λ × 0.95 end-effect).
 *   - inverted-v: 0.485λ total (0.5λ × 0.97). Slightly more wire than a flat
 *     dipole: the V geometry reduces the effective horizontal current
 *     component, so extra wire restores the resonant frequency.
 *   - delta-loop: 1.0λ perimeter (no end-effect correction — loops have
 *     no free ends).
 *   - sloping-v: 2λ total (1λ per leg). Traveling-wave antenna; no
 *     end-effect correction applies.
 *   - terminated-delta: 1.0λ perimeter (same triangle as delta-loop).
 *
 * Applies the standard HF end-effect factor k ~ 0.95 only to resonant
 * half-wave elements (dipole variants, quarter-wave monopoles).
 */
export function referenceLength(type: AntennaType, frequencyMHz: number, endEffect = 0.95): number {
  const lambda = wavelengthMeters(frequencyMHz);
  const strategy = REFERENCE_LENGTH_STRATEGIES[type] || REFERENCE_LENGTH_STRATEGIES.dipole;
  return strategy(lambda, endEffect);
}

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

/**
 * Wire tags for the Terminated Delta antenna.
 *
 * The terminated delta is the same isosceles triangle as a delta loop with
 * the apex at the top and feedpoint at the apex (LEFT_LEG_TAG /
 * RIGHT_LEG_TAG carry the two top legs, exactly as in the delta loop).
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

/**
 * Wire tag for the vertical whip (single-wire monopole).
 * Distinct from MAIN_WIRE_TAG so the renderer can place the feedpoint marker
 * at the base of the whip rather than at its midpoint.
 */

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

/**
 * Wire tag for the vertical section of an Inverted-L antenna.
 * The base of this wire carries the NEC excitation (segment 1).
 */

/**
 * Wire tag for the horizontal top-loading section of an Inverted-L.
 * Shares the bend-point junction with INVERTED_L_VERTICAL_TAG.
 */

/**
 * Wire tag for the optional counterpoise radials at the base of an
 * Inverted-L. Kept separate from VERTICAL_WHIP_RADIAL_TAG so that
 * current-ripple diagnostics can distinguish the two antenna types.
 */

/**
 * Wire tags for the Folded Dipole antenna.
 *
 * Two parallel half-wave conductors joined at both ends form a narrow loop.
 * The lower conductor is fed at its centre (split into LEFT_LEG_TAG /
 * RIGHT_LEG_TAG halves around the FEED_BRIDGE_TAG = 3 source bridge, the
 * same split-fed convention as the standard dipole). The upper conductor is
 * split at its centre into two halves (FOLDED_DIPOLE_OPPOSITE_TAG × 2); in the
 * unterminated case they share a single junction at the top centre point,
 * forming a continuous wire. In a terminated folded dipole (TFD) a small gap
 * separates the two inner ends and a short horizontal bridge wire spans that
 * gap; an LD-4 load on the bridge forces top-conductor current to pass through
 * the terminating resistor as it crosses between the halves — the correct
 * traveling-wave gap-bridge topology (FOLDED_DIPOLE_TERM_BRIDGE_TAG),
 * analogous to the terminated-delta's centre-gap bridge. Two short
 * end-connector wires across the aperture share FOLDED_DIPOLE_CONNECTOR_TAG.
 *
 *   FOLDED_DIPOLE_OPPOSITE_TAG   (17) — un-fed conductor, 2 halves meeting at top centre
 *   FOLDED_DIPOLE_CONNECTOR_TAG  (18) — both end connectors across the aperture
 *   FOLDED_DIPOLE_TERM_BRIDGE_TAG (19) — termination bridge (TFD only); LD-4 carries R
 */
/**
 * Termination bridge wire for the TFD (Terminated Folded Dipole).
 *
 * Present only when a non-zero terminating resistor is fitted. The bridge is a
 * short horizontal wire spanning the centre gap of the un-fed (top) conductor,
 * joining the two inner ends of its split halves. An LD-4 load on segment 1 of
 * this wire forces the top-conductor travelling wave to pass through the
 * terminating resistance as it crosses the gap — the physically correct model
 * for a traveling-wave TFD, dissipating the wave that would otherwise reflect.
 * This mirrors the terminated-delta's centre-gap bridge.
 */

/**
 * Default conductor spacing (aperture) of the folded dipole, metres.
 * 0.3 m is a typical wide-spaced HF folded-dipole gap (e.g. window-line
 * spreaders). For equal-diameter conductors the feedpoint stays ~4× a plain
 * dipole (~300 Ω) regardless of spacing; the spacing mainly trades off
 * bandwidth and the onset of array-like pattern effects at large apertures.
 */
export const FOLDED_DIPOLE_DEFAULT_APERTURE_M = 0.3;

/**
 * Nominal feedpoint resistance of a resonant folded dipole, ohms: 4× a plain
 * dipole's ~73 Ω, because the two equal-diameter conductors each carry the
 * same antenna-mode current, doubling the current for a given feed current and
 * so quadrupling the impedance. Independent of conductor spacing.
 *
 * Doubles as the recommended T2FD termination — see
 * `FOLDED_DIPOLE_FEED_R_OHMS` — because a resistor in the unfed
 * conductor lands in series with this resistance almost 1:1.
 */
export const FOLDED_DIPOLE_FEED_R_OHMS = 300;

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

/**
 * Floor for the height of the sloping-V termination hub (the bottom of each
 * stub, where the counterpoise radials meet), metres above ground. Must be
 * > 0 — NEC wires cannot touch z = 0 under a Sommerfeld-Norton ground.
 *
 * This is only the floor. The hub actually sits at
 * `slopingVTerminationHubZ()`, which is frequency-scaled: the S-N ground is
 * documented as accurate for wires down to 0.001 λ above the surface, and
 * 0.01 m is below that everywhere under 30 MHz. The floor still applies at
 * the top of the HF range, where 0.001 λ is smaller than 1 cm.
 */
export const SLOPING_V_STUB_BOTTOM_Z_M = 0.01;

/**
 * Height of the sloping-V termination hub above ground, in wavelengths.
 * The Sommerfeld-Norton ground model is accurate for wires at or above
 * 0.001 λ; sitting exactly on that limit keeps the counterpoise as close to
 * the earth as the solver can faithfully represent.
 */
export const SLOPING_V_COUNTERPOISE_HEIGHT_WL = 0.001;

/**
 * Radial count and length (in wavelengths at the design frequency) for the
 * sloping-V termination counterpoise.
 *
 * Chosen by measurement against the solver, not by convention. Eight radials
 * of 0.10 λ bring the leg current ripple at the design frequency down to
 * ~2.4 dB (from ~18 dB with no counterpoise, which is a full standing wave),
 * and — the real check — put the ripple minimum at R ≈ 500 Ω, right on the
 * leg's characteristic impedance against ground, which is where a correctly
 * modelled travelling-wave termination should optimise.
 *
 * Longer radials terminate marginally better at the design frequency but are
 * resonant there, and the deck is built once and re-used across the whole
 * 1.8-30 MHz SWR sweep: 0.25 λ radials pass through resonance mid-sweep and
 * put a step in the efficiency curve that is an artefact of the model rather
 * than anything the antenna does. At 0.10 λ the screen stays electrically
 * small across the entire sweep and the curves come out smooth.
 */
export const SLOPING_V_COUNTERPOISE_RADIALS = 8;
export const SLOPING_V_COUNTERPOISE_LENGTH_WL = 0.10;

/**
 * Hub height for the sloping-V termination at a given frequency: 0.001 λ,
 * never below `SLOPING_V_STUB_BOTTOM_Z_M`, and never so high that it reaches
 * the leg tip it hangs from (`tipZ` guards the low-mast case, where the tips
 * themselves can sit close to the ground).
 */
export function slopingVTerminationHubZ(frequencyMHz: number, tipZ: number): number {
  const nominal = Math.max(
    SLOPING_V_STUB_BOTTOM_Z_M,
    wavelengthMeters(frequencyMHz) * SLOPING_V_COUNTERPOISE_HEIGHT_WL,
  );
  return Math.min(nominal, tipZ * 0.5);
}

// ⚡ Bolt: Removed .map() callback array allocation for Map initialization
export const GROUND_PRESET_MAP = new Map<string, GroundPreset>();
for (let i = 0; i < GROUND_PRESETS.length; i++) {
  const p = GROUND_PRESETS[i];
  if (p) GROUND_PRESET_MAP.set(p.id, p);
}

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

// ⚡ Bolt: Removed .map() callback array allocation for Map initialization
const FEEDLINE_PRESET_MAP = new Map<string, FeedlinePreset>();
for (let i = 0; i < FEEDLINE_PRESETS.length; i++) {
  const p = FEEDLINE_PRESETS[i];
  if (p) FEEDLINE_PRESET_MAP.set(p.id, p);
}

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

/**
 * Representative unloaded Q of the reactive components in an antenna tuning
 * unit (dominated by the inductor). This is the *only* parameter the ATU-loss
 * model takes, which keeps it network-topology-agnostic: L, T and π tuners
 * differ in how they're driven, but their achievable loss is bounded by the
 * component Q and the impedance transformation demanded. 150 is typical of a
 * decent HF tuner inductor (roller/air-wound ~150–250; small toroidal cores
 * lower). Higher Q → lower loss.
 */
export const ATU_COMPONENT_Q = 150;

/** Default length (m) of the main feedline run from a mast-base ATU to the shack. */
export const DEFAULT_ATU_MAIN_FEEDLINE_LENGTH_M = 50;
