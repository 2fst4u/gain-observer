// Regression test: delta loop with feedline at low mast heights must produce
// valid NEC results (no -999.99 gain sentinel, no negative R).
import { describe, it, beforeAll } from 'vitest';
import { expect } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { selectSimulationInput } from '../src/store/antennaStore';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { AntennaState } from '../src/store/antennaStore';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

function makeState(mhz: number, height: number, feedlineId: string): Partial<AntennaState> {
  const lambda = 299.792458 / mhz;
  return {
    antennaType: 'delta-loop',
    frequency: mhz,
    length: lambda,
    height,
    orientation: 'EW',
    wireRadius: 0.001,
    segments: 21,
    vAngle: 180,
    legSlope: 0,
    terminatingResistor: 0,
    feedlineId,
    feedlineLength: 10,
    feedlineOffset: 0,
    groundId: 'pastoral',
    groundSigma: 0.005,
    groundEpsilon: 13,
    transformerEnabled: false,
    transformerRatio: 9,
  };
}

describe('Delta Loop feedline fix regression', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  it.each([
    { name: '160m', mhz: 1.900, height: 8 },
    { name: '160m', mhz: 1.900, height: 8.5 },
    { name: '80m',  mhz: 3.650, height: 8 },
    { name: '80m',  mhz: 3.650, height: 8.5 },
    { name: '60m',  mhz: 5.358, height: 8 },
    { name: '60m',  mhz: 5.358, height: 8.5 },
    { name: '40m',  mhz: 7.100, height: 8 },
    { name: '40m',  mhz: 7.100, height: 10 },
  ])('$name h=$height feedline=rg58 produces valid pattern', async ({ mhz, height }) => {
    const state = makeState(mhz, height, 'rg58');
    const input = selectSimulationInput(state as AntennaState);
    const result = await engine.simulate(input);
    expect(result.maxGainDbi, 'gain must not be -999.99 sentinel').toBeGreaterThan(-50);
    expect(result.impedance.R, 'resistance must be positive').toBeGreaterThan(0);
  }, 30_000);
});
