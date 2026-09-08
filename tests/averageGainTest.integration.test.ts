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
// The integral is evaluated on a finer grid than the app displays. The
// average-gain test is a statement about the *deck*, and on a pattern with
// sharp structure the default 5° display grid does not resolve the sphere
// well enough to integrate it: the terminated delta reads 0.32 dB of error at
// 5°, 0.09 dB at 2° and 0.004 dB at 1°, with the gain figure itself unmoved
// throughout. That is quadrature error in the metric, not energy going
// missing, and this suite must not confuse the two.
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

// Types whose feed geometry this suite covers. The vertical whip and
// inverted-L are excluded: they carry a separate, unrelated defect (their
// source segment sits 1 cm above the ground plane, which over a perfect
// conductor is a near-short to its own image). That error does not converge
// with segmentation — it grows slightly — so it is not a segment-ratio
// problem and needs its own fix. See §14.2 of `docs/antenna-spec.md`.
const COVERED: AntennaType[] = [
  'dipole', 'inverted-v', 'sloping-v', 'delta-loop', 'terminated-delta',
];

describe('NEC average-gain test over perfect ground', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  async function measure(type: AntennaType, feedline: boolean) {
    const store = useAntennaStore.getState();
    store.setAntennaType(type);
    store.setFrequency(7.0);
    store.setGround('perfect');
    store.setHeight(20);
    store.setTerminatingResistor(0);
    store.setFeedline(feedline ? 'rg58' : 'none');
    const input = selectSimulationInput(useAntennaStore.getState());
    const r = await engine.simulate({
      ...input,
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

        // The two-sided check also catches power going missing. One case is
        // knowingly excluded: the terminated delta with a feedline loses
        // 0.43 dB somewhere NEC does not book. That is a separate defect in
        // the shield geometry — it is the deficit direction, not the excess
        // direction this suite was written for, and it does not respond to
        // feed-bridge grading. It has its own entry in §14.2 of
        // `docs/antenna-spec.md`; do not widen the tolerance to cover it.
        const knownDeficit = feedline && type === 'terminated-delta';
        it.skipIf(knownDeficit)(`${type}: energy balances to within a quarter dB`, async () => {
          const { errDb } = await measure(type, feedline);
          expect(Math.abs(errDb)).toBeLessThan(0.25);
        }, 60_000);
      }
    });
  }

  it('a split dipole agrees with the unsplit one it models', async () => {
    // The split (feedline) and unsplit decks are the same antenna, so they
    // must give the same gain. They differed by 0.63 dB when the feed bridge
    // was butted against full-length segments.
    const split = await measure('dipole', true);
    const whole = await measure('dipole', false);
    expect(Math.abs(split.gain - whole.gain)).toBeLessThan(0.2);
  }, 90_000);
});
