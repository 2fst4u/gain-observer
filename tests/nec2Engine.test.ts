import { describe, expect, it } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import type { SimulationInput } from '../src/physics/types';

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
      } as unknown;
    };

    const dummyInput = {
      frequencyMHz: 14.1,
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    } as unknown as SimulationInput;

    await expect(engine.sweepImpedance(dummyInput)).rejects.toThrow(
      'nec2c sweep exited with status 1. some error line 1 | some error line 2'
    );
  });

  it('simulate() propagates runJob execution error and releases lock', async () => {
    const engine = new Nec2Engine();
    // Bypass actual wasm loading
    (engine as any).ready = true;
    (engine as any).factory = {}; // bypass factory check

    let lockReleased = false;
    const originalAcquire = (engine as any).acquire.bind(engine);
    (engine as any).acquire = async () => {
      const release = await originalAcquire();
      return () => {
        lockReleased = true;
        release();
      };
    };

    // Intercept runJob to throw an error
    (engine as any).runJob = async () => {
      throw new Error('Simulated execution failure');
    };

    const dummyInput = {
      frequencyMHz: 14.1,
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    } as unknown as SimulationInput;

    await expect(engine.simulate(dummyInput)).rejects.toThrow('Simulated execution failure');
    expect(lockReleased).toBe(true);
  });
});
