import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import { getNecLines, parseLdLine, expectExcitation } from './necInspect';
import { DELTA_BASE_TAG, DIPOLE_LEFT_TAG } from '../src/physics/constants';

function setupDeltaLoop(terminatingResistor?: number) {
  const store = useAntennaStore.getState();
  store.setAntennaType('delta-loop');
  store.setFrequency(7.1);
  store.setLength(42);
  store.setHeight(15);
  if (terminatingResistor !== undefined) {
    store.setTerminatingResistor(terminatingResistor);
  }
}

describe('Delta Loop termination (LD 4 at base centre)', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('no LD card when unterminated (terminatingResistor=0)', () => {
    setupDeltaLoop(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'LD')).toHaveLength(0);
    expect(input.loads).toBeUndefined();
  });

  it('exactly one LD card when terminatingResistor > 0', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'LD')).toHaveLength(1);
    expect(input.loads).toHaveLength(1);
  });

  it('LD card is type 4', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ld = parseLdLine(getNecLines(deck, 'LD')[0]);
    expect(ld.type).toBe(4);
  });

  it('LD card targets DELTA_BASE_TAG', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ld = parseLdLine(getNecLines(deck, 'LD')[0]);
    expect(ld.tag).toBe(DELTA_BASE_TAG);
  });

  it('LD card targets the centre segment of the base wire', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const baseWire = input.wires.find((w) => w.tag === DELTA_BASE_TAG)!;
    const expectedCenter = Math.ceil(baseWire.segments / 2);
    const deck = buildNecCards(input);
    const ld = parseLdLine(getNecLines(deck, 'LD')[0]);
    expect(ld.segmentStart).toBe(expectedCenter);
    expect(ld.segmentEnd).toBe(expectedCenter);
  });

  it('LD resistance equals terminatingResistor directly (not halved)', () => {
    const R = 600;
    setupDeltaLoop(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ld = parseLdLine(getNecLines(deck, 'LD')[0]);
    expect(ld.p1).toBeCloseTo(R, 9);
    expect(ld.p2).toBeCloseTo(0, 9);
  });

  it('LD resistance scales with terminatingResistor', () => {
    setupDeltaLoop(1200);
    const input1 = selectSimulationInput(useAntennaStore.getState());
    const ld1 = parseLdLine(getNecLines(buildNecCards(input1), 'LD')[0]);

    useAntennaStore.getState().setTerminatingResistor(600);
    const input2 = selectSimulationInput(useAntennaStore.getState());
    const ld2 = parseLdLine(getNecLines(buildNecCards(input2), 'LD')[0]);

    expect(ld2.p1).toBeCloseTo(ld1.p1 / 2, 9);
  });

  it('excitation remains on left leg (DIPOLE_LEFT_TAG) last segment', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    expectExcitation(buildNecCards(input), DIPOLE_LEFT_TAG, leftLeg.segments);
  });

  it('no NT card emitted for delta-loop termination', () => {
    setupDeltaLoop(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('v-beam: delta-loop termination does not add LD card', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('v-beam');
    store.setFrequency(7.1);
    store.setLength(84);
    store.setHeight(15);
    store.setVAngle(90);
    store.setTerminatingResistor(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(getNecLines(buildNecCards(input), 'LD')).toHaveLength(0);
    expect(input.loads).toBeUndefined();
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
