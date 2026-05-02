import { describe, expect, it } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { toDisplayLength, fromDisplayLength } from '../src/physics/units';

describe('antennaStore mapping and conversions', () => {
  it('selectSimulationInput maps ground correctly through public selector', () => {
    const state = useAntennaStore.getState();

    expect(selectSimulationInput({ ...state, groundId: 'sea', height: 10 }).ground.type).toBe('real');
    expect(selectSimulationInput({ ...state, groundId: 'perfect', height: 10 }).ground.type).toBe('perfect');
    expect(selectSimulationInput({ ...state, groundId: 'free', height: 10 }).ground.type).toBe('free');
    expect(selectSimulationInput({ ...state, height: 0 }).ground.type).toBe('free');
  });

  it('metric/imperial conversions do not change the underlying physics input', () => {
    const originalMeters = 10;
    const imperialFeet = toDisplayLength(originalMeters, 'imperial');
    const backToMeters = fromDisplayLength(imperialFeet, 'imperial');

    // The store always holds meters. The conversion helpers must be accurate.
    expect(backToMeters).toBeCloseTo(originalMeters, 10);

    const state = useAntennaStore.getState();
    const inputMetric = selectSimulationInput({ ...state, length: originalMeters });
    const inputImperial = selectSimulationInput({ ...state, length: backToMeters });

    expect(inputMetric.wires[0].end[0]).toBeCloseTo(inputImperial.wires[0].end[0], 10);
  });

  it('setting frequency can be used to trigger resonant length update', () => {
    const store = useAntennaStore.getState();
    store.setFrequency(14.15); // 20m band
    store.setHalfWaveLength();

    const length20m = useAntennaStore.getState().length;
    expect(length20m).toBeCloseTo(10.06, 1); // approx 10m for 14MHz

    store.setFrequency(28.5); // 10m band
    store.setHalfWaveLength();
    const length10m = useAntennaStore.getState().length;
    expect(length10m).toBeCloseTo(length20m / 2, 1);
  });
});
