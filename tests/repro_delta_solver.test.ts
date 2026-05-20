import { describe, it, expect, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { selectSimulationInput } from '../src/store/antennaStore';
import { HF_BAND_PRESETS } from '../src/physics/constants';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Compute an absolute file:// URL for the Wasm loader so dynamic import works
// inside the engine code under Node.
const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

describe('Delta Loop Solver Repro', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  const presets = HF_BAND_PRESETS.filter(p => ['160m', '80m', '60m', '40m'].includes(p.name));

  it.each(presets)('simulates %s delta-loop at 10m height', async (preset) => {
    const frequency = preset.mhz;
    const lambda = 299.792458 / frequency;

    const state = {
      antennaType: 'delta-loop' as const,
      frequency: frequency,
      length: lambda,
      height: 10,
      orientation: 'EW' as const,
      wireRadius: 0.001,
      segments: 21,
      vAngle: 180,
      legSlope: 0,
      terminatingResistor: 0,
      groundId: 'pastoral',
      groundSigma: 0.005,
      groundEpsilon: 13,
      feedlineId: 'none',
      feedlineLength: 0,
      feedlineOffset: 0,
    };

    const input = selectSimulationInput(state as any);
    const r = await engine.simulate(input);
    expect(r.maxGainDbi).toBeDefined();
    expect(Number.isFinite(r.maxGainDbi)).toBe(true);
    expect(r.impedance.R).toBeGreaterThan(0);
  }, 60_000);

  it.each(presets)('simulates %s delta-loop at 10m height with RG-58 feedline', async (preset) => {
    const frequency = preset.mhz;
    const lambda = 299.792458 / frequency;

    const state = {
      antennaType: 'delta-loop' as const,
      frequency: frequency,
      length: lambda,
      height: 10,
      orientation: 'EW' as const,
      wireRadius: 0.001,
      segments: 21,
      vAngle: 180,
      legSlope: 0,
      terminatingResistor: 0,
      groundId: 'pastoral',
      groundSigma: 0.005,
      groundEpsilon: 13,
      feedlineId: 'rg58',
      feedlineLength: 10,
      feedlineOffset: 0,
    };

    const input = selectSimulationInput(state as any);
    const r = await engine.simulate(input);
    expect(r.maxGainDbi).toBeDefined();
    expect(Number.isFinite(r.maxGainDbi)).toBe(true);
    expect(r.impedance.R).toBeGreaterThan(0);
  }, 60_000);
});
