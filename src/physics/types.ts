// Shared physics-layer types. Everything here is metric, SI units.

export type Vec3 = readonly [number, number, number];

/**
 * Antenna topology type.
 *
 * Different topologies have different reference lengths for resonance:
 *   - dipole / inverted-v: ½λ total (standard resonant length).
 *   - delta-loop: 1λ perimeter.
 *   - sloping-v: 2λ total (1λ per leg).
 *   - terminated-delta: 1λ perimeter (same triangle shape as a delta loop,
 *     but the base is split in the middle and each half terminates to
 *     ground through its own resistor, like a per-tip sloping-V termination).
 */
export type AntennaType = 'dipole' | 'inverted-v' | 'delta-loop' | 'sloping-v' | 'terminated-delta';

export interface Wire {
  readonly start: Vec3;
  readonly end: Vec3;
  /** Conductor radius in metres. */
  readonly radius: number;
  /** Number of segments for NEC segmentation (>= 1). */
  readonly segments: number;
  /** Optional tag for excitation targeting. */
  readonly tag?: number;
}

export type GroundType = 'free' | 'perfect' | 'real';

export interface GroundParams {
  readonly type: GroundType;
  /** Conductivity S/m (ignored for free/perfect). */
  readonly sigma?: number;
  /** Relative permittivity (ignored for free/perfect). */
  readonly epsilon?: number;
}

export interface Excitation {
  readonly wireTag: number;
  /** 1-based segment index within the tagged wire to feed. */
  readonly segment: number;
  /** Complex voltage; default 1+0j for gain computation. */
  readonly real?: number;
  readonly imag?: number;
}

/**
 * NEC-2 transmission line (TL) card.
 *
 * NEC's TL card models an ideal (lossless) two-port transmission line
 * connected between two segments. It is a circuit element only — it does
 * not radiate. We use it to represent the differential signal flowing
 * inside the coaxial feedline, while the outside of the shield is modelled
 * as a real radiating wire (so common-mode currents are physically
 * captured).
 *
 * shuntAdmEnd1/shuntAdmEnd2 are optional shunt admittances (S = 1/Ω) added
 * at each port — used to approximate dielectric loss when needed.
 */
export interface TransmissionLine {
  readonly fromTag: number;
  readonly fromSegment: number;
  readonly toTag: number;
  readonly toSegment: number;
  /** Characteristic impedance, Ω. */
  readonly z0: number;
  /** Electrical length, metres (physical length × √εr_dielectric is NOT
   *  required — NEC's TL card takes physical length directly and we encode
   *  velocity factor via the lengthM value: see selectSimulationInput). */
  readonly lengthM: number;
  readonly shuntAdmEnd1Real?: number;
  readonly shuntAdmEnd1Imag?: number;
  readonly shuntAdmEnd2Real?: number;
  readonly shuntAdmEnd2Imag?: number;
}

/**
 * NEC-2 impedance loading (LD) card on a wire segment.
 *
 * type=0 → series RLC (R Ω, L H, C F).
 * type=4 → impedance Z = R + jX placed in series with the segment.
 * Other types exist but we only need 0 and 4.
 *
 * We use this to model a 1:1 current ("choke") balun: a high common-mode
 * impedance placed near the antenna feedpoint on the coax shield wire.
 */
export interface SegmentLoad {
  /** NEC LD type code. */
  readonly type: 0 | 4;
  readonly wireTag: number;
  /** First segment in the load range (1-based). */
  readonly segmentStart: number;
  /** Last segment in the load range (1-based). */
  readonly segmentEnd: number;
  /** For type=0: resistance Ω. For type=4: real part of Z, Ω. */
  readonly param1: number;
  /** For type=0: inductance H. For type=4: imaginary part of Z, Ω. */
  readonly param2: number;
  /** For type=0: capacitance F. Ignored for type=4. */
  readonly param3?: number;
}

/**
 * NEC-2 two-port network (NT) card.
 *
 * This models a non-radiating two-port network between two segments.
 * We use it primarily for lumped resistors between wire segments
 * (e.g. termination for a sloping-V).
 *
 * Admittance matrix convention:
 * I1 = Y11*V1 + Y12*V2
 * I2 = Y12*V1 + Y22*V2
 *
 * For a resistor R between port 1 and port 2:
 * Y11 = Y22 = 1/R
 * Y12 = -1/R
 */
export interface NetworkLoad {
  readonly fromTag: number;
  readonly fromSegment: number;
  readonly toTag: number;
  readonly toSegment: number;
  readonly y11Real: number;
  readonly y11Imag?: number;
  readonly y12Real: number;
  readonly y12Imag?: number;
  readonly y22Real: number;
  readonly y22Imag?: number;
}

export interface SimulationInput {
  readonly wires: readonly Wire[];
  readonly frequencyMHz: number;
  readonly ground: GroundParams;
  readonly excitation: Excitation;
  /** Pattern resolution. Theta is elevation 0..180, phi is azimuth 0..360. */
  readonly patternResolution: {
    readonly thetaSteps: number;
    readonly phiSteps: number;
  };
  /** Optional NEC TL cards (e.g. coax differential mode). */
  readonly transmissionLines?: readonly TransmissionLine[];
  /** Optional NEC LD cards (e.g. choke balun, end-fed terminator). */
  readonly loads?: readonly SegmentLoad[];
  /** Optional NEC NT cards (two-port networks). */
  readonly networks?: readonly NetworkLoad[];
}

/**
 * Flat gain pattern laid out row-major:  pattern[ti * phiSteps + pi]
 * where ti = 0..thetaSteps-1 and pi = 0..phiSteps-1.
 * Values are in dBi (total gain, V + H components combined).
 */
export interface GainPattern {
  readonly data: Float32Array;
  readonly thetaSteps: number;
  readonly phiSteps: number;
  /** Theta step size in degrees. */
  readonly dTheta: number;
  /** Phi step size in degrees. */
  readonly dPhi: number;
}

export interface ImpedanceResult {
  /** Resistive part (ohms). */
  readonly R: number;
  /** Reactive part (ohms). Positive = inductive. */
  readonly X: number;
}

/**
 * One segment's current from the NEC CURRENTS AND LOCATION block.
 * Positions are in wavelengths (NEC normalises them).
 */
export interface SegmentCurrent {
  readonly segNo: number;
  readonly tagNo: number;
  /** Centre-of-segment X position, in wavelengths. */
  readonly x: number;
  /** Centre-of-segment Y position, in wavelengths. */
  readonly y: number;
  /** Centre-of-segment Z position, in wavelengths. */
  readonly z: number;
  /** Current magnitude, amperes. */
  readonly magnitude: number;
  /** Current phase, degrees. */
  readonly phase: number;
}

/** NEC POWER BUDGET block values. */
export interface PowerBudget {
  /** Total power accepted by the antenna from the source, watts. */
  readonly inputW: number;
  /** Power leaving as far-field radiation, watts. */
  readonly radiatedW: number;
  /** Ohmic loss in wire conductors, watts. */
  readonly structureLossW: number;
  /**
   * Power absorbed by NT (network) cards, watts.
   * For a terminated sloping-V this equals the power dissipated in the
   * far-end resistor — the primary termination-effectiveness metric.
   */
  readonly networkLossW: number;
  /** Radiation efficiency, percent (= 100 × radiatedW / inputW). */
  readonly efficiencyPct: number;
}

/** Per-tag current ripple diagnostic. */
export interface CurrentRipple {
  readonly tagNo: number;
  /**
   * Current magnitudes for every segment on this wire, amperes.
   * Mutable element type (not `readonly number[]`) so the enclosing
   * `SimulationResult` remains assignable into an Immer draft in the
   * Zustand store.
   */
  readonly magnitudes: number[];
  /**
   * max(|I|) / min(|I|).
   * 1.0 = perfectly uniform (ideal travelling wave).
   * High values indicate a standing-wave component.
   */
  readonly ripple: number;
  /** 20 × log10(ripple), dB. 0 dB = perfectly uniform. */
  readonly rippleDb: number;
}

/**
 * Termination-effectiveness diagnostics derived from NEC output.
 *
 * These measure whether the far-end termination is absorbing the
 * travelling wave.  They are NOT feedpoint-match metrics.
 */
export interface TerminationDiagnostics {
  /**
   * Current ripple for each wire tag present in the NEC output.
   * Mutable element type (not `readonly CurrentRipple[]`) so the
   * enclosing `SimulationResult` remains assignable into an Immer draft
   * in the Zustand store.
   */
  readonly currentRippleByTag: CurrentRipple[];
  /**
   * Full NEC power budget.  powerBudget.networkLossW is the power
   * absorbed by the termination resistor (NT card).
   */
  readonly powerBudget: PowerBudget | null;
  /**
   * Gain at peak direction minus gain at 180° opposite, in dB.
   * Null when the pattern has too few phi steps to sample the rear.
   */
  readonly frontBackDb: number | null;
}

export interface SimulationResult {
  readonly pattern: GainPattern;
  readonly maxGainDbi: number;
  /** Elevation angle (deg, 0=horizon, 90=zenith) of maximum gain direction. */
  readonly takeoffElevationDeg: number;
  /** Azimuth (deg, 0=+x, 90=+y) of maximum gain direction. */
  readonly takeoffAzimuthDeg: number;
  readonly impedance: ImpedanceResult;
  /**
   * SWR at the feedpoint against the 50 Ω system impedance.
   *
   * Note: This measures the reflection caused by the mismatch between
   * the antenna's feedpoint impedance and the source (source reflection).
   * It is distinct from the travelling-wave reflections along the antenna
   * wire itself, which may be suppressed by termination without
   * necessarily resulting in a 50 Ω feedpoint impedance.
   */
  readonly swr: number;
  /**
   * Radiation efficiency (0..1) from the NEC POWER BUDGET block.
   * Equals terminationDiagnostics.powerBudget.efficiencyPct / 100.
   * Undefined only when the power budget block could not be parsed.
   */
  readonly efficiency?: number;
  /**
   * Peak directivity in dBi. Directivity describes pattern shape only,
   * normalised to radiated power (excluding all losses).
   * D(dBi) = G(dBi) − 10·log10(η)  where η = efficiency.
   * Undefined when the NEC power budget cannot be parsed or η ≈ 0.
   */
  readonly maxDirectivityDbi?: number;
  /**
   * Peak realized gain in dBi, accounting for feedpoint mismatch vs 50 Ω.
   * G_realized(dBi) = G(dBi) + 10·log10(1 − |Γ|²)
   * Undefined when the impedance result is unavailable.
   */
  readonly maxRealizedGainDbi?: number;
  /** Wall-clock compute time in milliseconds. */
  readonly computeTimeMs: number;
  /**
   * Termination-effectiveness diagnostics (current ripple, power budget,
   * front/back ratio).  Always present in results from Nec2Engine —
   * parseNecCurrents never returns null and computeTerminationDiagnostics
   * always returns a result.
   */
  readonly terminationDiagnostics: TerminationDiagnostics;
}

/** Result of a frequency sweep for SWR/impedance analysis. */
export interface SweepPoint {
  readonly frequencyMHz: number;
  /** SWR vs 50 Ω at the feedpoint (source reflection). */
  readonly swr: number;
  readonly R: number;
  readonly X: number;
}

export interface Engine {
  /** Lazy-load and warm up the solver. */
  init(): Promise<void>;
  /** Has init() resolved successfully? */
  readonly ready: boolean;
  /** Run a single-frequency simulation. */
  simulate(input: SimulationInput): Promise<SimulationResult>;
  /** Short human-readable engine identifier for UI / diagnostics. */
  readonly name: string;
}
