import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import {
  getNecLines,
  parseLdLine,
  expectNoGroundTouchingWires,
  expectExcitation,
} from './necInspect';
import { slopingVTerminationHubZ, SLOPING_V_COUNTERPOISE_RADIALS, SLOPING_V_COUNTERPOISE_LENGTH_WL, wavelengthMeters } from '../src/physics/constants';
import { buildWires } from '../src/store/antennaStore';
import { LEFT_LEG_TAG, RIGHT_LEG_TAG, FEED_BRIDGE_TAG, SLOPING_V_LEFT_STUB_TAG, SLOPING_V_RIGHT_STUB_TAG, SLOPING_V_LEFT_COUNTERPOISE_TAG, SLOPING_V_RIGHT_COUNTERPOISE_TAG } from '../src/physics/tags';

function setupSlopingV(terminatingResistor?: number) {
  const store = useAntennaStore.getState();
  store.setAntennaType('sloping-v');
  store.setFeedline('none');
  store.setFrequency(7.1);
  store.setLength(84);
  store.setHeight(15);
  store.setVAngle(90);
  if (terminatingResistor !== undefined) {
    store.setTerminatingResistor(terminatingResistor);
  }
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

    // With graded segmentation each leg is multiple sub-wires sharing a tag:
    //   LEFT  leg is emitted tip → apex (first sub-wire's `.start` is the tip)
    //   RIGHT leg is emitted apex → tip (last sub-wire's `.end` is the tip)
    const leftLegWires  = input.wires.filter((w) => w.tag === LEFT_LEG_TAG);
    const rightLegWires = input.wires.filter((w) => w.tag === RIGHT_LEG_TAG);
    const leftLegTip  = leftLegWires[0]!.start;
    const rightLegTip = rightLegWires[rightLegWires.length - 1]!.end;
    const leftStub  = input.wires.find((w) => w.tag === SLOPING_V_LEFT_STUB_TAG)!;
    const rightStub = input.wires.find((w) => w.tag === SLOPING_V_RIGHT_STUB_TAG)!;

    // Stub starts exactly at the tip of each leg
    expect(leftStub.start[0]).toBeCloseTo(leftLegTip[0], 6);
    expect(leftStub.start[1]).toBeCloseTo(leftLegTip[1], 6);
    expect(leftStub.start[2]).toBeCloseTo(leftLegTip[2], 6);

    expect(rightStub.start[0]).toBeCloseTo(rightLegTip[0], 6);
    expect(rightStub.start[1]).toBeCloseTo(rightLegTip[1], 6);
    expect(rightStub.start[2]).toBeCloseTo(rightLegTip[2], 6);

    // Stub ends at the counterpoise hub just above ground. The height is
    // frequency-scaled (0.001 λ) rather than a flat 1 cm, because that is the
    // lowest the Sommerfeld-Norton ground is documented to model faithfully.
    const hubZ = slopingVTerminationHubZ(7.1, leftLegTip[2]);
    expect(hubZ).toBeGreaterThan(0);
    expect(hubZ).toBeLessThan(leftLegTip[2]);
    expect(leftStub.end[2]).toBeCloseTo(hubZ, 6);
    expect(rightStub.end[2]).toBeCloseTo(hubZ, 6);

    // Stubs are vertical (XY coords unchanged)
    expect(leftStub.end[0]).toBeCloseTo(leftStub.start[0], 6);
    expect(leftStub.end[1]).toBeCloseTo(leftStub.start[1], 6);
    expect(rightStub.end[0]).toBeCloseTo(rightStub.start[0], 6);
    expect(rightStub.end[1]).toBeCloseTo(rightStub.start[1], 6);
  });

  // ─── Termination counterpoise (NEC-2 earth-connection stand-in) ───────────
  //
  // NEC-2 cannot bond a wire to a Sommerfeld-Norton ground, so a stub that
  // just ends near the earth is an open circuit and the terminating resistor
  // conducts almost nothing. A small radial screen at the hub gives the
  // termination current the return path the real earth stake provides. See
  // `slopingVTermination.integration.test.ts` for the physics side of this;
  // these tests only pin the geometry.

  it('sloping-v: a radial screen is fitted under each tip when terminated', () => {
    setupSlopingV(500);
    const input = selectSimulationInput(useAntennaStore.getState());
    const left = input.wires.filter((w) => w.tag === SLOPING_V_LEFT_COUNTERPOISE_TAG);
    const right = input.wires.filter((w) => w.tag === SLOPING_V_RIGHT_COUNTERPOISE_TAG);
    expect(left).toHaveLength(SLOPING_V_COUNTERPOISE_RADIALS);
    expect(right).toHaveLength(SLOPING_V_COUNTERPOISE_RADIALS);

    // Every radial is horizontal, and starts at the hub its stub ends on.
    const leftStub = input.wires.find((w) => w.tag === SLOPING_V_LEFT_STUB_TAG)!;
    for (const radial of left) {
      expect(radial.start[0]).toBeCloseTo(leftStub.end[0], 6);
      expect(radial.start[1]).toBeCloseTo(leftStub.end[1], 6);
      expect(radial.start[2]).toBeCloseTo(leftStub.end[2], 6);
      expect(radial.end[2]).toBeCloseTo(leftStub.end[2], 6);
    }
  });

  it('sloping-v: no counterpoise when unterminated', () => {
    setupSlopingV(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.wires.find((w) => w.tag === SLOPING_V_LEFT_COUNTERPOISE_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === SLOPING_V_RIGHT_COUNTERPOISE_TAG)).toBeUndefined();
  });

  it('sloping-v: the counterpoise is never drawn in the 3D scene', () => {
    // It models the dirt the resistor is bonded to, not hardware anyone
    // erects, so the scene must show the stub and resistor and nothing else.
    // The scene builds its wires from buildWires(); the termination network
    // is added later, in selectSimulationInput().
    setupSlopingV(500);
    const state = useAntennaStore.getState();
    const scene = buildWires(state);
    for (const tag of [SLOPING_V_LEFT_COUNTERPOISE_TAG, SLOPING_V_RIGHT_COUNTERPOISE_TAG]) {
      expect(scene.find((w) => w.tag === tag)).toBeUndefined();
    }
    // ...and it really is in the simulation deck, so this is a rendering
    // choice rather than the wires having quietly gone missing.
    const input = selectSimulationInput(state);
    expect(input.wires.filter((w) => w.tag === SLOPING_V_LEFT_COUNTERPOISE_TAG).length)
      .toBe(SLOPING_V_COUNTERPOISE_RADIALS);
  });

  it('sloping-v: the two radial screens never grow into one another', () => {
    // Overlapping wires are a NEC geometry error. Radial length is capped at
    // 40 % of the tip separation so opposing radials close at most 80 % of
    // the gap. A narrow V low in the band is the case that would breach it.
    for (const [frequency, length, vAngle] of [[1.8, 40, 20], [1.8, 120, 30], [7.1, 84, 90], [28, 84, 120]] as const) {
      const store = useAntennaStore.getState();
      store.setAntennaType('sloping-v');
      store.setFeedline('none');
      store.setFrequency(frequency);
      store.setLength(length);
      store.setHeight(15);
      store.setVAngle(vAngle);
      store.setTerminatingResistor(500);
      const input = selectSimulationInput(useAntennaStore.getState());

      const leftStub = input.wires.find((w) => w.tag === SLOPING_V_LEFT_STUB_TAG)!;
      const rightStub = input.wires.find((w) => w.tag === SLOPING_V_RIGHT_STUB_TAG)!;
      const separation = Math.hypot(
        leftStub.end[0] - rightStub.end[0],
        leftStub.end[1] - rightStub.end[1],
      );
      const radials = input.wires.filter(
        (w) => w.tag === SLOPING_V_LEFT_COUNTERPOISE_TAG || w.tag === SLOPING_V_RIGHT_COUNTERPOISE_TAG,
      );
      expect(radials.length).toBeGreaterThan(0);
      for (const radial of radials) {
        const reach = Math.hypot(radial.end[0] - radial.start[0], radial.end[1] - radial.start[1]);
        expect(reach).toBeLessThanOrEqual(separation * 0.4 + 1e-9);
        // Never longer than the design-frequency screen either.
        expect(reach).toBeLessThanOrEqual(wavelengthMeters(frequency) * SLOPING_V_COUNTERPOISE_LENGTH_WL + 1e-9);
      }
    }
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
      (l) => l.wireTag === LEFT_LEG_TAG || l.wireTag === RIGHT_LEG_TAG,
    );
    expect(legLoads).toHaveLength(0);
  });

  it('sloping-v terminated: stub and counterpoise wires remain above z=0', () => {
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
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });

  it('inverted-v: terminatingResistor has no effect (no termination LD cards)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('inverted-v');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });

  it('delta-loop: terminatingResistor has no effect on V-topology termination', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setTerminatingResistor(800);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });

  it('setTerminatingResistor clamps negative values to 0 (unterminated)', () => {
    setupSlopingV();
    useAntennaStore.getState().setTerminatingResistor(-100);
    expect(useAntennaStore.getState().terminatingResistor).toBe(0);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getSlopingVTermLdLines(deck)).toHaveLength(0);
  });
});
