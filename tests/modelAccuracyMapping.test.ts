import { describe, expect, it } from 'vitest';
import { useAntennaStore } from '../src/store/antennaStore';
import { selectSimulationInput, selectAtuConfig, isFeedlineActive, buildPhysicalWires, MIN_REAL_GROUND_HEIGHT_M } from '../src/store/antennaSimulation';
import { feedlineLossDb, findFeedlinePreset } from '../src/physics/constants';
import {
  INVERTED_L_RADIAL_TAG, VERTICAL_WHIP_RADIAL_TAG,
  SLOPING_V_LEFT_COUNTERPOISE_TAG, SLOPING_V_RIGHT_COUNTERPOISE_TAG,
} from '../src/physics/tags';

describe('physical model mapping', () => {
  it('derives display feedline activity from the actual generated model, including short and clipped runs', () => {
    const state = useAntennaStore.getState();
    for (const antennaType of ['dipole', 'inverted-v', 'sloping-v', 'delta-loop', 'terminated-delta', 'folded-dipole', 'vertical-whip', 'inverted-l'] as const) {
      for (const feedlineLength of [0, 0.01, 0.04, 0.1, 10]) {
        for (const height of [0, 0.31, 8]) {
          const candidate = { ...state, antennaType, feedlineId: 'rg58', feedlineLength, height, terminatingResistor: 0 };
          const input = selectSimulationInput(candidate);
          expect(isFeedlineActive(candidate), `${antennaType}, length=${feedlineLength}, height=${height}`)
            .toBe((input.transmissionLines?.length ?? 0) > 0);
        }
      }
    }
    expect(isFeedlineActive({ ...state, feedlineId: 'rg58', feedlineLength: 0 })).toBe(false);
    expect(isFeedlineActive({ ...state, feedlineId: 'none', feedlineLength: 10 })).toBe(false);
  });

  it('uses a separate 50-ohm RG-213 main cable when the up-mast run is ladder line', () => {
    const config = selectAtuConfig({
      atuEnabled: true, frequency: 14.2, feedlineId: 'ladder450',
      feedlineLength: 6, atuMainFeedlineLength: 50,
    })!;
    expect(config.mainFeedlineId).toBe('rg213');
    expect(config.mainMatchedLossDb).toBeCloseTo(feedlineLossDb(findFeedlinePreset('rg213'), 14.2, 50), 12);
  });

  it('does not apply a hidden mast-base tuner when there is no feedline', () => {
    expect(selectAtuConfig({ atuEnabled: true, frequency: 7.1, feedlineId: 'none', feedlineLength: 0, atuMainFeedlineLength: 50 })).toBeUndefined();
  });

  it.each(['sloping-v', 'terminated-delta', 'folded-dipole'] as const)('shares the complete %s terminating geometry with rendering', (antennaType) => {
    const state = {
      ...useAntennaStore.getState(), antennaType, height: 15,
      length: antennaType === 'sloping-v' ? 84 : 42,
      frequency: 7.1, designFrequency: 7.1, groundId: 'pastoral',
      feedlineId: 'rg58', feedlineLength: 10, terminatingResistor: 500,
    };
    expect(buildPhysicalWires(state)).toEqual(selectSimulationInput(state).wires);
  });

  it.each(['vertical-whip', 'inverted-l', 'sloping-v'] as const)('holds %s radial dimensions and height fixed when changing frequency', (antennaType) => {
    const state = {
      ...useAntennaStore.getState(), antennaType, designFrequency: 7.1,
      frequency: 7.1, length: antennaType === 'sloping-v' ? 84 : 20,
      height: antennaType === 'sloping-v' ? 15 : 0,
      groundId: 'pastoral', whipCounterpoise: true,
      feedlineId: 'none', terminatingResistor: antennaType === 'sloping-v' ? 500 : 0,
    };
    const radialTags = new Set([INVERTED_L_RADIAL_TAG, VERTICAL_WHIP_RADIAL_TAG, SLOPING_V_LEFT_COUNTERPOISE_TAG, SLOPING_V_RIGHT_COUNTERPOISE_TAG]);
    const radialGeometry = (frequency: number) => selectSimulationInput({ ...state, frequency }).wires
      .filter((wire) => wire.tag !== undefined && radialTags.has(wire.tag))
      .map((wire) => ({ start: wire.start, end: wire.end }));
    const original = radialGeometry(7.1);
    expect(original.length).toBeGreaterThan(0);
    expect(radialGeometry(1)).toEqual(original);
    expect(radialGeometry(30)).toEqual(original);
    for (const wire of original) {
      expect(wire.start[2]).toBeGreaterThanOrEqual(MIN_REAL_GROUND_HEIGHT_M);
      expect(wire.end[2]).toBeGreaterThanOrEqual(MIN_REAL_GROUND_HEIGHT_M);
    }
  });

  it('explicitly models copper conductors and frequency-dependent distributed cable loss', () => {
    const input = selectSimulationInput({ ...useAntennaStore.getState(), antennaType: 'dipole', feedlineId: 'rg58', feedlineLength: 20, height: 8 });
    expect(input.conductivitySm).toBe(58e6);
    expect(input.transmissionLines![0]!.lossModel).toEqual({ physicalLengthM: 20, lossK1: 1.3828, lossK2: 0.0227 });
    expect(input.loads?.filter((load) => load.role === 'choke')).toHaveLength(1);
  });
});
