import { describe, expect, it } from 'vitest';
import { selectSimulationInput, useAntennaStore } from '../src/store/antennaStore';
import { FEEDLINE_SHIELD_TAG, FEED_BRIDGE_TAG } from '../src/physics/tags';
import { buildNecCards } from '../src/physics/necCard';

describe('physical cable routing', () => {
  for (const antennaType of ['dipole', 'delta-loop', 'terminated-delta'] as const) {
    it.each([10, 200])(`preserves the full %sm cable for ${antennaType} without a second loop junction`, feedlineLength => {
      const state = { ...useAntennaStore.getState(), antennaType, length: 42,
        height: 8, orientation: 37, frequency: 7.1, feedlineId: 'rg58',
        feedlineLength, terminatingResistor: 600 };
      const input = selectSimulationInput(state);
      const shield = input.wires.find(w => w.tag === FEEDLINE_SHIELD_TAG)!;
      const bridge = input.wires.find(w => w.tag === FEED_BRIDGE_TAG)!;
      expect(shield.start).toEqual(bridge.end);
      expect(Math.hypot(...shield.end.map((v, i) => v - shield.start[i])))
        .toBeCloseTo(feedlineLength, 8);
      for (const wire of input.wires.filter(w => w.tag !== FEEDLINE_SHIELD_TAG)) {
        expect(shield.end).not.toEqual(wire.start);
        expect(shield.end).not.toEqual(wire.end);
      }
      const higher = selectSimulationInput({ ...state, frequency: 30 });
      const refined = higher.wires.find(w => w.tag === FEEDLINE_SHIELD_TAG)!;
      expect(refined.start).toEqual(shield.start);
      expect(refined.end).toEqual(shield.end);
      expect(refined.segments).toBeGreaterThanOrEqual(Math.ceil(20 * feedlineLength / (299.792458 / 30)));
      expect(higher.excitation.segment).toBe(refined.segments);
      expect(higher.transmissionLines![0].toSegment).toBe(refined.segments);
    });
  }

  it('rejects ground grids that would silently lose the horizon integration endpoint', () => {
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(() => buildNecCards({ ...input, ground: { type: 'perfect' },
      patternResolution: { thetaSteps: 36, phiSteps: 72 } })).toThrow(/horizon/);
  });
});
