import { beforeAll, describe, expect, it } from 'vitest';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { phiToBearingDeg } from '../src/physics/angles';
import { displayedFeedMetrics } from '../src/physics/impedance';
import { useAntennaStore, selectSimulationInput, isFeedlineActive } from '../src/store/antennaStore';

describe('3-element wire Yagi (real NEC)', () => {
  let engine: Nec2Engine;
  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: pathToFileURL(resolve('public/')).href + '/' });
    await engine.init();
  });

  async function solve(heading: number) {
    const store = useAntennaStore.getState();
    store.setFrequency(7.1);
    store.setAntennaType('yagi');
    store.setHeight(8);
    store.setOrientation(heading);
    const s = useAntennaStore.getState();
    const r = await engine.simulate({ ...selectSimulationInput(s), patternResolution: { thetaSteps: 91, phiSteps: 180 } });
    return { r, m: displayedFeedMetrics(r, { transformerEnabled: s.transformerEnabled, transformerRatio: s.transformerRatio, feedlineActive: isFeedlineActive(s) }) };
  }

  it('matches 50 Ω coax at the default length and beams along the heading', async () => {
    const { r, m } = await solve(90);
    expect(m.displayedSwr).toBeLessThan(1.5);
    expect(phiToBearingDeg(r.takeoffAzimuthDeg)).toBeCloseTo(90, 0);
    expect(r.terminationDiagnostics.frontBackDb!).toBeGreaterThan(15);
    // A 3-element beam has several dB more gain than a dipole at the same height.
    expect(r.maxDirectivityDbi! - 7.7).toBeGreaterThan(1.5);
  }, 60000);

  it('rotates with the heading', async () => {
    const { r } = await solve(200);
    expect(phiToBearingDeg(r.takeoffAzimuthDeg)).toBeCloseTo(200, -1);
  }, 60000);
});
