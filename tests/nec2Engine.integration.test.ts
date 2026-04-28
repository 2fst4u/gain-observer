// Integration test: the real Nec2Engine wrapper against the real Wasm binary,
// via the Node-side entry. We bypass the default `/nec2.js` URL loader because
// jsdom doesn't serve files; instead we stub loadNec2Factory behaviour by
// monkey-patching the module-level dynamic import through a relative file URL.
//
// This guards the full pipeline:
//   SimulationInput → necCard → callMain() → parseNecOutput → SimulationResult.

import { describe, expect, it, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { halfWaveLength, C_MHZ_M } from '../src/physics/constants';
import type { SimulationInput } from '../src/physics/types';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Compute an absolute file:// URL for the Wasm loader so dynamic import works
// inside the engine code under Node.
const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

describe('Nec2Engine (real Wasm)', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  it('matches the canonical free-space ½λ dipole gain benchmark', async () => {
    const freq = 7.1;
    // halfWaveLength returns the total physical ½λ. For the NEC wire we need
    // half of that (the distance from centre to each tip).
    const totalHalfWave = halfWaveLength(freq, 1.0);
    const tip = totalHalfWave / 2;
    const input: SimulationInput = {
      wires: [{
        start: [-tip, 0, 0],
        end: [tip, 0, 0],
        radius: 0.001,
        segments: 21,
        tag: 1,
      }],
      frequencyMHz: freq,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 11 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const r = await engine.simulate(input);
    // Expected free-space ½λ gain = 2.15 dBi within tolerance.
    expect(r.maxGainDbi).toBeGreaterThan(1.9);
    expect(r.maxGainDbi).toBeLessThan(2.4);
    // Resistive impedance near 73Ω (classic textbook value).
    expect(r.impedance.R).toBeGreaterThan(60);
    expect(r.impedance.R).toBeLessThan(90);
    // Wavelength sanity.
    const lambda = C_MHZ_M / freq;
    expect(lambda).toBeCloseTo(42.224, 2);
  }, 30_000);

  it('reports higher gain when above real ground vs free space', async () => {
    const freq = 7.1;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const lambda = C_MHZ_M / freq;

    const fs: SimulationInput = {
      wires: [{ start: [-tip, 0, 0], end: [tip, 0, 0], radius: 0.001, segments: 21, tag: 1 }],
      frequencyMHz: freq,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 11 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    // ½λ height above pastoral ground
    const above: SimulationInput = {
      ...fs,
      wires: [{
        start: [-tip, 0, lambda * 0.5],
        end: [tip, 0, lambda * 0.5],
        radius: 0.001,
        segments: 21,
        tag: 1,
      }],
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
    };

    const rFree = await engine.simulate(fs);
    const rAbove = await engine.simulate(above);

    // Classical result: ½λ above average ground ≈ +5 dB over free space.
    expect(rAbove.maxGainDbi - rFree.maxGainDbi).toBeGreaterThan(3);
    expect(rAbove.maxGainDbi - rFree.maxGainDbi).toBeLessThan(7);
    // Take-off angle above real ground should be above the horizon but
    // well below zenith (typical 20–40° for ½λ height).
    expect(rAbove.takeoffElevationDeg).toBeGreaterThan(15);
    expect(rAbove.takeoffElevationDeg).toBeLessThan(50);
  }, 30_000);

  it('quarter-wave height produces NVIS (high take-off angle)', async () => {
    const freq = 7.1;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const lambda = C_MHZ_M / freq;

    const input: SimulationInput = {
      wires: [{
        start: [-tip, 0, lambda * 0.25],
        end: [tip, 0, lambda * 0.25],
        radius: 0.001,
        segments: 21,
        tag: 1,
      }],
      frequencyMHz: freq,
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
      excitation: { wireTag: 1, segment: 11 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const r = await engine.simulate(input);
    // Classic NVIS take-off: 60°+ elevation.
    expect(r.takeoffElevationDeg).toBeGreaterThan(55);
  }, 30_000);
});
