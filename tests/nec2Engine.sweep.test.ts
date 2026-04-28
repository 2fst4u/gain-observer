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
  }, 60_000);
});
