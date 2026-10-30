import { describe, expect, it } from 'vitest';
import { selectSimulationInput, useAntennaStore } from '../src/store/antennaStore';
import { FEEDLINE_SHIELD_TAG, FEED_BRIDGE_TAG } from '../src/physics/tags';
import { buildNecCards } from '../src/physics/necCard';
import type { Wire } from '../src/physics/types';

const shieldWires = (wires: readonly Wire[]) => wires.filter(w => w.tag === FEEDLINE_SHIELD_TAG);
const wireLength = (w: Wire) => Math.hypot(...w.end.map((v, i) => v - w.start[i]));

describe('physical cable routing', () => {
  for (const antennaType of ['dipole', 'delta-loop', 'terminated-delta'] as const) {
    it.each([10, 200])(`preserves the full %sm cable for ${antennaType} without a second loop junction`, feedlineLength => {
      const state = { ...useAntennaStore.getState(), antennaType, length: 42,
        height: 8, orientation: 37, frequency: 7.1, feedlineId: 'rg58',
        feedlineLength, terminatingResistor: 600 };
      const input = selectSimulationInput(state);
      const shields = shieldWires(input.wires);
      const bridge = input.wires.find(w => w.tag === FEED_BRIDGE_TAG)!;
      expect(shields[0]!.start).toEqual(bridge.end);
      for (let i = 1; i < shields.length; i++) expect(shields[i]!.start).toEqual(shields[i - 1]!.end);
      expect(shields.reduce((sum, w) => sum + wireLength(w), 0)).toBeCloseTo(feedlineLength, 8);
      const rigEnd = shields[shields.length - 1]!.end;
      for (const wire of input.wires.filter(w => w.tag !== FEEDLINE_SHIELD_TAG)) {
        expect(rigEnd).not.toEqual(wire.start);
        expect(rigEnd).not.toEqual(wire.end);
      }
      const higher = selectSimulationInput({ ...state, frequency: 30 });
      const refined = shieldWires(higher.wires);
      expect(refined.map(w => [w.start, w.end])).toEqual(shields.map(w => [w.start, w.end]));
      const refinedSegments = refined.reduce((sum, w) => sum + w.segments, 0);
      expect(refinedSegments).toBeGreaterThanOrEqual(Math.ceil(20 * feedlineLength / (299.792458 / 30)));
      expect(higher.excitation.segment).toBe(refinedSegments);
      expect(higher.transmissionLines![0].toSegment).toBe(refinedSegments);
    });
  }

  it('drops a dipole feedline straight down when it is shorter than the height', () => {
    const state = { ...useAntennaStore.getState(), antennaType: 'dipole' as const, length: 20,
      height: 10, orientation: 37, frequency: 7.1, feedlineId: 'rg58', feedlineLength: 6 };
    const shields = shieldWires(selectSimulationInput(state).wires);
    expect(shields).toHaveLength(1);
    expect(shields[0]!.end[0]).toBeCloseTo(shields[0]!.start[0], 9);
    expect(shields[0]!.end[1]).toBeCloseTo(shields[0]!.start[1], 9);
    expect(shields[0]!.end[2]).toBeCloseTo(4, 9);
  });

  it('bends a long dipole feedline at the ground and runs it horizontally away from the antenna', () => {
    const state = { ...useAntennaStore.getState(), antennaType: 'dipole' as const, length: 20,
      height: 10, orientation: 37, frequency: 7.1, feedlineId: 'rg58', feedlineLength: 30,
      groundId: 'perfect' };
    const input = selectSimulationInput(state);
    const [drop, run, ...rest] = shieldWires(input.wires);
    expect(rest).toHaveLength(0);
    // Straight down to ground clearance…
    expect(drop!.end[0]).toBeCloseTo(drop!.start[0], 9);
    expect(drop!.end[1]).toBeCloseTo(drop!.start[1], 9);
    expect(drop!.end[2]).toBeCloseTo(0.1, 9);
    // …then level along the ground, at right angles to the antenna.
    expect(run!.start).toEqual(drop!.end);
    expect(run!.end[2]).toBeCloseTo(0.1, 9);
    expect(wireLength(run!)).toBeCloseTo(30 - 9.9, 8);
    const bridge = input.wires.find(w => w.tag === FEED_BRIDGE_TAG)!;
    const along = [bridge.end[0] - bridge.start[0], bridge.end[1] - bridge.start[1]];
    const out = [run!.end[0] - run!.start[0], run!.end[1] - run!.start[1]];
    expect(along[0]! * out[0]! + along[1]! * out[1]!).toBeCloseTo(0, 9);
  });

  it('rejects ground grids that would silently lose the horizon integration endpoint', () => {
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(() => buildNecCards({ ...input, ground: { type: 'perfect' },
      patternResolution: { thetaSteps: 36, phiSteps: 72 } })).toThrow(/horizon/);
  });
});
