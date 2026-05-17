import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import {
  getNecLines,
  parseLdLine,
  parseGwLine,
  expectNoGroundTouchingWires,
  expectExcitation,
} from './necInspect';
import {
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  FEED_BRIDGE_TAG,
  SLOPING_V_LEFT_STUB_TAG,
  SLOPING_V_RIGHT_STUB_TAG,
  SLOPING_V_STUB_BOTTOM_Z_M,
} from '../src/physics/constants';

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
  if (terminatingResistor !== undefined) {
    store.setTerminatingResistor(terminatingResistor);
  }
}

/**
 * V-beam termination: LD type-4 on DIPOLE_LEFT_TAG or DIPOLE_RIGHT_TAG
 * (series load at each far leg end, high above ground).
 */
function getVBeamTermLdLines(deck: string): string[] {
  return getNecLines(deck, 'LD').filter((line) => {
    const ld = parseLdLine(line);
    return ld.type === 4 && (ld.tag === DIPOLE_LEFT_TAG || ld.tag === DIPOLE_RIGHT_TAG);
  });
}

/**
 * Sloping-V termination: LD type-4 on SLOPING_V_LEFT_STUB_TAG or
 * SLOPING_V_RIGHT_STUB_TAG (resistance in the near-ground stub wire that
 * models the physical tip-to-earth resistor).
 */
function getSlopingVTermLdLines(deck: string): string[] {
  return getNecLines(deck, 'LD').filter((line) => {
    const ld = parseLdLine(line);
    return ld.type === 4 && (ld.tag === SLOPING_V_LEFT_STUB_TAG || ld.tag === SLOPING_V_RIGHT_STUB_TAG);
  });
}

describe('V-antenna termination topology', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  // ─── V-beam (series LD at far leg ends) ────────────────────────────────────

  it('v-beam: no termination LD cards when unterminated (terminatingResistor=0)', () => {
    setupVBeam(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getVBeamTermLdLines(deck)).toHaveLength(0);
    const termLoads = (input.loads ?? []).filter(
      (l) => l.wireTag === DIPOLE_LEFT_TAG || l.wireTag === DIPOLE_RIGHT_TAG,
    );
    expect(termLoads).toHaveLength(0);
  });

  it('v-beam: exactly two LD cards when terminatingResistor > 0', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getVBeamTermLdLines(deck)).toHaveLength(2);
    const termLoads = (input.loads ?? []).filter(
      (l) => l.wireTag === DIPOLE_LEFT_TAG || l.wireTag === DIPOLE_RIGHT_TAG,
    );
    expect(termLoads).toHaveLength(2);
  });

  it('v-beam: LD cards placed at left far tip (tag 1, seg 1) and right far tip (tag 2, seg N)', () => {
    setupVBeam(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getVBeamTermLdLines(deck);
    const rightWire = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;

    const leftLd = ldLines.map(parseLdLine).find((l) => l.tag === DIPOLE_LEFT_TAG)!;
    expect(leftLd.segmentStart).toBe(1);
    expect(leftLd.segmentEnd).toBe(1);

    const rightLd = ldLines.map(parseLdLine).find((l) => l.tag === DIPOLE_RIGHT_TAG)!;
    expect(rightLd.segmentStart).toBe(rightWire.segments);
    expect(rightLd.segmentEnd).toBe(rightWire.segments);
  });

  it('v-beam: LD resistance equals terminatingResistor (per-leg value)', () => {
    const R = 800;
    setupVBeam(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getVBeamTermLdLines(deck);
    for (const line of ldLines) {
      const ld = parseLdLine(line);
      expect(ld.p1).toBeCloseTo(R, 6);
      expect(ld.p2).toBeCloseTo(0, 6);
    }
  });

  it('v-beam: halving terminatingResistor halves the LD resistance', () => {
    setupVBeam(1000);
    const deck1 = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    const r1 = parseLdLine(getVBeamTermLdLines(deck1)[0]).p1;

    useAntennaStore.getState().setTerminatingResistor(500);
    const deck2 = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    const r2 = parseLdLine(getVBeamTermLdLines(deck2)[0]).p1;

    expect(r2).toBeCloseTo(r1 / 2, 6);
  });

  it('v-beam terminated: no wires touch ground', () => {
    setupVBeam(800);
    expectNoGroundTouchingWires(buildNecCards(selectSimulationInput(useAntennaStore.getState())));
  });

  it('v-beam terminated: excitation remains on apex bridge (tag 3, seg 1)', () => {
    setupVBeam(800);
    expectExcitation(buildNecCards(selectSimulationInput(useAntennaStore.getState())), FEED_BRIDGE_TAG, 1);
  });

  it('terminatingResistor is the per-leg resistance for v-beam', () => {
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

  // ─── Sloping-V (stub wires to near-ground, LD on stubs) ───────────────────

  it('sloping-v: no stub wires and no termination LD when unterminated', () => {
    setupSlopingV(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
    // No stub wires in geometry
    expect(input.wires.find((w) => w.tag === SLOPING_V_LEFT_STUB_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === SLOPING_V_RIGHT_STUB_TAG)).toBeUndefined();
  });

  it('sloping-v: two stub wires and two LD cards added when terminatingResistor > 0', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getSlopingVTermLdLines(deck)).toHaveLength(2);
    expect(input.wires.find((w) => w.tag === SLOPING_V_LEFT_STUB_TAG)).toBeDefined();
    expect(input.wires.find((w) => w.tag === SLOPING_V_RIGHT_STUB_TAG)).toBeDefined();
  });

  it('sloping-v: stub wires are vertical, starting at each leg tip, ending near ground', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());

    const leftLeg  = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    const rightLeg = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
    const leftStub  = input.wires.find((w) => w.tag === SLOPING_V_LEFT_STUB_TAG)!;
    const rightStub = input.wires.find((w) => w.tag === SLOPING_V_RIGHT_STUB_TAG)!;

    // Stub starts exactly at the tip of each leg
    expect(leftStub.start[0]).toBeCloseTo(leftLeg.start[0], 6);
    expect(leftStub.start[1]).toBeCloseTo(leftLeg.start[1], 6);
    expect(leftStub.start[2]).toBeCloseTo(leftLeg.start[2], 6);

    expect(rightStub.start[0]).toBeCloseTo(rightLeg.end[0], 6);
    expect(rightStub.start[1]).toBeCloseTo(rightLeg.end[1], 6);
    expect(rightStub.start[2]).toBeCloseTo(rightLeg.end[2], 6);

    // Stub ends near the ground at the constant floor height
    expect(leftStub.end[2]).toBeCloseTo(SLOPING_V_STUB_BOTTOM_Z_M, 6);
    expect(rightStub.end[2]).toBeCloseTo(SLOPING_V_STUB_BOTTOM_Z_M, 6);

    // Stubs are vertical (XY coords unchanged)
    expect(leftStub.end[0]).toBeCloseTo(leftStub.start[0], 6);
    expect(leftStub.end[1]).toBeCloseTo(leftStub.start[1], 6);
    expect(rightStub.end[0]).toBeCloseTo(rightStub.start[0], 6);
    expect(rightStub.end[1]).toBeCloseTo(rightStub.start[1], 6);
  });

  it('sloping-v: LD resistance on stub equals terminatingResistor', () => {
    const R = 500;
    setupSlopingV(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getSlopingVTermLdLines(deck);
    expect(ldLines).toHaveLength(2);
    for (const line of ldLines) {
      const ld = parseLdLine(line);
      expect(ld.p1).toBeCloseTo(R, 6);
      expect(ld.p2).toBeCloseTo(0, 6);
    }
  });

  it('sloping-v: LD is on the stub segment (segment 1 of each stub tag)', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getSlopingVTermLdLines(deck);

    const leftLd  = ldLines.map(parseLdLine).find((l) => l.tag === SLOPING_V_LEFT_STUB_TAG)!;
    const rightLd = ldLines.map(parseLdLine).find((l) => l.tag === SLOPING_V_RIGHT_STUB_TAG)!;

    expect(leftLd.segmentStart).toBe(1);
    expect(leftLd.segmentEnd).toBe(1);
    expect(rightLd.segmentStart).toBe(1);
    expect(rightLd.segmentEnd).toBe(1);
  });

  it('sloping-v: no LD on the leg wires themselves (termination is in stubs only)', () => {
    setupSlopingV(800);
    const input = selectSimulationInput(useAntennaStore.getState());
    const legLoads = (input.loads ?? []).filter(
      (l) => l.wireTag === DIPOLE_LEFT_TAG || l.wireTag === DIPOLE_RIGHT_TAG,
    );
    expect(legLoads).toHaveLength(0);
  });

  it('sloping-v terminated: stub wires remain above z=0', () => {
    setupSlopingV(800);
    expectNoGroundTouchingWires(buildNecCards(selectSimulationInput(useAntennaStore.getState())));
  });

  it('sloping-v terminated: excitation remains on apex bridge (tag 3, seg 1)', () => {
    setupSlopingV(800);
    expectExcitation(buildNecCards(selectSimulationInput(useAntennaStore.getState())), FEED_BRIDGE_TAG, 1);
  });

  // ─── Non-V topologies: termination has no effect ───────────────────────────

  it('dipole: terminatingResistor has no effect (no termination LD cards)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('dipole');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getVBeamTermLdLines(deck)).toHaveLength(0);
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });

  it('inverted-v: terminatingResistor has no effect (no termination LD cards)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('inverted-v');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getVBeamTermLdLines(deck)).toHaveLength(0);
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });

  it('delta-loop: terminatingResistor has no effect on V-topology termination', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getVBeamTermLdLines(deck)).toHaveLength(0);
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });

  it('setTerminatingResistor clamps negative values to 0 (unterminated)', () => {
    setupVBeam();
    useAntennaStore.getState().setTerminatingResistor(-100);
    expect(useAntennaStore.getState().terminatingResistor).toBe(0);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getVBeamTermLdLines(deck)).toHaveLength(0);
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });
});
