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
