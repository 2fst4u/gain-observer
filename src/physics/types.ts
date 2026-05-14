// Shared physics-layer types. Everything here is metric, SI units.

export type Vec3 = readonly [number, number, number];

/**
 * Antenna topology type.
 *
 * Different topologies have different reference lengths for resonance:
 *   - dipole / inverted-v: ½λ total (standard resonant length).
 *   - delta-loop: 1λ perimeter.
 *   - sloping-v / v-beam: 2λ total (1λ per leg).
 */
export type AntennaType = 'dipole' | 'inverted-v' | 'delta-loop' | 'sloping-v' | 'v-beam';

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

export interface SimulationResult {
  readonly pattern: GainPattern;
  readonly maxGainDbi: number;
  /** Elevation angle (deg, 0=horizon, 90=zenith) of maximum gain direction. */
  readonly takeoffElevationDeg: number;
  /** Azimuth (deg, 0=+x, 90=+y) of maximum gain direction. */
  readonly takeoffAzimuthDeg: number;
  readonly impedance: ImpedanceResult;
  /** SWR vs 50 Ω. */
  readonly swr: number;
  /** Radiation efficiency (0..1) when provided by solver; undefined if unknown. */
  readonly efficiency?: number;
  /** Wall-clock compute time in milliseconds. */
  readonly computeTimeMs: number;
}

/** Result of a frequency sweep for SWR/impedance analysis. */
export interface SweepPoint {
  readonly frequencyMHz: number;
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
