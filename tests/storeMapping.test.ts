import { describe, expect, it } from 'vitest';
import { useAntennaStore, selectSimulationInput, buildWires, buildGroundParams } from '../src/store/antennaStore';

describe('antennaStore mapping', () => {
  it('buildWires produces correct geometry for orientations', () => {
    const state = {
      length: 20,
      height: 10,
      orientation: 'EW' as const,
      wireRadius: 0.001,
      segments: 11,
    };

    const ew = buildWires(state);
    expect(ew[0].start).toEqual([-10, 0, 10]);
    expect(ew[0].end).toEqual([10, 0, 10]);

    const ns = buildWires({ ...state, orientation: 'NS' });
    expect(ns[0].start).toEqual([0, -10, 10]);
    expect(ns[0].end).toEqual([0, 10, 10]);

    const nesw = buildWires({ ...state, orientation: 'NE-SW' });
    const c = Math.SQRT1_2 * 10;
    expect(nesw[0].start[0]).toBeCloseTo(-c);
    expect(nesw[0].start[1]).toBeCloseTo(-c);
  });

  it('buildGroundParams handles free/perfect/real correctly', () => {
    const state = useAntennaStore.getState();

    // Default is 10m up, so not free by height alone
    const gReal = buildGroundParams({ ...state, groundId: 'clay', height: 10 });
    expect(gReal.type).toBe('real');

    const gPerf = buildGroundParams({ ...state, groundId: 'perfect', height: 10 });
    expect(gPerf.type).toBe('perfect');

    const gFree = buildGroundParams({ ...state, groundId: 'free', height: 10 });
    expect(gFree.type).toBe('free');

    const gHeight0 = buildGroundParams({ ...state, height: 0 });
    expect(gHeight0.type).toBe('free');
  });

  it('selectSimulationInput maps everything correctly', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput(state);

    expect(input.frequencyMHz).toBe(state.frequency);
    expect(input.wires).toHaveLength(1);
    expect(input.wires[0].segments).toBe(state.segments);
    expect(input.excitation.wireTag).toBe(1);
    // Center segment for odd count
    expect(input.excitation.segment).toBe(Math.ceil(state.segments / 2));
  });
});
