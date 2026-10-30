// NEC's average-gain test, run against the real solver for every antenna type.
//
// Integrating NEC's power gain over the whole sphere recovers the fraction of
// the source's input power that actually left as a far field:
//
//     <G> = (1/4π) ∮ G(θ,φ) dΩ = P_far-field / P_in
//
// Over a *perfect* ground nothing absorbs power except the deck's own LD
// cards, so <G> must land on the power budget's efficiency. Two failures are
// possible and they mean different things:
//
//   • <G> above efficiency is physically impossible — the deck radiates more
//     power than it is fed. It always means the model is wrong, never that
//     the antenna is unusual.
//   • <G> below efficiency means power vanished somewhere NEC did not book.
//
// Use scientific angular resolution and the correct hemisphere endpoint.
// A ground pattern's nonzero horizon is half weighted; treating it as an
// interior full-sphere sample invents power below ground and can misdiagnose
// otherwise valid vertical models as an energy-conservation failure.
//
// This is the check that catches feed-geometry errors nothing else can see.
// A deck can have every wire in the right place, every tag correct and every
// card well-formed, and still be wrong: before graded segmentation was
// applied at the feed bridges, a split half-wave dipole reported 8.50 dBi
// against the correct 7.87 dBi and radiated 127 % of its input power. Every
// structural test passed throughout. Only asking the solver whether the
// energy balances finds it.
import { describe, expect, it, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { averageGainLinear } from '../src/physics/patternIntegral';
import type { AntennaType } from '../src/physics/types';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

const COVERED: AntennaType[] = [
  'dipole', 'inverted-v', 'sloping-v', 'delta-loop', 'terminated-delta',
  'vertical-whip', 'inverted-l', 'folded-dipole',
];

describe('NEC average-gain test over perfect ground', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  async function measure(type: AntennaType, feedline: boolean, losslessLine = false) {
    const store = useAntennaStore.getState();
    store.setAntennaType(type);
    store.setFrequency(7.0);
    store.setGround('perfect');
    store.setHeight(20);
    store.setTerminatingResistor(0);
    store.setFeedline(feedline ? 'rg58' : 'none');
    store.setFeedlineLength(feedline ? 10 : 0);
    // The choked terminated-delta feedline is rejected pending a converged
    // junction model. Its unchoked feedline remains available and is tested.
    if (type === 'terminated-delta' && feedline) store.setTransformerEnabled(false);
    const input = selectSimulationInput(useAntennaStore.getState());
    const r = await engine.simulate({
      ...input,
      transmissionLines: losslessLine
        ? input.transmissionLines?.map(line => ({ ...line, lossModel: undefined }))
        : input.transmissionLines,
      patternResolution: { thetaSteps: 181, phiSteps: 360 },
    });
    const avg = averageGainLinear(r.pattern);
    const eff = r.efficiency ?? 1;
    return { avg, eff, errDb: 10 * Math.log10(avg / eff), gain: r.maxGainDbi };
  }

  for (const feedline of [false, true]) {
    describe(feedline ? 'with a feedline fitted' : 'no feedline', () => {
      for (const type of COVERED) {
        it(`${type}: radiates no more power than it is fed`, async () => {
          const { errDb } = await measure(type, feedline);
          // The impossible direction. Held tight, because a feed-geometry
          // error shows up here first and nowhere else.
          expect(errDb).toBeLessThan(0.2);
        }, 60_000);

        it(`${type}: energy balances to within a quarter dB`, async () => {
          const { errDb } = await measure(type, feedline);
          expect(Math.abs(errDb)).toBeLessThan(0.25);
        }, 60_000);
      }
    });
  }

  it('rejects the known nonconverged choked terminated-delta feedline in both solve paths', async () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7);
    store.setHeight(20);
    store.setFeedline('rg58');
    store.setFeedlineLength(10);
    store.setTransformerEnabled(true);
    const input = selectSimulationInput(useAntennaStore.getState());
    await expect(engine.simulate(input)).rejects.toThrow('power-convergence');
    await expect(engine.feedpointImpedance(input)).rejects.toThrow('power-convergence');
  });

  it('a split dipole with an ideal differential line agrees with the unsplit geometry', async () => {
    // The split (feedline) and unsplit decks are the same antenna, so they
    // must give the same gain. They differed by 0.63 dB when the feed bridge
    // was butted against full-length segments.
    // Isolate feed-geometry accuracy from the now explicitly modelled cable
    // attenuation; a real lossy line should reduce accepted-power gain.
    const split = await measure('dipole', true, true);
    const whole = await measure('dipole', false);
    expect(Math.abs(split.gain - whole.gain)).toBeLessThan(0.2);
  }, 90_000);
});
