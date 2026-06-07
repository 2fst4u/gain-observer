import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import { getNecLines, expectExcitation } from './necInspect';
import { LEFT_LEG_TAG } from '../src/physics/constants';

function setupDeltaLoop(terminatingResistor?: number) {
  const store = useAntennaStore.getState();
  store.setAntennaType('delta-loop');
  store.setFeedline('none');
  store.setFrequency(7.1);
  store.setLength(42);
  store.setHeight(15);
  if (terminatingResistor !== undefined) {
    store.setTerminatingResistor(terminatingResistor);
  }
}

describe('Delta Loop termination (removed)', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('no LD card even if terminatingResistor > 0 (logic removed)', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'LD')).toHaveLength(0);
    expect(input.loads).toBeUndefined();
  });

  it('setAntennaType("delta-loop") resets terminatingResistor to 0', () => {
    useAntennaStore.getState().setAntennaType('sloping-v');
    useAntennaStore.getState().setTerminatingResistor(600);
    expect(useAntennaStore.getState().terminatingResistor).toBe(600);

    useAntennaStore.getState().setAntennaType('delta-loop');
    expect(useAntennaStore.getState().terminatingResistor).toBe(0);
  });

  it('excitation remains on left leg (LEFT_LEG_TAG) last segment', () => {
    setupDeltaLoop(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    expectExcitation(buildNecCards(input), LEFT_LEG_TAG, leftLeg.segments);
  });

  it('no NT card emitted for delta-loop termination', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('dipole: terminatingResistor has no effect on LD cards', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('dipole');
    store.setTerminatingResistor(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(getNecLines(buildNecCards(input), 'LD')).toHaveLength(0);
    expect(input.loads).toBeUndefined();
  });
});
