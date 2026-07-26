import { describe, it, expect, beforeEach } from 'vitest';
import {
  useAntennaStore,
  selectSimulationInput,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  TERMINATED_DELTA_BRIDGE_TAG,
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
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  SLOPING_V_MIN_TIP_Z_M,
  FEED_BRIDGE_LENGTH_M,
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
    return ld.type === 4 && ld.tag === TERMINATED_DELTA_BRIDGE_TAG;
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

  it('switching to terminated-delta from unterminated defaults R to 600 Ω', () => {
    const store = useAntennaStore.getState();
    store.setTerminatingResistor(0);
    store.setAntennaType('terminated-delta');
    expect(useAntennaStore.getState().terminatingResistor).toBe(600);
  });

  it('switching to terminated-delta preserves an existing non-zero R', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('sloping-v'); // sets R=300
    store.setTerminatingResistor(450);
    store.setAntennaType('terminated-delta');
    expect(useAntennaStore.getState().terminatingResistor).toBe(450);
  });

  it('switching to terminated-delta engages a 9:1 transformer by default', () => {
    const store = useAntennaStore.getState();
    store.setTransformerEnabled(false);
    store.setTransformerRatio(1);
    store.setAntennaType('terminated-delta');
    expect(useAntennaStore.getState().transformerEnabled).toBe(true);
    expect(useAntennaStore.getState().transformerRatio).toBe(9);
  });
});

describe('Terminated Delta — NT-card transformer', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('with feedline + transformer + ratio>1: emits one NT card from bridge to shield top', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('rg58');
    store.setTransformerEnabled(true);
    store.setTransformerRatio(9);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(input.networks).toHaveLength(1);
    expect(getNecLines(deck, 'NT')).toHaveLength(1);
    const nt = input.networks![0]!;
    expect(nt.fromTag).toBe(FEED_BRIDGE_TAG);
    expect(nt.fromSegment).toBe(1);
    expect(nt.toTag).toBe(FEEDLINE_SHIELD_TAG);
    expect(nt.toSegment).toBe(1);
    // Lossless transformer: all real parts of Y are zero.
    expect(nt.y11Real).toBe(0);
    expect(nt.y12Real).toBe(0);
    expect(nt.y22Real).toBe(0);
    // Ideal transformer relationship: Y22 / Y11 = n² (impedance ratio).
    expect(Math.abs(nt.y22Imag! / nt.y11Imag!)).toBeCloseTo(9, 3);
    // And Y12 / Y11 = -n (voltage ratio sign-flipped).
    expect(Math.abs(nt.y12Imag! / nt.y11Imag!)).toBeCloseTo(3, 3);
  });

  it('with feedline + transformer + ratio>1: TL carries cable signal from shield top to shield bottom', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('rg58');
    store.setTransformerEnabled(true);
    store.setTransformerRatio(9);
    const input = selectSimulationInput(useAntennaStore.getState());
    const tl = input.transmissionLines![0]!;
    expect(tl.fromTag).toBe(FEEDLINE_SHIELD_TAG);
    expect(tl.toTag).toBe(FEEDLINE_SHIELD_TAG);
  });

  it('with feedline + transformer disabled: TL still goes bridge→shield (no NT card)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('rg58');
    store.setTransformerEnabled(false);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.networks).toBeUndefined();
    const tl = input.transmissionLines![0]!;
    expect(tl.fromTag).toBe(FEED_BRIDGE_TAG);
    expect(tl.toTag).toBe(FEEDLINE_SHIELD_TAG);
  });

  it('with feedline + transformer + ratio=1: no NT card (choke-only mode)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('rg58');
    store.setTransformerEnabled(true);
    store.setTransformerRatio(1);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.networks).toBeUndefined();
  });

  it('with no feedline: no NT card (transformer is display-only)', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFrequency(7.1);
    store.setHeight(15);
    store.setLength(42);
    store.setFeedline('none');
    store.setTransformerEnabled(true);
    store.setTransformerRatio(9);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.networks).toBeUndefined();
  });
});

describe('Terminated Delta — base geometry', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('emits two top legs and two half-base wires (no continuous base)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG);
    const rightLeg = input.wires.find((w) => w.tag === RIGHT_LEG_TAG);
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
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    expect(leftLeg.end[2]).toBeCloseTo(15, 6);
  });

  it('right leg starts at the apex (.start is at the mast height)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const rightLeg = input.wires.find((w) => w.tag === RIGHT_LEG_TAG)!;
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

  it('the two half-base inner ends are separated by FEED_BRIDGE_LENGTH_M', () => {
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
    expect(gap).toBeCloseTo(FEED_BRIDGE_LENGTH_M, 6);
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
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    const rightLeg = input.wires.find((w) => w.tag === RIGHT_LEG_TAG)!;
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
    store.setFeedline('none');
    store.setFrequency(7.1);
    store.setLength(42);
    store.setHeight(30); // tall enough for equilateral height ~12.12 m
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG)!;
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
    store.setFeedline('none');
    store.setFrequency(7.1);
    store.setLength(42);
    store.setHeight(5); // less than equilateral height (~12.12 m)
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG)!;
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
    const baseLen = leftHalfBaseLen + rightHalfBaseLen + FEED_BRIDGE_LENGTH_M;
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

  it('no bridge wire and no termination LD when terminatingResistor=0', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTermLdLines(deck)).toHaveLength(0);
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_BRIDGE_TAG)).toBeUndefined();
  });

  it('unterminated input.loads is undefined (no LD cards anywhere)', () => {
    setupTerminatedDelta(0);
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.loads).toBeUndefined();
  });
});

describe('Terminated Delta — terminated (T2FD-style bridge resistor)', () => {
  beforeEach(() => {
    useAntennaStore.getState().setTerminatingResistor(0);
  });

  it('adds a single bridge wire and one LD card when terminatingResistor > 0', () => {
    setupTerminatedDelta(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getTermLdLines(deck)).toHaveLength(1);
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_BRIDGE_TAG)).toBeDefined();
  });

  it('bridge is horizontal at bottomZ, spans the two inner half-base ends', () => {
    setupTerminatedDelta(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)!;
    const rightHalfBase = input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)!;
    const bridge = input.wires.find((w) => w.tag === TERMINATED_DELTA_BRIDGE_TAG)!;

    // Bridge starts at the LEFT half-base's inner end (.end).
    expect(bridge.start[0]).toBeCloseTo(leftHalfBase.end[0], 6);
    expect(bridge.start[1]).toBeCloseTo(leftHalfBase.end[1], 6);
    expect(bridge.start[2]).toBeCloseTo(leftHalfBase.end[2], 6);
    // Bridge ends at the RIGHT half-base's inner end (.start).
    expect(bridge.end[0]).toBeCloseTo(rightHalfBase.start[0], 6);
    expect(bridge.end[1]).toBeCloseTo(rightHalfBase.start[1], 6);
    expect(bridge.end[2]).toBeCloseTo(rightHalfBase.start[2], 6);

    // Bridge is horizontal (same z at both ends).
    expect(bridge.start[2]).toBeCloseTo(bridge.end[2], 6);
    // Bridge length equals the configured gap.
    const len = Math.hypot(
      bridge.end[0] - bridge.start[0],
      bridge.end[1] - bridge.start[1],
      bridge.end[2] - bridge.start[2],
    );
    expect(len).toBeCloseTo(FEED_BRIDGE_LENGTH_M, 6);
  });

  it('LD card is type 4 on segment 1 of the bridge, resistance equals terminatingResistor', () => {
    const R = 500;
    setupTerminatedDelta(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    const ldLines = getTermLdLines(deck);
    expect(ldLines).toHaveLength(1);
    const ld = parseLdLine(ldLines[0]);
    expect(ld.type).toBe(4);
    expect(ld.tag).toBe(TERMINATED_DELTA_BRIDGE_TAG);
    expect(ld.segmentStart).toBe(1);
    expect(ld.segmentEnd).toBe(1);
    expect(ld.p1).toBeCloseTo(R, 6);
    expect(ld.p2).toBeCloseTo(0, 6);
  });

  it('no LD cards on the radiating wires themselves (termination is on the bridge only)', () => {
    setupTerminatedDelta(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const radiatingLoads = (input.loads ?? []).filter(
      (l) =>
        l.wireTag === LEFT_LEG_TAG ||
        l.wireTag === RIGHT_LEG_TAG ||
        l.wireTag === TERMINATED_DELTA_LEFT_BASE_TAG ||
        l.wireTag === TERMINATED_DELTA_RIGHT_BASE_TAG,
    );
    expect(radiatingLoads).toHaveLength(0);
  });

  it('all wires remain strictly above z=0 when terminated', () => {
    setupTerminatedDelta(600);
    expectNoGroundTouchingWires(buildNecCards(selectSimulationInput(useAntennaStore.getState())));
  });

  it('no NT (two-port network) card emitted — termination uses an LD card only', () => {
    setupTerminatedDelta(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);
    expect(getNecLines(deck, 'NT')).toHaveLength(0);
    expect(input.networks).toBeUndefined();
  });

  it('bridge LD resistance scales with terminatingResistor', () => {
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
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    expectExcitation(buildNecCards(input), LEFT_LEG_TAG, leftLeg.segments);
  });

  it('terminated: excitation is still on the last segment of the left leg (apex)', () => {
    setupTerminatedDelta(600);
    const input = selectSimulationInput(useAntennaStore.getState());
    const leftLeg = input.wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    expectExcitation(buildNecCards(input), LEFT_LEG_TAG, leftLeg.segments);
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
    setupTerminatedDelta(600);
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
    setupTerminatedDelta(600);
    useAntennaStore.getState().setAntennaType('dipole');
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG)).toBeUndefined();
    expect(input.wires.find((w) => w.tag === TERMINATED_DELTA_BRIDGE_TAG)).toBeUndefined();
  });

  it('cross-type isolation: delta-loop with R > 0 does not emit terminated-delta bridge LD', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setTerminatingResistor(600);
    const deck = buildNecCards(selectSimulationInput(useAntennaStore.getState()));
    expect(getTermLdLines(deck)).toHaveLength(0);
  });

  it('cross-type isolation: sloping-v with R > 0 does not emit terminated-delta bridge LD', () => {
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
