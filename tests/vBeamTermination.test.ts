import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import {
  getNecLines,
  parseLdLine,
  expectNoGroundTouchingWires,
  expectExcitation,
} from './necInspect';
import { DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG, FEED_BRIDGE_TAG } from '../src/physics/constants';

function setupVBeam(terminatingResistor?: number) {
  const store = useAntennaStore.getState();
  store.setAntennaType('v-beam');
  store.setFrequency(7.1);
  store.setLength(84);
  store.setHeight(15);
  store.setVAngle(90);
  if (terminatingResistor !== undefined) {
    store.setTerminatingResistor(terminatingResistor);
  }
}

function setupSlopingV(terminatingResistor?: number) {
  const store = useAntennaStore.getState();
  store.setAntennaType('sloping-v');
  store.setFrequency(7.1);
  store.setLength(84);
  store.setHeight(15);
  store.setVAngle(90);
  store.setLegSlope(15);
  if (terminatingResistor !== undefined) {
    store.setTerminatingResistor(terminatingResistor);
  }
}

/** Returns only the LD type-4 cards associated with V-topology tip termination. */
function getTerminationLdLines(deck: string): string[] {
  return getNecLines(deck, 'LD').filter((line) => {
    const ld = parseLdLine(line);
    return ld.type === 4 && (ld.tag === DIPOLE_LEFT_TAG || ld.tag === DIPOLE_RIGHT_TAG);
  });
}

describe('V-antenna termination topology (per-tip LD loads)', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('v-beam: no termination LD cards when unterminated (terminatingResistor=0)', () => {
    setupVBeam(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTerminationLdLines(deck)).toHaveLength(0);
    const termLoads = (input.loads ?? []).filter(
      (l) => l.wireTag === DIPOLE_LEFT_TAG || l.wireTag === DIPOLE_RIGHT_TAG,
    );
    expect(termLoads).toHaveLength(0);
  });

  it('sloping-v: no termination LD cards when unterminated (terminatingResistor=0)', () => {
    setupSlopingV(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTerminationLdLines(deck)).toHaveLength(0);
  });

  it('v-beam: exactly two LD cards when terminatingResistor > 0', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTerminationLdLines(deck)).toHaveLength(2);
    const termLoads = (input.loads ?? []).filter(
      (l) => l.wireTag === DIPOLE_LEFT_TAG || l.wireTag === DIPOLE_RIGHT_TAG,
    );
    expect(termLoads).toHaveLength(2);
  });

  it('sloping-v: exactly two LD cards when terminatingResistor > 0', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTerminationLdLines(deck)).toHaveLength(2);
  });

  it('v-beam: LD cards placed at left far tip (tag 1, seg 1) and right far tip (tag 2, seg N)', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getTerminationLdLines(deck);
    const rightWire = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;

    const leftLd = ldLines.map(parseLdLine).find((l) => l.tag === DIPOLE_LEFT_TAG)!;
    expect(leftLd.segmentStart).toBe(1);
    expect(leftLd.segmentEnd).toBe(1);

    const rightLd = ldLines.map(parseLdLine).find((l) => l.tag === DIPOLE_RIGHT_TAG)!;
    expect(rightLd.segmentStart).toBe(rightWire.segments);
    expect(rightLd.segmentEnd).toBe(rightWire.segments);
  });

  it('sloping-v: LD cards at left and right far tips', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getTerminationLdLines(deck);
    const rightWire = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;

    const leftLd = ldLines.map(parseLdLine).find((l) => l.tag === DIPOLE_LEFT_TAG)!;
    expect(leftLd.segmentStart).toBe(1);

    const rightLd = ldLines.map(parseLdLine).find((l) => l.tag === DIPOLE_RIGHT_TAG)!;
    expect(rightLd.segmentStart).toBe(rightWire.segments);
  });

  it('v-beam: LD resistance equals terminatingResistor (per-leg value)', () => {
    const R = 800;
    setupVBeam(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getTerminationLdLines(deck);
    for (const line of ldLines) {
      const ld = parseLdLine(line);
      expect(ld.p1).toBeCloseTo(R, 6);
      expect(ld.p2).toBeCloseTo(0, 6);
    }
  });

  it('sloping-v: LD resistance equals terminatingResistor for R=500', () => {
    const R = 500;
    setupSlopingV(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getTerminationLdLines(deck);
    for (const line of ldLines) {
      const ld = parseLdLine(line);
      expect(ld.p1).toBeCloseTo(R, 6);
    }
  });

  it('v-beam: halving terminatingResistor halves the LD resistance', () => {
    setupVBeam(1000);
    const deck1 = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    const r1 = parseLdLine(getTerminationLdLines(deck1)[0]).p1;

    useAntennaStore.getState().setTerminatingResistor(500);
    const deck2 = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    const r2 = parseLdLine(getTerminationLdLines(deck2)[0]).p1;

    expect(r2).toBeCloseTo(r1 / 2, 6);
  });

  it('v-beam terminated: no wires touch ground', () => {
    setupVBeam(800);
    expectNoGroundTouchingWires(buildNecCards(selectSimulationInput(useAntennaStore.getState())));
  });

  it('sloping-v terminated: no wires touch ground', () => {
    setupSlopingV(800);
    expectNoGroundTouchingWires(buildNecCards(selectSimulationInput(useAntennaStore.getState())));
  });

  it('v-beam terminated: excitation remains on apex bridge (tag 3, seg 1)', () => {
    setupVBeam(800);
    expectExcitation(buildNecCards(selectSimulationInput(useAntennaStore.getState())), FEED_BRIDGE_TAG, 1);
  });

  it('sloping-v terminated: excitation remains on apex bridge (tag 3, seg 1)', () => {
    setupSlopingV(800);
    expectExcitation(buildNecCards(selectSimulationInput(useAntennaStore.getState())), FEED_BRIDGE_TAG, 1);
  });

  it('dipole: terminatingResistor has no effect (no termination LD cards)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('dipole');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTerminationLdLines(deck)).toHaveLength(0);
  });

  it('inverted-v: terminatingResistor has no effect (no termination LD cards)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('inverted-v');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTerminationLdLines(deck)).toHaveLength(0);
  });

  it('delta-loop: terminatingResistor has no effect on V-topology termination (no tip LD cards)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTerminationLdLines(deck)).toHaveLength(0);
  });

  it('setTerminatingResistor clamps negative values to 0 (unterminated)', () => {
    setupVBeam();
    useAntennaStore.getState().setTerminatingResistor(-100);
    expect(useAntennaStore.getState().terminatingResistor).toBe(0);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTerminationLdLines(deck)).toHaveLength(0);
  });

  it('terminatingResistor is the per-leg resistance (each tip individually loaded to earth)', () => {
    // R=400 per leg → each LD card has R=400.
    // The old tip-to-tip model would have needed R=800 to get the same
    // per-leg equivalent, so this confirms the per-leg interpretation.
    const R = 400;
    setupVBeam(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const termLoads = (input.loads ?? []).filter(
      (l) => l.wireTag === DIPOLE_LEFT_TAG || l.wireTag === DIPOLE_RIGHT_TAG,
    );
    expect(termLoads).toHaveLength(2);
    for (const load of termLoads) {
      expect(load.param1).toBeCloseTo(R, 9);
    }
  });
});
