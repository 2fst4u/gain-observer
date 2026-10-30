import { beforeAll, describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { averageGainLinear } from '../src/physics/patternIntegral';
import type { SimulationInput } from '../src/physics/types';

describe('physical metric boundaries (real NEC)', () => {
  let engine: Nec2Engine;
  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: pathToFileURL(resolve('public/')).href + '/' });
    await engine.init();
  });

  const dipole: SimulationInput = {
    wires: [{ start: [-10, 0, 10], end: [10, 0, 10], radius: 0.001, segments: 41, tag: 1 }],
    frequencyMHz: 7.1, ground: { type: 'real', sigma: 0.005, epsilon: 13 },
    excitation: { wireTag: 1, segment: 21 },
    patternResolution: { thetaSteps: 181, phiSteps: 360 },
  };

  it('separates escaping far-field efficiency from the conductor/network budget', async () => {
    const r = await engine.simulate(dipole);
    expect(r.pattern.integrationThetaMaxDeg).toBe(90);
    expect(r.efficiency).toBe(1);
    expect(r.escapingEfficiency).toBeGreaterThan(0.5);
    expect(r.escapingEfficiency).toBeLessThan(0.9);
    expect(r.escapingEfficiency).toBe(averageGainLinear(r.pattern));
    expect(r.maxGainDbi).toBeCloseTo(r.maxDirectivityDbi! + 10 * Math.log10(r.escapingEfficiency!), 10);
  });

  it('models conductor dissipation rather than assigning every wire unit efficiency', async () => {
    const ideal = await engine.simulate({ ...dipole, ground: { type: 'free' } });
    const copper = await engine.simulate({ ...dipole, ground: { type: 'free' }, conductivitySm: 58e6 });
    const resistive = await engine.simulate({ ...dipole, ground: { type: 'free' }, conductivitySm: 1e6 });
    expect(ideal.efficiency).toBe(1);
    expect(copper.efficiency).toBeLessThan(ideal.efficiency!);
    expect(resistive.efficiency).toBeLessThan(copper.efficiency!);
    expect(resistive.maxGainDbi).toBeLessThan(copper.maxGainDbi);
    expect(copper.terminationDiagnostics.powerBudget!.structureLossW).toBeGreaterThan(0);
    expect(copper.terminationDiagnostics.terminationPowerW).toBe(0);
    expect(Math.abs(10 * Math.log10(copper.escapingEfficiency! / copper.efficiency!))).toBeLessThan(0.03);
  });

  // Electrically tiny, remote wires supply NEC's two circuit ports. Their
  // radiation/coupling is negligible compared with the explicit shunt load.
  const lineInput: SimulationInput = {
    wires: [
      { start: [0, 0, 0], end: [0.01, 0, 0], segments: 1, radius: 0.00001, tag: 1 },
      { start: [0, 100, 0], end: [0.01, 100, 0], segments: 1, radius: 0.00001, tag: 2 },
    ],
    frequencyMHz: 10, ground: { type: 'free' }, excitation: { wireTag: 1, segment: 1 },
    patternResolution: { thetaSteps: 37, phiSteps: 72 },
    transmissionLines: [{
      fromTag: 1, fromSegment: 1, toTag: 2, toSegment: 1,
      z0: 50, lengthM: 7.5, shuntAdmEnd2Real: 0.02,
      lossModel: { physicalLengthM: 10, lossK1: 1.3, lossK2: 0.04 },
    }],
  };

  it('cascades an ideal transformer and distributed line without a shared choke port', async () => {
    const matched = await engine.feedpointImpedance(lineInput);
    const transformed = await engine.feedpointImpedance({
      ...lineInput,
      transmissionLines: lineInput.transmissionLines!.map(line => ({ ...line, impedanceRatio: 9 })),
    });
    expect(matched.R).toBeCloseTo(50, 2);
    expect(transformed.R).toBeCloseTo(450, 1);
    expect(Math.abs(transformed.X)).toBeLessThan(0.2);
  });

  it('recalculates the lossy cable at every sweep frequency', async () => {
    const input: SimulationInput = { ...lineInput,
      transmissionLines: lineInput.transmissionLines!.map(line => ({ ...line, shuntAdmEnd2Real: 1 / 200 })),
    };
    const sweep = await engine.sweepImpedance(input, { points: 3, window: { startMHz: 5, endMHz: 15 } });
    for (const point of sweep) {
      const independentlySolved = await engine.feedpointImpedance({ ...input, frequencyMHz: point.frequencyMHz });
      expect(point.R).toBe(independentlySolved.R);
      expect(point.X).toBe(independentlySolved.X);
    }
    expect(Math.abs(sweep[0]!.R - sweep[1]!.R)).toBeGreaterThan(10);
  });
});
