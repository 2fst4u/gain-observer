import { describe, it, expect, beforeEach } from 'vitest';
import {
  useAntennaStore,
  selectSimulationInput,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  TERMINATED_DELTA_LEFT_STUB_TAG,
  TERMINATED_DELTA_RIGHT_STUB_TAG,
} from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import {
  getNecLines,
  parseLdLine,
  parseGwLine,
  expectExcitation,
  expectNoGroundTouchingWires,
} from './necInspect';
import {
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  SLOPING_V_MIN_TIP_Z_M,
  SLOPING_V_STUB_BOTTOM_Z_M,
  TERMINATED_DELTA_CENTRE_GAP_M,
  wavelengthMeters,
} from '../src/physics/constants';

function setupTerminatedDelta(terminatingResistor?: number) {
  const store = useAntennaStore.getState();
  store.setAntennaType('terminated-delta');
  store.setFeedline('none');
  store.setFrequency(7.1);
  store.setLength(42);
  store.setHeight(15);
  store.setOrientation('NS');
  if (terminatingResistor !== undefined) {
    store.setTerminatingResistor(terminatingResistor);
  }
}

function getTermLdLines(deck: string): string[] {
  return getNecLines(deck, 'LD').filter((line) => {
    const ld = parseLdLine(line);
    return (
      ld.type === 4 &&
      (ld.tag === TERMINATED_DELTA_LEFT_STUB_TAG ||
        ld.tag === TERMINATED_DELTA_RIGHT_STUB_TAG)
    );
  });
}

describe('Terminated Delta — defaults & state', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('switching to terminated-delta defaults the perimeter to 1λ', () => {
    const store = useAntennaStore.getState();
    store.setFrequency(7.1);
    store.setAntennaType('terminated-delta');
    const lambda = wavelengthMeters(7.1);
    // Default uses calculateDefaultLength → lambda (1λ exactly).
    expect(useAntennaStore.getState().length).toBeCloseTo(lambda, 6);
  });

  it('switching to terminated-delta from unterminated defaults R to 300 Ω', () => {
    const store = useAntennaStore.getState();
    store.setTerminatingResistor(0);
    store.setAntennaType('terminated-delta');
    expect(useAntennaStore.getState().terminatingResistor).toBe(300);
  });

  it('switching to terminated-delta preserves an existing non-zero R', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('sloping-v'); // sets R=300
    store.setTerminatingResistor(450);
    store.setAntennaType('terminated-delta');
    expect(useAntennaStore.getState().terminatingResistor).toBe(450);
  });
});

describe('Terminated Delta — base geometry', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('emits two top legs and two half-base wires (no continuous base)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG);
    const rightLeg = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG);
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG);
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG);
    expect(leftLeg).toBeDefined();
    expect(rightLeg).toBeDefined();
    expect(leftHalfBase).toBeDefined();
    expect(rightHalfBase).toBeDefined();
  });

  it('left leg ends at the apex (.end is at the mast height)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    expect(leftLeg.end[2]).toBeCloseTo(15, 6);
  });

  it('right leg starts at the apex (.start is at the mast height)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const rightLeg = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
    expect(rightLeg.start[2]).toBeCloseTo(15, 6);
  });

  it('the two half-base wires sit at the same bottomZ', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)!;
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)!;
    expect(leftHalfBase.start[2]).toBeCloseTo(leftHalfBase.end[2], 6);
    expect(rightHalfBase.start[2]).toBeCloseTo(rightHalfBase.end[2], 6);
    expect(leftHalfBase.start[2]).toBeCloseTo(rightHalfBase.start[2], 6);
  });

  it('the two half-base inner ends are separated by TERMINATED_DELTA_CENTRE_GAP_M', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)!;
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)!;
    // Left half-base is leftCorner → centreLeft, so its .end is the inner end.
    // Right half-base is centreRight → rightCorner, so its .start is the inner end.
    const leftInner = leftHalfBase.end;
    const rightInner = rightHalfBase.start;
    const gap = Math.hypot(
      rightInner[0] - leftInner[0],
      rightInner[1] - leftInner[1],
      rightInner[2] - leftInner[2],
    );
    expect(gap).toBeCloseTo(TERMINATED_DELTA_CENTRE_GAP_M, 6);
  });

  it('the half-base inner ends straddle the geometric centre symmetrically', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)!;
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)!;
    const midX = (leftHalfBase.end[0] + rightHalfBase.start[0]) / 2;
    const midY = (leftHalfBase.end[1] + rightHalfBase.start[1]) / 2;
    expect(midX).toBeCloseTo(0, 6);
    expect(midY).toBeCloseTo(0, 6);
  });

  it('the outer ends of the half-base wires coincide with the leg corners', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    const rightLeg = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)!;
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)!;
    // Left leg goes leftCorner → apex, so .start is the left corner.
    // Left half-base goes leftCorner → centreLeft, so .start is also the left corner.
    expect(leftLeg.start[0]).toBeCloseTo(leftHalfBase.start[0], 6);
    expect(leftLeg.start[1]).toBeCloseTo(leftHalfBase.start[1], 6);
    expect(leftLeg.start[2]).toBeCloseTo(leftHalfBase.start[2], 6);
    // Right leg goes apex → rightCorner, so .end is the right corner.
    // Right half-base goes centreRight → rightCorner, so .end is also the right corner.
    expect(rightLeg.end[0]).toBeCloseTo(rightHalfBase.end[0], 6);
    expect(rightLeg.end[1]).toBeCloseTo(rightHalfBase.end[1], 6);
    expect(rightLeg.end[2]).toBeCloseTo(rightHalfBase.end[2], 6);
  });

  it('triangle is equilateral when the mast is tall enough', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setLength(42);
    store.setHeight(30); // tall enough for equilateral height ~12.12 m
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    const legLen = Math.hypot(
      leftLeg.end[0] - leftLeg.start[0],
      leftLeg.end[1] - leftLeg.start[1],
      leftLeg.end[2] - leftLeg.start[2],
    );
    expect(legLen).toBeCloseTo(42 / 3, 4);
  });

  it('triangle flattens when mast is too short: corners clamped above ground, perimeter preserved', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setLength(42);
    store.setHeight(5); // less than equilateral height (~12.12 m)
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)!;
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)!;
    const legLen = Math.hypot(
      leftLeg.end[0] - leftLeg.start[0],
      leftLeg.end[1] - leftLeg.start[1],
      leftLeg.end[2] - leftLeg.start[2],
    );
    const leftHalfBaseLen = Math.hypot(
      leftHalfBase.end[0] - leftHalfBase.start[0],
      leftHalfBase.end[1] - leftHalfBase.start[1],
      leftHalfBase.end[2] - leftHalfBase.start[2],
    );
    const rightHalfBaseLen = Math.hypot(
      rightHalfBase.end[0] - rightHalfBase.start[0],
      rightHalfBase.end[1] - rightHalfBase.start[1],
      rightHalfBase.end[2] - rightHalfBase.start[2],
    );
    const baseLen = leftHalfBaseLen + rightHalfBaseLen + TERMINATED_DELTA_CENTRE_GAP_M;
    // Bottom corners clamped to SLOPING_V_MIN_TIP_Z_M.
    expect(leftLeg.start[2]).toBeCloseTo(SLOPING_V_MIN_TIP_Z_M, 4);
    // In a flattened isosceles triangle (t < equilateral height), legs are
    // SHORTER than P/3 and the base is LONGER than P/3. Limits as t→0 are
    // leg → P/4 and base → P/2.
    expect(legLen).toBeLessThan(42 / 3);
    expect(legLen).toBeGreaterThan(42 / 4 - 1e-6);
    expect(baseLen).toBeGreaterThan(42 / 3);
    expect(baseLen).toBeLessThan(42 / 2 + 1e-6);
    // Perimeter preserved: 2·leg + base ≈ 42.
    expect(2 * legLen + baseLen).toBeCloseTo(42, 3);
  });
});

describe('Terminated Delta — unterminated', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('no stub wires and no termination LD when terminatingResistor=0', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTermLdLines(deck)).toHaveLength(0);
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_STUB_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_STUB_TAG)).toBeUndefined();
  });

  it('unterminated input.loads is undefined (no LD cards anywhere)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.loads).toBeUndefined();
  });
});

describe('Terminated Delta — terminated (per-stub shunt to ground)', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('adds two stub wires and two LD cards when terminatingResistor > 0', () => {
    setupTerminatedDelta(300);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTermLdLines(deck)).toHaveLength(2);
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_STUB_TAG)).toBeDefined();
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_STUB_TAG)).toBeDefined();
  });

  it('stubs are vertical, start at the inner half-base ends, end near ground', () => {
    setupTerminatedDelta(300);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)!;
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)!;
    const leftStub = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_STUB_TAG)!;
    const rightStub = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_STUB_TAG)!;

    // Left stub starts at left half-base's inner end (.end).
    expect(leftStub.start[0]).toBeCloseTo(leftHalfBase.end[0], 6);
    expect(leftStub.start[1]).toBeCloseTo(leftHalfBase.end[1], 6);
    expect(leftStub.start[2]).toBeCloseTo(leftHalfBase.end[2], 6);
    // Right stub starts at right half-base's inner end (.start).
    expect(rightStub.start[0]).toBeCloseTo(rightHalfBase.start[0], 6);
    expect(rightStub.start[1]).toBeCloseTo(rightHalfBase.start[1], 6);
    expect(rightStub.start[2]).toBeCloseTo(rightHalfBase.start[2], 6);

    // Stubs end at the constant floor height.
    expect(leftStub.end[2]).toBeCloseTo(SLOPING_V_STUB_BOTTOM_Z_M, 6);
    expect(rightStub.end[2]).toBeCloseTo(SLOPING_V_STUB_BOTTOM_Z_M, 6);

    // Stubs are vertical (XY coords unchanged).
    expect(leftStub.end[0]).toBeCloseTo(leftStub.start[0], 6);
    expect(leftStub.end[1]).toBeCloseTo(leftStub.start[1], 6);
    expect(rightStub.end[0]).toBeCloseTo(rightStub.start[0], 6);
    expect(rightStub.end[1]).toBeCloseTo(rightStub.start[1], 6);
  });

  it('LD cards are type 4, on segment 1 of each stub, resistance per-stub equals terminatingResistor', () => {
    const R = 500;
    setupTerminatedDelta(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getTermLdLines(deck);
    expect(ldLines).toHaveLength(2);
    for (const line of ldLines) {
      const ld = parseLdLine(line);
      expect(ld.type).toBe(4);
      expect(ld.segmentStart).toBe(1);
      expect(ld.segmentEnd).toBe(1);
      expect(ld.p1).toBeCloseTo(R, 6);
      expect(ld.p2).toBeCloseTo(0, 6);
    }
    // Each tag is loaded exactly once.
    const tags = ldLines.map((l) => parseLdLine(l).tag).sort();
    expect(tags).toEqual([TERMINATED_DELTA_LEFT_STUB_TAG, TERMINATED_DELTA_RIGHT_STUB_TAG]);
  });

  it('no LD cards on the radiating wires themselves (termination is in stubs only)', () => {
    setupTerminatedDelta(300);
    const input = selectSimulationInput(useAntennaStore.getState());
    const radiatingLoads = (input.loads ?? []).filter(
      (l) =>
        l.wireTag === DIPOLE_LEFT_TAG ||
        l.wireTag === DIPOLE_RIGHT_TAG ||
        l.wireTag === TERMINATED_DELTA_LEFT_BASE_TAG ||
        l.wireTag === TERMINATED_DELTA_RIGHT_BASE_TAG,
    );
    expect(radiatingLoads).toHaveLength(0);
  });

  it('all wires remain strictly above z=0 when terminated', () => {
    setupTerminatedDelta(300);
    expectNoGroundTouchingWires(buildNecCards(selectSimulationInput(useAntennaStore.getState())));
  });

  it('no NT (two-port network) card emitted — termination uses LD cards only', () => {
    setupTerminatedDelta(300);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('total per-stub resistance scales with terminatingResistor', () => {
    setupTerminatedDelta(1200);
    const ld1 = parseLdLine(
      getTermLdLines(buildNecCards(selectSimulationInput(useAntennaStore.getState())))[0],
    );

    useAntennaStore.getState().setTerminatingResistor(600);
    const ld2 = parseLdLine(
      getTermLdLines(buildNecCards(selectSimulationInput(useAntennaStore.getState())))[0],
    );
    expect(ld2.p1).toBeCloseTo(ld1.p1 / 2, 6);
  });
});

describe('Terminated Delta — excitation', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('unterminated: excitation is on the last segment of the left leg (apex)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    expectExcitation(buildNecCards(input), DIPOLE_LEFT_TAG, leftLeg.segments);
  });

  it('terminated: excitation is still on the last segment of the left leg (apex)', () => {
    setupTerminatedDelta(300);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    expectExcitation(buildNecCards(input), DIPOLE_LEFT_TAG, leftLeg.segments);
  });
});

describe('Terminated Delta — feedline support', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('emits an apex feed bridge and a feedline shield when a coax is selected', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('rg58');
    store.setFeedlineLength(10);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.wires.find((w) => w.tag === FEED_BRIDGE_TAG)).toBeDefined();
    expect(input.wires.find((w) => w.tag === FEEDLINE_SHIELD_TAG)).toBeDefined();
  });

  it('with a feedline, excitation moves to the shield bottom (rig end)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('rg58');
    store.setFeedlineLength(10);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.excitation.wireTag).toBe(FEEDLINE_SHIELD_TAG);
  });

  it('with a feedline, a TL card is emitted between the apex bridge and the shield', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('rg58');
    store.setFeedlineLength(10);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'TL')).toHaveLength(1);
    expect(input.transmissionLines).toHaveLength(1);
  });
});

describe('Terminated Delta — NEC deck sanity', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('every GW wire is well-formed (radius > 0, segments >= 1)', () => {
    setupTerminatedDelta(300);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const gwLines = getNecLines(deck, 'GW');
    expect(gwLines.length).toBeGreaterThan(0);
    for (const line of gwLines) {
      const gw = parseGwLine(line);
      expect(gw.radius).toBeGreaterThan(0);
      expect(gw.segments).toBeGreaterThanOrEqual(1);
    }
  });

  it('cross-type isolation: switching to dipole removes all terminated-delta tags', () => {
    setupTerminatedDelta(300);
    useAntennaStore.getState().setAntennaType('dipole');
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_STUB_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_STUB_TAG)).toBeUndefined();
  });

  it('cross-type isolation: delta-loop with R > 0 does not emit terminated-delta stub LDs', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setTerminatingResistor(600);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTermLdLines(deck)).toHaveLength(0);
  });

  it('cross-type isolation: sloping-v with R > 0 does not emit terminated-delta stub LDs', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('sloping-v');
    store.setTerminatingResistor(600);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTermLdLines(deck)).toHaveLength(0);
  });

  it('setTerminatingResistor clamps negative values to 0', () => {
    setupTerminatedDelta();
    useAntennaStore.getState().setTerminatingResistor(-100);
    expect(useAntennaStore.getState().terminatingResistor).toBe(0);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTermLdLines(deck)).toHaveLength(0);
  });
});
