import { beforeAll, describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import type { DeltaFeed } from '../src/store/antennaGeometry';

describe('corner-fed delta loop (real NEC)', () => {
  let engine: Nec2Engine;
  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: pathToFileURL(resolve('public/')).href + '/' });
    await engine.init();
  });

  async function solve(feed: DeltaFeed) {
    const original = useAntennaStore.getState();
    const store = useAntennaStore.getState();
    store.setFrequency(7.1);
    store.setAntennaType('delta-loop');
    store.setHeight(8);
    useAntennaStore.getState().setDeltaFeed(feed);
    useAntennaStore.getState().setHalfWaveLength();
    useAntennaStore.setState({ feedlineId: 'rg58', feedlineLength: 10 });
    const input = { ...selectSimulationInput(useAntennaStore.getState()), patternResolution: { thetaSteps: 91, phiSteps: 180 } };
    useAntennaStore.setState(original, true);
    return engine.simulate(input);
  }

  it('radiates at low angles in all directions where the apex feed goes upwards', async () => {
    const apex = await solve('apex');
    const corner = await solve('corner');
    expect(apex.takeoffElevationDeg).toBeGreaterThan(70);
    expect(corner.takeoffElevationDeg).toBeLessThan(40);
    const row = Math.round((90 - 16) / 2) * 180;
    const at16 = Array.from({ length: 180 }, (_, p) => corner.pattern.data[row + p]!);
    expect(Math.max(...at16) - Math.min(...at16)).toBeLessThan(8);
    const apex16 = Math.max(...Array.from({ length: 180 }, (_, p) => apex.pattern.data[row + p]!));
    expect(Math.max(...at16) - apex16).toBeGreaterThan(5);
    expect(corner.swr).toBeLessThan(3);
  }, 120000);
});
