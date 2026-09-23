import { describe, expect, it } from 'vitest';
import { Nec2Engine, findMaxGainDirection } from '../src/physics/nec2Engine';
import type { GainPattern, SimulationInput } from '../src/physics/types';

describe('Nec2Engine unit tests', () => {
  describe('findMaxGainDirection', () => {
    it('correctly calculates max gain and converts theta/phi to elevation/azimuth', () => {
      // 10 theta steps (0° to 90°, dTheta = 10°), 36 phi steps (0° to 350°, dPhi = 10°)
      const thetaSteps = 10;
      const phiSteps = 36;
      const data = new Float32Array(thetaSteps * phiSteps).fill(-10);

      // Set peak at ti = 3 (theta = 30°, elevation = 90 - 30 = 60°), pi = 5 (phi = 50°)
      const targetIndex = 3 * phiSteps + 5;
      data[targetIndex] = 5.25;

      const pattern: GainPattern = {
        thetaSteps,
        phiSteps,
        dTheta: 10,
        dPhi: 10,
        data,
      };

      const result = findMaxGainDirection(pattern);
      expect(result.maxGain).toBeCloseTo(5.25);
      expect(result.elevationDeg).toBeCloseTo(60);
      expect(result.phiDeg).toBeCloseTo(50);
    });

    it('breaks elevation ties by preferring the lowest elevation (ti closer to horizon / larger theta)', () => {
      // thetaSteps = 10 (dTheta = 10°: ti 0 = 0° zenith, ti 9 = 90° horizon)
      const thetaSteps = 10;
      const phiSteps = 36;
      const data = new Float32Array(thetaSteps * phiSteps).fill(-10);

      // Tied peak at ti = 2 (theta = 20°, elevation = 70°) and ti = 7 (theta = 70°, elevation = 20°)
      data[2 * phiSteps + 10] = 6.0;
      data[7 * phiSteps + 10] = 6.0;

      const pattern: GainPattern = {
        thetaSteps,
        phiSteps,
        dTheta: 10,
        dPhi: 10,
        data,
      };

      const result = findMaxGainDirection(pattern);
      expect(result.maxGain).toBeCloseTo(6.0);
      // Lowest elevation is 20° (ti = 7)
      expect(result.elevationDeg).toBeCloseTo(20);
    });

    it('breaks azimuth ties by preferring the lowest phi angle (pi = 0)', () => {
      const thetaSteps = 10;
      const phiSteps = 36;
      const data = new Float32Array(thetaSteps * phiSteps).fill(-10);

      // Tied peak along the same theta row (ti = 5, theta = 50°, elevation = 40°) at pi = 12 and pi = 3
      data[5 * phiSteps + 12] = 4.5;
      data[5 * phiSteps + 3] = 4.5;

      const pattern: GainPattern = {
        thetaSteps,
        phiSteps,
        dTheta: 10,
        dPhi: 10,
        data,
      };

      const result = findMaxGainDirection(pattern);
      expect(result.maxGain).toBeCloseTo(4.5);
      expect(result.elevationDeg).toBeCloseTo(40);
      expect(result.phiDeg).toBeCloseTo(30); // pi = 3 * 10° = 30°
    });

    it('locates peak below the horizon (theta > 90°, free space)', () => {
      // thetaSteps = 19 (dTheta = 10°: ti 0..9 above/at horizon, ti 10..18 below horizon)
      const thetaSteps = 19;
      const phiSteps = 36;
      const data = new Float32Array(thetaSteps * phiSteps).fill(-10);

      // Set peak at ti = 12 (theta = 120°, elevation = 90 - 120 = -30°), pi = 18 (phi = 180°)
      data[12 * phiSteps + 18] = 2.15;

      const pattern: GainPattern = {
        thetaSteps,
        phiSteps,
        dTheta: 10,
        dPhi: 10,
        data,
      };

      const result = findMaxGainDirection(pattern);
      expect(result.maxGain).toBeCloseTo(2.15);
      expect(result.elevationDeg).toBeCloseTo(-30);
      expect(result.phiDeg).toBeCloseTo(180);
    });
  });

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
