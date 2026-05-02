import { describe, expect, it } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { selectSimulationInput, useAntennaStore } from '../src/store/antennaStore';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

describe('sweepImpedance with default store input', () => {
  it('produces an impedance result for every sweep point', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());
    const sweep = await engine.sweepImpedance(input, { points: 5, spanFraction: 0.1 });
    expect(sweep).toHaveLength(5);
    for (const p of sweep) {
      expect(Number.isFinite(p.R)).toBe(true);
      expect(Number.isFinite(p.X)).toBe(true);
      expect(Number.isFinite(p.swr)).toBe(true);
      expect(p.R).toBeGreaterThan(0);
    }
    // Center point should be near 73Ω-ish given a ½λ dipole 10m up.
    const centre = sweep[Math.floor(sweep.length / 2)]!;
    expect(centre.R).toBeGreaterThan(40);
    expect(centre.R).toBeLessThan(120);

    // Frequencies should be monotonic.
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]!.frequencyMHz).toBeGreaterThan(sweep[i - 1]!.frequencyMHz);
    }
  }, 60_000);

  it('best SWR is near resonance', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());
    // Span ±20% to ensure we see the dip
    const sweep = await engine.sweepImpedance(input, { points: 11, spanFraction: 0.4 });

    let minSwr = Infinity;
    let bestFreq = 0;
    for (const p of sweep) {
      if (p.swr < minSwr) {
        minSwr = p.swr;
        bestFreq = p.frequencyMHz;
      }
    }

    // Default antenna is resonant at 7.1 MHz.
    expect(bestFreq).toBeGreaterThan(6.5);
    expect(bestFreq).toBeLessThan(7.7);
    // Standard dipole above ground might not hit 1.0 but should be < 2.0
    expect(minSwr).toBeLessThan(2.0);
  }, 60_000);
});
