// At vAngle = 180° the sloping V *is* an inverted V.
//
// Its legs are opposed, and its droop is whatever puts the tips on the
// ground floor; an inverted V whose vAngle is small enough to clamp against
// that same floor has identical wires. Same wires must give the same answer,
// and for a long time they did not: the sloping V offset both leg ends along
// the orientation axis rather than along their own legs, so at 180° the feed
// bridge sat at right angles to the legs and the "V" was really a pair of
// parallel lines FEED_BRIDGE_LENGTH_M apart. That cost a steady 0.17-0.20 dB
// and ~160 Ω of reactance, at every level of segment refinement.
//
// The two differ in azimuth by 90° by convention: a sloping V's orientation
// is its boresight, and at 180° its legs run across that, while an inverted
// V's orientation is the leg axis itself. So sloping V NS is compared here
// against inverted V EW.
import { describe, expect, it, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildSlopingVWires, slopingVBridgeLength, slopingVLegLength } from '../src/store/antennaGeometry';
import { FEED_BRIDGE_LENGTH_M } from '../src/physics/constants';
import { LEFT_LEG_TAG, RIGHT_LEG_TAG, FEED_BRIDGE_TAG } from '../src/physics/tags';
import type { Orientation } from '../src/store/antennaStore';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

const FREQ = 7.1, HEIGHT = 15, LENGTH = 40;
// legLen 19.95 m against a 14.5 m drop clamps the slope at 46.62°, so any
// inverted-V vAngle at or below ~86.8° lands its tips on the same floor.
const MATCHED_INVERTED_V_ANGLE = 80;

describe('Sloping V at 180° equals the inverted V it is', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  function simulate(type: 'sloping-v' | 'inverted-v', vAngle: number, orientation: Orientation, ground: string) {
    const store = useAntennaStore.getState();
    store.setAntennaType(type);
    store.setFrequency(FREQ);
    store.setGround(ground);
    store.setHeight(HEIGHT);
    store.setLength(LENGTH);
    store.setOrientation(orientation);
    store.setVAngle(vAngle);
    store.setTerminatingResistor(0);
    store.setFeedline('none');   // last: setAntennaType can re-enable it
    return engine.simulate(selectSimulationInput(useAntennaStore.getState()));
  }

  for (const ground of ['pastoral', 'perfect']) {
    it(`gain and feedpoint match over ${ground} ground`, async () => {
      const slopingV = await simulate('sloping-v', 180, 'NS', ground);
      const invertedV = await simulate('inverted-v', MATCHED_INVERTED_V_ANGLE, 'EW', ground);

      expect(slopingV.maxGainDbi).toBeCloseTo(invertedV.maxGainDbi, 1);
      expect(slopingV.takeoffElevationDeg).toBe(invertedV.takeoffElevationDeg);
      // Feedpoint is the sensitive one — the old geometry was ~160 Ω out.
      expect(slopingV.impedance.R).toBeCloseTo(invertedV.impedance.R, -1);
      expect(slopingV.impedance.X).toBeCloseTo(invertedV.impedance.X, -1);
    }, 90_000);
  }

  it('the feed bridge is collinear with the legs at 180°', async () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('sloping-v');
    store.setFrequency(FREQ); store.setHeight(HEIGHT); store.setLength(LENGTH);
    store.setOrientation('NS'); store.setVAngle(180);
    const wires = buildSlopingVWires({
      length: LENGTH, height: HEIGHT, orientation: 'NS', wireRadius: 0.001,
      segments: 21, frequency: FREQ, vAngle: 180, legSlope: 0,
    });

    const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
    const left = wires.filter((w) => w.tag === LEFT_LEG_TAG);
    const right = wires.filter((w) => w.tag === RIGHT_LEG_TAG);

    // The legs must meet the bridge end-to-end, with no lateral offset: the
    // whole structure lies in one vertical plane.
    const leftInner = left[left.length - 1]!.end;
    const rightInner = right[0]!.start;
    for (const [a, b] of [[leftInner, bridge.start], [rightInner, bridge.end]] as const) {
      for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i]!, 6);
    }

    // Every leg point shares the bridge's perpendicular coordinate — i.e. the
    // legs are collinear with the bridge, not parallel lines beside it.
    const perpendicular = bridge.start[1];
    for (const w of [...left, ...right]) {
      expect(w.start[1]).toBeCloseTo(perpendicular, 6);
      expect(w.end[1]).toBeCloseTo(perpendicular, 6);
    }
  });

  it('the feed gap stays one bridge wide as the legs close up', () => {
    // Holding the gap constant (rather than the setback) is what keeps a
    // narrow V's bridge from becoming an order of magnitude shorter than the
    // segments beside it — the adjacent-segment-ratio trap of §14.1.
    const legLen = slopingVLegLength(LENGTH);
    for (const vAngle of [10, 45, 90, 180]) {
      expect(slopingVBridgeLength(vAngle, legLen)).toBeCloseTo(FEED_BRIDGE_LENGTH_M, 6);
    }
    // A very short antenna cannot afford the setback, so the gap narrows
    // rather than eating the leg — but never grows beyond one bridge.
    const tiny = slopingVLegLength(2);
    expect(slopingVBridgeLength(10, tiny)).toBeLessThanOrEqual(FEED_BRIDGE_LENGTH_M + 1e-9);
    expect(slopingVBridgeLength(10, tiny)).toBeGreaterThan(0);
  });
});
