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
});
