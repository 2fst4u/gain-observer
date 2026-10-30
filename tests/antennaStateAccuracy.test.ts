import { afterEach, describe, expect, it } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { VERTICAL_WHIP_RADIAL_TAG } from '../src/physics/tags';
import { makeSimulationResult } from './helpers/factories';

const original = useAntennaStore.getState();
afterEach(() => useAntennaStore.setState(original, true));

describe('physical configuration actions', () => {
  it('removes previous numerical results when a model configuration fails', () => {
    useAntennaStore.setState({ result: makeSimulationResult(),
      feedpointImpedance: { R: 50, X: 0 },
      sweep: [{ frequencyMHz: 7.1, R: 50, X: 0, swr: 1 }] });
    original._setError('Model has not passed numerical convergence checks.');
    expect(useAntennaStore.getState()).toMatchObject({ result: null,
      feedpointImpedance: null, sweep: [], loading: false });
  });
  it('tunes the transmitter without resizing the installed counterpoise', () => {
    original.setFrequency(7.1);
    original.setAntennaType('vertical-whip');
    const before = selectSimulationInput(useAntennaStore.getState()).wires
      .filter(w => w.tag === VERTICAL_WHIP_RADIAL_TAG);
    original.setFrequency(14.2);
    const state = useAntennaStore.getState();
    const after = selectSimulationInput(state).wires.filter(w => w.tag === VERTICAL_WHIP_RADIAL_TAG);
    expect(state.designFrequency).toBe(7.1);
    expect(after.map(w => [w.start, w.end])).toEqual(before.map(w => [w.start, w.end]));
    expect(Math.hypot(...after[0].end.map((v, i) => v - after[0].start[i])))
      .toBeCloseTo(0.2375 * 299.792458 / 7.1, 10);
  });

  it('redesigns counterpoises only when the antenna design is explicitly reset', () => {
    original.setFrequency(7.1);
    original.setAntennaType('vertical-whip');
    original.setFrequency(14.2);
    original.setHalfWaveLength();
    expect(useAntennaStore.getState().designFrequency).toBe(14.2);
  });

  it.each(['vertical-whip', 'inverted-l'] as const)('removes a hidden ATU when selecting %s', antennaType => {
    useAntennaStore.setState({ atuEnabled: true, feedlineId: 'rg58' });
    original.setAntennaType(antennaType);
    expect(useAntennaStore.getState().atuEnabled).toBe(false);
    expect(useAntennaStore.getState().feedlineId).toBe('none');
  });

  it('captures every matching and physical design parameter independently of subsequent edits', () => {
    useAntennaStore.setState({
      frequency: 14.2, designFrequency: 7.1, transformerEnabled: true,
      transformerRatio: 6, atuEnabled: true, atuMainFeedlineLength: 75,
      terminatingResistor: 300, result: makeSimulationResult(),
      sweep: [{ frequencyMHz: 14.2, R: 300, X: 0, swr: 6 }],
    });
    original.captureComparisonReference();
    original.setTransformerRatio(9);
    original.setAtuEnabled(false);
    expect(useAntennaStore.getState().comparisonReference).toMatchObject({
      frequency: 14.2, designFrequency: 7.1, transformerEnabled: true,
      transformerRatio: 6, atuEnabled: true, atuMainFeedlineLength: 75,
      terminatingResistor: 300,
    });
  });
});
