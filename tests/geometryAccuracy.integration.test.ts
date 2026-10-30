import { beforeAll, describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { buildFoldedAntennaWires } from '../src/store/antennaGeometry';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { averageGainLinear } from '../src/physics/patternIntegral';
import { halfWaveLength } from '../src/physics/constants';
import { FEED_BRIDGE_TAG } from '../src/physics/tags';
import type { SimulationInput } from '../src/physics/types';

function foldedInput(frequency: number, aperture: number, segments = 21): SimulationInput {
  return {
    wires: buildFoldedAntennaWires({
      frequency, aperture, segments,
      length: halfWaveLength(frequency),
      height: 10,
      orientation: 'EW',
      wireRadius: 0.001,
    }),
    frequencyMHz: frequency,
    ground: { type: 'free' },
    excitation: { wireTag: FEED_BRIDGE_TAG, segment: 1 },
    patternResolution: { thetaSteps: 37, phiSteps: 72 },
  };
}

describe('folded-dipole mesh accuracy (real NEC)', () => {
  let engine: Nec2Engine;
  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: pathToFileURL(resolve('public')).href + '/' });
    await engine.init();
  });

  for (const frequency of [1.8, 7.1, 30]) {
    for (const aperture of [0.02, 0.3, 0.5]) {
      it(`conserves power at ${frequency} MHz with ${aperture} m spacing`, async () => {
        const result = await engine.simulate(foldedInput(frequency, aperture));
        // There are no material, termination or ground losses in this deck.
        // Misaligned source/opposite cells previously produced 1.525 here.
        expect(Math.abs(averageGainLinear(result.pattern) - 1)).toBeLessThan(0.005);
        expect(result.maxGainDbi).toBeGreaterThan(2);
        expect(result.maxGainDbi).toBeLessThan(2.5);
      }, 60_000);
    }
  }

  for (const aperture of [0.02, 0.3]) {
    it(`converges in impedance and gain on the former 160 m failure at ${aperture} m spacing`, async () => {
      const coarseInput = foldedInput(1.8, aperture);
      const halfSegments = coarseInput.wires[0]!.segments;
      // Request twice as many cells along each conductor, including a source
      // cell of the same refined length. Refining only the neighbours would
      // introduce a new source discontinuity rather than test convergence.
      const fineInput = foldedInput(1.8, aperture, 4 * halfSegments + 1);
      const coarse = await engine.simulate(coarseInput);
      const fine = await engine.simulate(fineInput);
      const zMagnitude = Math.hypot(fine.impedance.R, fine.impedance.X);
      expect(Math.abs(coarse.impedance.R - fine.impedance.R) / zMagnitude).toBeLessThan(0.01);
      expect(Math.abs(coarse.impedance.X - fine.impedance.X) / zMagnitude).toBeLessThan(0.01);
      expect(Math.abs(coarse.maxGainDbi - fine.maxGainDbi)).toBeLessThan(0.02);
      expect(Math.abs(averageGainLinear(fine.pattern) - 1)).toBeLessThan(0.005);
    }, 120_000);
  }
});
