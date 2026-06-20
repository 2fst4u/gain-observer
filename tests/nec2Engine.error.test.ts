import { describe, expect, it, vi } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { SimulationInput } from '../src/physics/types';

describe('Nec2Engine error handling', () => {
  it('throws an error with stderr when nec2c exits with a non-zero status code', async () => {
    const engine = new Nec2Engine({ baseUrl: '/' });

    // Mock the init promise to bypass actual wasm loading
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ready = true;

    const mockInstance = {
      FS: {
        writeFile: vi.fn(),
        readFile: vi.fn(),
      },
      callMain: vi.fn().mockReturnValue(1), // return non-zero status
    };

    // Inject a mock factory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).factory = async (options: any) => {
      // Simulate nec2c writing to stderr before exiting
      if (options.printErr) {
        options.printErr('Fatal error: geometry invalid');
        options.printErr('Segmentation fault');
      }
      return mockInstance;
    };

    const dummyInput: SimulationInput = {
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };

    await expect(engine.simulate(dummyInput)).rejects.toThrow(
      'nec2c exited with status 1. Fatal error: geometry invalid | Segmentation fault'
    );
  });

  it('throws an error if NEC-2 did not produce a radiation pattern', async () => {
    const engine = new Nec2Engine({ baseUrl: '/' });

    // Mock the init promise to bypass actual wasm loading
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ready = true;

    const dummyOutput = `
                                  - - - IMPEDANCE DATA - - -
FREQ =  14.0000 MHZ
VOLTAGE =  1.00000E+00
CURRENT =  1.00000E+00
IMPEDANCE =  50.0000 + J 0.0000
    `;

    const mockInstance = {
      FS: {
        writeFile: vi.fn(),
        readFile: vi.fn().mockReturnValue(new TextEncoder().encode(dummyOutput)),
      },
      callMain: vi.fn().mockReturnValue(0), // return zero status
    };

    // Inject a mock factory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).factory = async () => mockInstance;

    const dummyInput: SimulationInput = {
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };

    await expect(engine.simulate(dummyInput)).rejects.toThrow(
      'NEC-2 did not produce a radiation pattern.'
    );
  });
});
