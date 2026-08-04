import { describe, expect, it, vi } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import type { SimulationInput } from '../src/physics/types';

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

  it('throws an error if NEC-2 output does not contain a radiation pattern', async () => {
    const engine = new Nec2Engine({ baseUrl: '/' });

    // Mock the init promise to bypass actual wasm loading
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ready = true;

    const mockInstance = {
      FS: {
        writeFile: vi.fn(),
        readFile: vi.fn().mockReturnValue(new TextEncoder().encode('Dummy output with no pattern \nRUN TIME=0.001')),
      },
      callMain: vi.fn().mockReturnValue(0), // return success
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
      'NEC-2 did not produce a radiation pattern. Notices: Impedance block not found in NEC output.; Radiation pattern block not found in NEC output.'
    );
  });

  it('throws an error if NEC-2 output does not contain an impedance result', async () => {
    const engine = new Nec2Engine({ baseUrl: '/' });

    // Mock the init promise to bypass actual wasm loading
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ready = true;

    const mockInstance = {
      FS: {
        writeFile: vi.fn(),
        readFile: vi.fn().mockReturnValue(new TextEncoder().encode('Dummy output with pattern but no impedance \nRUN TIME=0.001\n                                 - - - RADIATION PATTERNS - - -\n  THETA    PHI    VERT    HORIZ    TOTAL\n    0.00    0.00   -1.00   -2.00   10.00')),
      },
      callMain: vi.fn().mockReturnValue(0), // return success
    };

    // Inject a mock factory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).factory = async () => mockInstance;

    const dummyInput: SimulationInput = {
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 2, phiSteps: 1 },
    };

    await expect(engine.simulate(dummyInput)).rejects.toThrow(
      'NEC-2 did not produce an impedance result.'
    );
  });

  it('throws an error when sweep missing impedance result', async () => {
    const engine = new Nec2Engine({ baseUrl: '/' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ready = true;

    // intercept solveImpedanceSweep on the instance directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'solveImpedanceSweep').mockResolvedValue([{ impedance: null }]);

    const dummyInput: SimulationInput = {
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };

    await expect(engine.sweepImpedance(dummyInput, { points: 1, window: { startMHz: 14, endMHz: 14 } })).rejects.toThrow(
      'NEC-2 sweep missing impedance result for frequency 14 MHz'
    );
  });

  it('throws a general execution exception and cleans up lock when simulate fails', async () => {
    const engine = new Nec2Engine({ baseUrl: '/' });

    // Mock the init promise to bypass actual wasm loading
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ready = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).factory = {}; // just to bypass the factory check

    // intercept runJob to throw an error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'runJob').mockRejectedValue(new Error('Simulated execution failure'));

    const dummyInput: SimulationInput = {
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };

    await expect(engine.simulate(dummyInput)).rejects.toThrow('Simulated execution failure');

    // Ensure that the lock has been released: simulate() resolves the lock in a
    // finally block, so a second simulate() must run rather than hang.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'runJob').mockResolvedValue('Dummy output with pattern and impedance\nRUN TIME=0.001\n                                 - - - RADIATION PATTERNS - - -\n  THETA    PHI    VERT    HORIZ    TOTAL\n    0.00    0.00   -1.00   -2.00   10.00\n                                 - - - ANTENNA INPUT PARAMETERS - - -\n  TAG   SEG       VOLTAGE (VOLTS)         CURRENT (AMPS)         IMPEDANCE (OHMS)        ADMITTANCE (MHOS)     POWER\n  NO.   NO.     REAL      IMAG.         REAL      IMAG.         REAL      IMAG.         REAL      IMAG.       (WATTS)\n    1     6  1.000E+00  0.000E+00    1.00E-02  2.00E-02    1.00E+01  2.00E+01    1.00E-03  2.00E-03    1.00E+00\n');

    await expect(engine.simulate(dummyInput)).resolves.toBeDefined();
  });

  it('releases lock when solveImpedanceSweep execution fails', async () => {
    const engine = new Nec2Engine({ baseUrl: '/' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).ready = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).factory = async () => ({});

    let lockReleased = false;
    // Mock acquire to return a function that sets our flag
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'acquire').mockResolvedValue(() => {
      lockReleased = true;
    });

    // Mock runJob to throw an error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(engine as any, 'runJob').mockRejectedValue(new Error('Sweep execution failed'));

    const dummyInput: SimulationInput = {
      wires: [{ start: [0, 0, 1], end: [0, 0, 2], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((engine as any).solveImpedanceSweep(dummyInput, 1, 14, 0)).rejects.toThrow('Sweep execution failed');
    expect(lockReleased).toBe(true);
  });
});
