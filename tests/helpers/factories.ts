// Builders for the domain objects tests need to hand to components.
//
// These types carry a lot of required fields that most tests don't care
// about — a component test for the polar plot has no opinion on the power
// budget. Each builder fills in a valid default and takes an override patch,
// so a test only spells out the fields it's actually asserting on, and adding
// a required field to the underlying type doesn't mean touching every mock.

import type {
  GainPattern,
  ImpedanceResult,
  PowerBudget,
  SimulationResult,
  TerminationDiagnostics,
} from '../../src/physics/types';
import type { ComparisonSnapshot } from '../../src/store/antennaStore';
import type { HopPrediction, PropagationPrediction } from '../../src/physics/propagation';
import { phiToBearingDeg } from '../../src/physics/angles';

/** Flat pattern with a mild gradient, so cuts and peak-finding have something to bite on. */
export function makeGainPattern(overrides: Partial<GainPattern> = {}): GainPattern {
  const thetaSteps = overrides.thetaSteps ?? 19;
  const phiSteps = overrides.phiSteps ?? 36;
  const data = overrides.data ?? new Float32Array(thetaSteps * phiSteps);
  return {
    data,
    thetaSteps,
    phiSteps,
    dTheta: 180 / (thetaSteps - 1),
    dPhi: 360 / phiSteps,
    ...overrides,
  };
}

export function makePowerBudget(overrides: Partial<PowerBudget> = {}): PowerBudget {
  return {
    inputW: 100,
    radiatedW: 90,
    structureLossW: 10,
    networkLossW: 0,
    efficiencyPct: 90,
    ...overrides,
  };
}

export function makeTerminationDiagnostics(
  overrides: Partial<TerminationDiagnostics> = {},
): TerminationDiagnostics {
  return {
    currentRippleByTag: [],
    powerBudget: makePowerBudget(),
    frontBackDb: null,
    ...overrides,
  };
}

export function makeImpedance(overrides: Partial<ImpedanceResult> = {}): ImpedanceResult {
  return { R: 50, X: 0, ...overrides };
}

export function makeSimulationResult(
  overrides: Partial<SimulationResult> = {},
): SimulationResult {
  return {
    pattern: makeGainPattern(),
    maxGainDbi: 2.15,
    takeoffElevationDeg: 30,
    takeoffAzimuthDeg: 0,
    impedance: makeImpedance(),
    swr: 1.5,
    computeTimeMs: 1,
    terminationDiagnostics: makeTerminationDiagnostics(),
    ...overrides,
  };
}

export function makeComparisonSnapshot(
  overrides: Partial<ComparisonSnapshot> = {},
): ComparisonSnapshot {
  return {
    frequency: 14.1,
    antennaType: 'dipole',
    length: 20,
    height: 10,
    orientation: 'EW',
    wireRadius: 0.001,
    segments: 21,
    vAngle: 120,
    legSlope: 0,
    foldedDipoleAperture: 0.1,
    groundId: 'pastoral',
    groundSigma: 0.005,
    groundEpsilon: 13,
    feedlineId: 'none',
    feedlineLength: 0,
    feedlineOffset: 0,
    whipCounterpoise: false,
    result: makeSimulationResult(),
    sweep: [],
    capturedAt: 0,
    ...overrides,
  };
}

export function makeHop(overrides: Partial<HopPrediction> = {}): HopPrediction {
  return {
    n: 1,
    rangeKm: 1000,
    status: 'open',
    reason: 'Open path',
    linkQuality: 'useful',
    takeoffElevationDeg: 15,
    ...overrides,
  };
}

type AzimuthalHop = NonNullable<PropagationPrediction['azimuthalHops']>[number];

export function makeAzimuthalHop(overrides: Partial<AzimuthalHop> = {}): AzimuthalHop {
  const phiDeg = overrides.phiDeg ?? 0;
  return {
    phiDeg,
    // Keep the pair consistent unless a test deliberately overrides it.
    bearingDeg: phiToBearingDeg(phiDeg),
    takeoffElevationDeg: 15,
    rangeKm: [1000],
    status: 'open',
    reason: 'Open path',
    linkQuality: 'useful',
    ...overrides,
  };
}

export function makePropagationPrediction(
  overrides: Partial<PropagationPrediction> = {},
): PropagationPrediction {
  return {
    foF2MHz: 5.5,
    hmF2Km: 300,
    mufMHz: 14.2,
    lufMHz: 3.5,
    hops: [makeHop()],
    selectedTakeoffElevationDeg: 15,
    mismatchLossDb: 0,
    solarZenithDeg: 45,
    ...overrides,
  };
}
