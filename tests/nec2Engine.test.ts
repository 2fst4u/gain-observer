import { describe, expect, it } from 'vitest';
import { findMaxGainDirection, Nec2Engine } from '../src/physics/nec2Engine';
import type { GainPattern, SimulationInput } from '../src/physics/types';

describe('findMaxGainDirection unit tests', () => {
  it('finds peak gain and converts theta to elevation correctly', () => {
    // 3 theta steps (0=zenith/90° elev, 1=45° elev, 2=horizon/0° elev), 2 phi steps (0°, 180°)
    // thetaSteps=3, phiSteps=2, dTheta=45, dPhi=180
    const data = new Float32Array([
      0, 0,     // ti=0 (theta=0°, elev=90°)
      5.5, 2.0, // ti=1 (theta=45°, elev=45°) -> peak at pi=0 (phi=0°)
      1.0, 1.0  // ti=2 (theta=90°, elev=0°)
    ]);

    const pattern: GainPattern = {
      thetaSteps: 3,
      phiSteps: 2,
      dTheta: 45,
      dPhi: 180,
      data,
    };

    const result = findMaxGainDirection(pattern);
    expect(result.maxGain).toBe(5.5);
    expect(result.elevationDeg).toBe(45);
    expect(result.phiDeg).toBe(0);
  });

  it('breaks ties towards lowest elevation above horizon, then lowest phi', () => {
    // Both ti=0 (zenith, elev=90°) and ti=1 (elev=45°) have peak gain 10.0
    const data = new Float32Array([
      10.0, 10.0, // ti=0 (elev=90°)
      10.0, 10.0, // ti=1 (elev=45°)
      3.0, 3.0    // ti=2 (elev=0°)
    ]);

    const pattern: GainPattern = {
      thetaSteps: 3,
      phiSteps: 2,
      dTheta: 45,
      dPhi: 180,
      data,
    };

    const result = findMaxGainDirection(pattern);
    expect(result.maxGain).toBe(10.0);
    // Should prefer lowest elevation (45°) over zenith (90°), and lowest phi (0°)
    expect(result.elevationDeg).toBe(45);
    expect(result.phiDeg).toBe(0);
  });

  it('searches below horizon (free space) if peak is only below horizon', () => {
    // thetaSteps=4 (ti=0: 0°/90° elev, ti=1: 45°/45° elev, ti=2: 90°/0° elev, ti=3: 135°/-45° elev)
    const data = new Float32Array([
      1.0, 1.0, // ti=0
      2.0, 2.0, // ti=1
      3.0, 3.0, // ti=2 (horizon)
      8.0, 4.0  // ti=3 (below horizon) -> max gain 8.0 at pi=0
    ]);

    const pattern: GainPattern = {
      thetaSteps: 4,
      phiSteps: 2,
      dTheta: 45,
      dPhi: 180,
      data,
    };

    const result = findMaxGainDirection(pattern);
    expect(result.maxGain).toBe(8.0);
    expect(result.elevationDeg).toBe(-45);
    expect(result.phiDeg).toBe(0);
  });
});

describe('Nec2Engine unit tests', () => {
  it('simulate() throws initialization error if factory fails to initialize', async () => {
    const engine = new Nec2Engine();
    // Stub init to simulate a silent failure where this.factory remains null
    engine.init = async () => {};

    const dummyInput = {} as SimulationInput;

    await expect(engine.simulate(dummyInput)).rejects.toThrow(
      'NEC-2 engine failed to initialise'
    );
  });

  it('sweepImpedance() throws initialization error if factory fails to initialize', async () => {
    const engine = new Nec2Engine();
    // Stub init to simulate a silent failure where this.factory remains null
    engine.init = async () => {};

    const dummyInput = {} as SimulationInput;

    await expect(engine.sweepImpedance(dummyInput)).rejects.toThrow(
      'NEC-2 engine failed to initialise'
    );
  });

  it('sweepImpedance() throws error if sweep exits with non-zero status', async () => {
    const engine = new Nec2Engine();

    // Stub factory to return an instance with failing callMain
    engine['factory'] = async (opts?: { printErr?: (msg: string) => void }) => {
      // simulate printing stderr for the tail
      if (opts?.printErr) {
        opts.printErr('some error line 1');
        opts.printErr('some error line 2');
      }
      return {
        FS: {
          writeFile: () => {},
          readFile: () => new Uint8Array([]),
        },
        callMain: () => 1, // Non-zero exit code
      } as unknown as NonNullable<Awaited<ReturnType<NonNullable<typeof engine['factory']>>>>;
    };

    const dummyInput = {
      frequencyMHz: 14.1,
      wires: [],
      ground: { type: 'perfect' },
      excitation: {
        wireTag: 1,
        segment: 1,
        voltage: 1,
      },
      patternResolution: { thetaSteps: 1, phiSteps: 1 },
      loads: [],
      transmissionLines: [],
    } as unknown as SimulationInput;

    await expect(engine.sweepImpedance(dummyInput)).rejects.toThrow(
      'nec2c sweep exited with status 1. some error line 1 | some error line 2'
    );
  });
});
