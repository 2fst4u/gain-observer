// Shared physics-layer types. Everything here is metric, SI units.

export type Vec3 = readonly [number, number, number];

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
