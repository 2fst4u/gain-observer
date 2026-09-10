import { describe, it, expect } from 'vitest';
import type {
  AntennaType,
  Wire,
  GroundParams,
  TransmissionLine,
  SegmentLoad,
  NetworkLoad,
  SimulationInput,
  GainPattern,
  ImpedanceResult,
  SegmentCurrent,
  PowerBudget,
  CurrentRipple,
  TerminationDiagnostics,
  SimulationResult,
  SweepPoint,
  Engine
} from '../src/physics/types';

describe('physics/types', () => {
  it('should allow valid type initialisations', () => {
    const antennaType: AntennaType = 'dipole';
    expect(antennaType).toBeDefined();

    const wire: Wire = {
      start: [0, 0, 0],
      end: [0, 10, 0],
      radius: 0.001,
      segments: 21,
      tag: 1,
    };
    expect(wire).toBeDefined();

    const groundParams: GroundParams = {
      type: 'real',
      sigma: 0.005,
      epsilon: 13,
    };
    expect(groundParams).toBeDefined();

    const transmissionLine: TransmissionLine = {
      fromTag: 1,
      fromSegment: 11,
      toTag: 2,
      toSegment: 1,
      z0: 50,
      lengthM: 10,
    };
    expect(transmissionLine).toBeDefined();

    const segmentLoad: SegmentLoad = {
      type: 4,
      wireTag: 1,
      segmentStart: 1,
      segmentEnd: 1,
      param1: 50,
      param2: 0,
    };
    expect(segmentLoad).toBeDefined();

    const networkLoad: NetworkLoad = {
      fromTag: 1,
      fromSegment: 1,
      toTag: 2,
      toSegment: 1,
      y11Real: 0.02,
      y12Real: -0.02,
      y22Real: 0.02,
    };
    expect(networkLoad).toBeDefined();

    const simulationInput: SimulationInput = {
      wires: [wire],
      frequencyMHz: 14.2,
      ground: groundParams,
      excitation: { wireTag: 1, segment: 11, real: 1, imag: 0 },
      patternResolution: { thetaSteps: 37, phiSteps: 73 },
      transmissionLines: [transmissionLine],
      loads: [segmentLoad],
      networks: [networkLoad],
    };
    expect(simulationInput).toBeDefined();

    const gainPattern: GainPattern = {
      data: new Float32Array(37 * 73),
      thetaSteps: 37,
      phiSteps: 73,
      dTheta: 5,
      dPhi: 5,
    };
    expect(gainPattern).toBeDefined();

    const impedanceResult: ImpedanceResult = {
      R: 50,
      X: 0,
    };
    expect(impedanceResult).toBeDefined();

    const segmentCurrent: SegmentCurrent = {
      segNo: 1,
      tagNo: 1,
      x: 0,
      y: 0,
      z: 0,
      magnitude: 1,
      phase: 0,
    };
    expect(segmentCurrent).toBeDefined();

    const powerBudget: PowerBudget = {
      inputW: 100,
      radiatedW: 90,
      structureLossW: 5,
      networkLossW: 5,
      efficiencyPct: 90,
    };
    expect(powerBudget).toBeDefined();

    const currentRipple: CurrentRipple = {
      tagNo: 1,
      magnitudes: [1, 1, 1],
      ripple: 1,
      rippleDb: 0,
    };
    expect(currentRipple).toBeDefined();

    const terminationDiagnostics: TerminationDiagnostics = {
      currentRippleByTag: [currentRipple],
      powerBudget: powerBudget,
      frontBackDb: 20,
    };
    expect(terminationDiagnostics).toBeDefined();

    const simulationResult: SimulationResult = {
      pattern: gainPattern,
      maxGainDbi: 2.15,
      takeoffElevationDeg: 30,
      takeoffAzimuthDeg: 0,
      impedance: impedanceResult,
      swr: 1.5,
      efficiency: 0.9,
      maxDirectivityDbi: 2.15,
      maxRealizedGainDbi: 2,
      computeTimeMs: 100,
      terminationDiagnostics: terminationDiagnostics,
    };
    expect(simulationResult).toBeDefined();

    const sweepPoint: SweepPoint = {
      frequencyMHz: 14.2,
      swr: 1.5,
      R: 50,
      X: 0,
    };
    expect(sweepPoint).toBeDefined();

    const engine: Engine = {
      init: async () => {},
      ready: true,
      simulate: async () => simulationResult,
      name: 'TestEngine',
    };
    expect(engine).toBeDefined();
  });
});
