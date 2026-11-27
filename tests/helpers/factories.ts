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
import type { LayerParameters } from '../../src/physics/ionosphere/iri';
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
    designFrequency: 14.1,
    antennaType: 'dipole',
    length: 20,
    height: 10,
    orientation: 'EW',
    wireRadius: 0.001,
    segments: 21,
    vAngle: 120,
    legSlope: 0,
    foldedDipoleAperture: 0.1,
    yagiReflectorRatio: 1.05,
    yagiDirectorRatio: 0.96,
    groundId: 'pastoral',
    groundSigma: 0.005,
    groundEpsilon: 13,
    feedlineId: 'none',
    feedlineLength: 0,
    feedlineOffset: 0,
    whipCounterpoise: false,
    terminatingResistor: 0,
    transformerEnabled: false,
    transformerRatio: 1,
    atuEnabled: false,
    atuMainFeedlineLength: 50,
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
    takeoffElevationDeg: 15,
    antennaGainDbi: 5,
    realizedGainDbi: 4,
    ...overrides,
  };
}

type AzimuthalHop = NonNullable<PropagationPrediction['azimuthalHops']>[number];

export function makeAzimuthalHop(overrides: Partial<AzimuthalHop> = {}): AzimuthalHop {
  const phiDeg = overrides.phiDeg ?? 0;
  return {
    phiDeg,
    bearingDeg: phiToBearingDeg(phiDeg),
    takeoffElevationDeg: 15,
    returns: true,
    rangeKm: [1000],
    antennaGainDbi: 5,
    realizedGainDbi: 4,
    ...overrides,
  };
}

export function makePropagationPrediction(
  overrides: Partial<PropagationPrediction> = {},
): PropagationPrediction {
  return {
    frequencyMHz: 7.1,
    layers: makeLayerParameters(),
    verticalCriticalMHz: 8,
    selectedMufMHz: 14,
    hops: [makeHop()],
    selectedTakeoffElevationDeg: 15,
    selectedReturns: true,
    selectedApexKm: 250,
    realizedGainOffsetDb: -1,
    solarZenithDeg: 45,
    ...overrides,
  };
}

export function makeLayerParameters(overrides: Partial<LayerParameters> = {}): LayerParameters {
  return {
    foF2: 8, foF1: NaN, foE: 3,
    hmF2: 300, hmF1: NaN, hmE: 110,
    bF2Bot: 40, bF2Top: 50, bF1Bot: NaN, bEBot: 5, bETop: 7,
    m3000: 3, modipDeg: -50, solarZenithDeg: 45, ig12: 80,
    ...overrides,
  };
}
