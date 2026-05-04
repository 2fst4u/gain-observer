// Integration test: the real Nec2Engine wrapper against the real Wasm binary,
// via the Node-side entry. We bypass the default `/nec2.js` URL loader because
// jsdom doesn't serve files; instead we stub loadNec2Factory behaviour by
// monkey-patching the module-level dynamic import through a relative file URL.
//
// This guards the full pipeline:
//   SimulationInput → necCard → callMain() → parseNecOutput → SimulationResult.

import { describe, expect, it, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { halfWaveLength, wavelengthMeters } from '../src/physics/constants';
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
    const lambda = wavelengthMeters(freq);
    expect(lambda).toBeCloseTo(42.224, 2);
  }, 30_000);

  it('reports higher gain when above real ground vs free space', async () => {
    const freq = 7.1;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const lambda = wavelengthMeters(freq);

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
    const lambda = wavelengthMeters(freq);

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

  it('pattern data integrity and symmetry', async () => {
    const freq = 14.2;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const input: SimulationInput = {
      wires: [{ start: [-tip, 0, 0], end: [tip, 0, 0], radius: 0.001, segments: 15, tag: 1 }],
      frequencyMHz: freq,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 8 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const r = await engine.simulate(input);
    const p = r.pattern;

    expect(p.data.length).toBe(37 * 72);
    expect(r.maxGainDbi).toBeCloseTo(2.1, 0.5);

    // Symmetry check: Free space dipole at origin, E-W.
    // Gain at (theta=90, phi=0) should match (theta=90, phi=180) - the wire axis nulls
    // Gain at (theta=90, phi=90) should match (theta=90, phi=270) - broadside peaks
    const dTheta = 5;
    const dPhi = 5;
    const t90 = 90 / dTheta;
    const p0 = 0 / dPhi;
    const p90 = 90 / dPhi;
    const p180 = 180 / dPhi;
    const p270 = 270 / dPhi;

    const val0 = p.data[t90 * 72 + p0];
    const val180 = p.data[t90 * 72 + p180];
    const val90 = p.data[t90 * 72 + p90];
    const val270 = p.data[t90 * 72 + p270];

    expect(val0).toBeCloseTo(val180, 1);
    expect(val90).toBeCloseTo(val270, 1);
    expect(val90).toBeGreaterThan(val0 + 20); // Deep nulls on axis
  }, 30_000);

  it('ground comparison: free vs perfect vs real', async () => {
    const freq = 7.1;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const h = 10;
    const base: SimulationInput = {
      wires: [{ start: [-tip, 0, h], end: [tip, 0, h], radius: 0.001, segments: 15, tag: 1 }],
      frequencyMHz: freq,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 8 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const rFree = await engine.simulate(base);
    const rPerf = await engine.simulate({ ...base, ground: { type: 'perfect' } });
    const rReal = await engine.simulate({ ...base, ground: { type: 'real', sigma: 0.005, epsilon: 13 } });

    expect(rPerf.maxGainDbi).toBeGreaterThan(rFree.maxGainDbi);
    expect(rPerf.maxGainDbi).toBeGreaterThan(rReal.maxGainDbi);
    expect(rReal.maxGainDbi).toBeGreaterThan(rFree.maxGainDbi);

    expect(rPerf.impedance.R).not.toEqual(rReal.impedance.R);
    expect(rPerf.impedance.R).not.toEqual(rFree.impedance.R);
  }, 30_000);

  it('handles small heights without crashing', async () => {
    const freq = 7.1;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const input: SimulationInput = {
      wires: [{ start: [-tip, 0, 0.1], end: [tip, 0, 0.1], radius: 0.001, segments: 15, tag: 1 }],
      frequencyMHz: freq,
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
      excitation: { wireTag: 1, segment: 8 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const r = await engine.simulate(input);
    expect(Number.isFinite(r.maxGainDbi)).toBe(true);
    expect(r.impedance.R).toBeGreaterThan(0);
  }, 30_000);

  it('handles concurrent simulate() calls by serializing them', async () => {
    const freq = 7.1;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const input: SimulationInput = {
      wires: [{ start: [-tip, 0, 10], end: [tip, 0, 10], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: freq,
      ground: { type: 'free' },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };

    // Fire two simulations at once. The engine lock should handle it.
    const [r1, r2] = await Promise.all([
      engine.simulate(input),
      engine.simulate({ ...input, frequencyMHz: 14.2 }),
    ]);

    expect(r1.impedance.R).toBeGreaterThan(60);
    // 40m dipole (~20m long) at 14.2 MHz is approx 1 wavelength long.
    // Feedpoint impedance at the center of a 1-wave wire is very high (thousands of ohms).
    expect(r2.impedance.R).toBeGreaterThan(1000);
    expect(r1.computeTimeMs).toBeGreaterThan(0);
    expect(r2.computeTimeMs).toBeGreaterThan(0);
  }, 60_000);

  it('feedline shield + TL card produces a physical solve and shifts the pattern', async () => {
    // Compare a baseline directly-fed dipole against the same dipole with a
    // long unchoked coax-shield wire dropping vertically to the rig. The
    // shield should radiate (common-mode current) and visibly perturb the
    // pattern. The simulation must still converge to a sensible R+jX at
    // the rig end of the TL card.
    const freq = 14.15;
    const tip = halfWaveLength(freq, 0.95) / 2;
    const h = 10;

    const baseline: SimulationInput = {
      wires: [
        { start: [-tip, 0, h], end: [tip, 0, h], radius: 0.001, segments: 21, tag: 1 },
      ],
      frequencyMHz: freq,
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
      excitation: { wireTag: 1, segment: 11 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const withFeedline: SimulationInput = {
      wires: [
        { start: [-tip, 0, h], end: [tip, 0, h], radius: 0.001, segments: 21, tag: 1 },
        { start: [0, 0, h], end: [0, 0, 0.1], radius: 0.005, segments: 11, tag: 2 },
      ],
      frequencyMHz: freq,
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
      excitation: { wireTag: 2, segment: 11 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
      transmissionLines: [{
        fromTag: 1,
        fromSegment: 11,
        toTag: 2,
        toSegment: 11,
        z0: 50,
        // Electrical length = physical (~9.9m) / VF (0.66) for RG-58.
        lengthM: (h - 0.1) / 0.66,
      }],
    };

    const rBase = await engine.simulate(baseline);
    const rFeed = await engine.simulate(withFeedline);

    // Sanity: both runs return finite numbers.
    expect(Number.isFinite(rBase.maxGainDbi)).toBe(true);
    expect(Number.isFinite(rFeed.maxGainDbi)).toBe(true);
    expect(rFeed.impedance.R).toBeGreaterThan(0);

    // Pattern should be different — common-mode shield current changes the
    // pattern, especially near zenith and along the broadside.
    const p1 = rBase.pattern.data;
    const p2 = rFeed.pattern.data;
    let totalDiff = 0;
    let n = 0;
    for (let i = 0; i < p1.length; i++) {
      const a = p1[i] ?? 0;
      const b = p2[i] ?? 0;
      if (Number.isFinite(a) && Number.isFinite(b)) {
        totalDiff += Math.abs(a - b);
        n++;
      }
    }
    const avgDiff = totalDiff / Math.max(1, n);
    // We expect at least some perturbation from the radiating shield. The
    // magnitude is geometry/frequency-dependent — at 14 MHz with a 10 m
    // vertical shield it's small but non-zero. The choking-balun test
    // below provides the more discriminating physical check.
    expect(avgDiff).toBeGreaterThan(0.02);
  }, 60_000);

  it('balun (LD on shield) suppresses common-mode current vs unchoked', async () => {
    // Identical geometry except for an LD high-impedance load on the top
    // segment of the shield. The choked variant's pattern should be closer
    // to the directly-fed baseline than the unchoked variant.
    const freq = 14.15;
    const tip = halfWaveLength(freq, 0.95) / 2;
    const h = 10;

    const wires = [
      { start: [-tip, 0, h] as [number, number, number], end: [tip, 0, h] as [number, number, number], radius: 0.001, segments: 21, tag: 1 },
      { start: [0, 0, h] as [number, number, number], end: [0, 0, 0.1] as [number, number, number], radius: 0.005, segments: 11, tag: 2 },
    ];
    const tl = [{
      fromTag: 1,
      fromSegment: 11,
      toTag: 2,
      toSegment: 11,
      z0: 50,
      lengthM: (h - 0.1) / 0.66,
    }];
    const common: SimulationInput = {
      wires,
      frequencyMHz: freq,
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
      excitation: { wireTag: 2, segment: 11 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
      transmissionLines: tl,
    };

    const baseline: SimulationInput = {
      wires: [wires[0]],
      frequencyMHz: freq,
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
      excitation: { wireTag: 1, segment: 11 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const rBase = await engine.simulate(baseline);
    const rUnchoked = await engine.simulate(common);
    const rChoked = await engine.simulate({
      ...common,
      loads: [
        { type: 4, wireTag: 2, segmentStart: 1, segmentEnd: 1, param1: 5000, param2: 0 },
      ],
    });

    function meanAbsDiff(a: Float32Array, b: Float32Array): number {
      let s = 0;
      let n = 0;
      for (let i = 0; i < a.length; i++) {
        const va = a[i] ?? 0;
        const vb = b[i] ?? 0;
        if (Number.isFinite(va) && Number.isFinite(vb)) {
          s += Math.abs(va - vb);
          n++;
        }
      }
      return s / Math.max(1, n);
    }

    const dUnchoked = meanAbsDiff(rBase.pattern.data, rUnchoked.pattern.data);
    const dChoked = meanAbsDiff(rBase.pattern.data, rChoked.pattern.data);

    // The choked pattern must be at least slightly closer to the baseline
    // than the unchoked pattern. Because the choke is finite (5 kΩ) it
    // won't reach the baseline exactly.
    expect(dChoked).toBeLessThan(dUnchoked);
  }, 90_000);

  it('verifies azimuth wrapping consistency (phi 0 vs 360)', async () => {
    const freq = 7.1;
    const tip = halfWaveLength(freq, 1.0) / 2;
    const input: SimulationInput = {
      wires: [{ start: [-tip, 0, 10], end: [tip, 0, 10], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: freq,
      ground: { type: 'real', sigma: 0.005, epsilon: 13 },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 37, phiSteps: 72 },
    };

    const r = await engine.simulate(input);
    const p = r.pattern;

    // NEC-2 RP card calculates phi from 0 to 360-dPhi if we ask for phiSteps.
    // In our parser, we use modulo phiSteps.
    // Let's check that phi=0 and the last phi are what we expect.
    // For 72 steps of 5deg, phi indices are 0..71 corresponding to 0..355 deg.

    const t90 = 18; // 90 deg theta
    const g0 = p.data[t90 * 72 + 0];
    const gLast = p.data[t90 * 72 + 71];

    // In a symmetric dipole, g0 (phi=0) and gLast (phi=355) should be very close.
    expect(Math.abs(g0 - gLast)).toBeLessThan(1.0);
  }, 30_000);
});
