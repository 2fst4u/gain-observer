import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import {
  getNecLines,
  parseNtLine,
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

describe('V-antenna termination topology (Option A: NT across tips)', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('v-beam: no NT card when unterminated (terminatingResistor=0)', () => {
    setupVBeam(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('sloping-v: no NT card when unterminated (terminatingResistor=0)', () => {
    setupSlopingV(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('v-beam: exactly one NT card when terminatingResistor > 0', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(1);
    expect(input.networks).toHaveLength(1);
  });

  it('sloping-v: exactly one NT card when terminatingResistor > 0', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(1);
    expect(input.networks).toHaveLength(1);
  });

  it('v-beam: NT card connects left far tip (tag 1, seg 1) to right far tip (tag 2, seg N)', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const nt = parseNtLine(getNecLines(deck, 'NT')[0]);
    const rightWire = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
    expect(nt.tag1).toBe(DIPOLE_LEFT_TAG);
    expect(nt.seg1).toBe(1);
    expect(nt.tag2).toBe(DIPOLE_RIGHT_TAG);
    expect(nt.seg2).toBe(rightWire.segments);
  });

  it('sloping-v: NT card connects left far tip to right far tip', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const nt = parseNtLine(getNecLines(deck, 'NT')[0]);
    const rightWire = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
    expect(nt.tag1).toBe(DIPOLE_LEFT_TAG);
    expect(nt.seg1).toBe(1);
    expect(nt.tag2).toBe(DIPOLE_RIGHT_TAG);
    expect(nt.seg2).toBe(rightWire.segments);
  });

  it('v-beam: NT Y-params are correct for R=800 (G=1/R, all imaginary parts zero)', () => {
    const R = 800;
    setupVBeam(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const nt = parseNtLine(getNecLines(deck, 'NT')[0]);
    expect(nt.y11Real).toBeCloseTo(1 / R, 9);
    expect(nt.y11Imag).toBeCloseTo(0, 9);
    expect(nt.y12Real).toBeCloseTo(-1 / R, 9);
    expect(nt.y12Imag).toBeCloseTo(0, 9);
    expect(nt.y22Real).toBeCloseTo(1 / R, 9);
    expect(nt.y22Imag).toBeCloseTo(0, 9);
  });

  it('sloping-v: NT Y-params are correct for R=500', () => {
    const R = 500;
    setupSlopingV(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const nt = parseNtLine(getNecLines(deck, 'NT')[0]);
    expect(nt.y11Real).toBeCloseTo(1 / R, 9);
    expect(nt.y12Real).toBeCloseTo(-1 / R, 9);
    expect(nt.y22Real).toBeCloseTo(1 / R, 9);
  });

  it('v-beam: halving terminatingResistor doubles the conductance G', () => {
    setupVBeam(1000);
    const input1 = selectSimulationInput(useAntennaStore.getState());
    const nt1 = parseNtLine(getNecLines(buildNecCards(input1), 'NT')[0]);

    useAntennaStore.getState().setTerminatingResistor(500);
    const input2 = selectSimulationInput(useAntennaStore.getState());
    const nt2 = parseNtLine(getNecLines(buildNecCards(input2), 'NT')[0]);

    expect(nt2.y11Real).toBeCloseTo(nt1.y11Real * 2, 9);
  });

  it('v-beam terminated: no wires touch ground', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    expectNoGroundTouchingWires(buildNecCards(input));
  });

  it('sloping-v terminated: no wires touch ground', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    expectNoGroundTouchingWires(buildNecCards(input));
  });

  it('v-beam terminated: excitation remains on apex bridge (tag 3, seg 1)', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    expectExcitation(buildNecCards(input), FEED_BRIDGE_TAG, 1);
  });

  it('sloping-v terminated: excitation remains on apex bridge (tag 3, seg 1)', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    expectExcitation(buildNecCards(input), FEED_BRIDGE_TAG, 1);
  });

  it('dipole: terminatingResistor has no effect (no NT card emitted)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('dipole');
    store.setTerminatingResistor(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(getNecLines(buildNecCards(input), 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('inverted-v: terminatingResistor has no effect (no NT card emitted)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('inverted-v');
    store.setTerminatingResistor(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(getNecLines(buildNecCards(input), 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('delta-loop: terminatingResistor has no effect (no NT card emitted)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setTerminatingResistor(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(getNecLines(buildNecCards(input), 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('setTerminatingResistor clamps negative values to 0 (unterminated)', () => {
    setupVBeam();
    useAntennaStore.getState().setTerminatingResistor(-100);
    expect(useAntennaStore.getState().terminatingResistor).toBe(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.networks).toBeUndefined();
  });

  it('terminatingResistor is documented as total across-tip resistance (not per-leg)', () => {
    // R=400 total → G = 1/400. A per-leg model would give G = 1/200.
    const R = 400;
    setupVBeam(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.networks).toHaveLength(1);
    expect(input.networks![0].y11Real).toBeCloseTo(1 / R, 9);
    expect(input.networks![0].y12Real).toBeCloseTo(-1 / R, 9);
  });
});
