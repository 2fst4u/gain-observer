import { describe, expect, it } from 'vitest';
import {
  useAntennaStore,
  buildWires,
  selectSimulationInput,
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  FEED_BRIDGE_TAG,
  FOLDED_DIPOLE_OPPOSITE_TAG,
  FOLDED_DIPOLE_CONNECTOR_TAG,
  FOLDED_DIPOLE_TERM_BRIDGE_TAG,
  type AntennaState,
} from '../src/store/antennaStore';
import { TERMINATED_DELTA_CENTRE_GAP_M, FEEDLINE_SHIELD_TAG } from '../src/physics/constants';

const FREQ = 7.1;
const APERTURE = 0.5;

function foldedAntennaWires(overrides: Partial<Parameters<typeof buildWires>[0]> = {}) {
  return buildWires({
    antennaType: 'folded-dipole',
    length: 20,
    height: 10,
    orientation: 'EW',
    wireRadius: 0.001,
    segments: 21,
    frequency: FREQ,
    vAngle: 180,
    legSlope: 0,
    foldedDipoleAperture: APERTURE,
    terminatingResistor: 0,
    ...overrides,
  });
}

describe('folded dipole geometry', () => {
  it('emits the seven expected wires with the correct tags', () => {
    const wires = foldedAntennaWires();
    expect(wires).toHaveLength(7);
    const tags = wires.map((w) => w.tag);
    expect(tags).toContain(LEFT_LEG_TAG);
    expect(tags).toContain(RIGHT_LEG_TAG);
    expect(tags).toContain(FEED_BRIDGE_TAG);
    // Top conductor split into 2 halves — both share FOLDED_DIPOLE_OPPOSITE_TAG.
    expect(tags.filter((t) => t === FOLDED_DIPOLE_OPPOSITE_TAG)).toHaveLength(2);
    // Two connectors share the connector tag.
    expect(tags.filter((t) => t === FOLDED_DIPOLE_CONNECTOR_TAG)).toHaveLength(2);
  });

  it('places the fed (bottom) conductor at height and the opposite (top) conductor at height + aperture', () => {
    const wires = foldedAntennaWires({ height: 12 });
    // Fed conductor wires (left half, bridge, right half) must be at z = 12.
    const fedTags = new Set([LEFT_LEG_TAG, RIGHT_LEG_TAG, FEED_BRIDGE_TAG]);
    for (const w of wires.filter((w) => fedTags.has(w.tag))) {
      expect(w.start[2]).toBeCloseTo(12, 9);
      expect(w.end[2]).toBeCloseTo(12, 9);
    }
    // Opposite (top) conductor halves must both be at z = 12 + aperture.
    const oppWires = wires.filter((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG);
    for (const opp of oppWires) {
      expect(opp.start[2]).toBeCloseTo(12 + APERTURE, 9);
      expect(opp.end[2]).toBeCloseTo(12 + APERTURE, 9);
    }
    // Connectors must span from z = 12 (bottom) to z = 12 + aperture (top).
    const connectors = wires.filter((w) => w.tag === FOLDED_DIPOLE_CONNECTOR_TAG);
    for (const c of connectors) {
      const zLow = Math.min(c.start[2], c.end[2]);
      const zHigh = Math.max(c.start[2], c.end[2]);
      expect(zLow).toBeCloseTo(12, 9);
      expect(zHigh).toBeCloseTo(12 + APERTURE, 9);
    }
  });

  it('separates the two conductors vertically by exactly the aperture', () => {
    const wires = foldedAntennaWires();
    const fed = wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    const opp = wires.find((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG)!;
    // Vertical separation — top conductor is aperture above the bottom conductor.
    expect(opp.start[2] - fed.start[2]).toBeCloseTo(APERTURE, 9);
    // No horizontal offset between conductors for vertical aperture.
    expect(opp.start[0]).toBeCloseTo(fed.start[0], 9);
    expect(opp.start[1]).toBeCloseTo(fed.start[1], 9);
  });

  it('unterminated: top conductor halves share a common junction at topCenter (no gap)', () => {
    const wires = foldedAntennaWires({ height: 12, terminatingResistor: 0 });
    const oppWires = wires.filter((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(oppWires).toHaveLength(2);
    // topCenter = (0, 0, height + aperture) for any orientation.
    // When unterminated, left-half.end === right-half.start (shared junction = continuous wire).
    const leftEnd = oppWires[0]!.end;
    const rightStart = oppWires[1]!.start;
    expect(leftEnd[0]).toBeCloseTo(rightStart[0], 9);
    expect(leftEnd[1]).toBeCloseTo(rightStart[1], 9);
    expect(leftEnd[2]).toBeCloseTo(rightStart[2], 9);
    // That shared point is directly above the feed centre.
    expect(leftEnd[0]).toBeCloseTo(0, 9);
    expect(leftEnd[1]).toBeCloseTo(0, 9);
    expect(leftEnd[2]).toBeCloseTo(12 + APERTURE, 9);
  });

  it('terminated: top conductor halves have a gap of TERMINATED_DELTA_CENTRE_GAP_M at the centre', () => {
    const wires = foldedAntennaWires({ height: 12, terminatingResistor: 600 });
    const oppWires = wires.filter((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(oppWires).toHaveLength(2);
    const leftEnd = oppWires[0]!.end;    // topCenterLeft
    const rightStart = oppWires[1]!.start; // topCenterRight
    // Both halves are at z = height + aperture.
    expect(leftEnd[2]).toBeCloseTo(12 + APERTURE, 9);
    expect(rightStart[2]).toBeCloseTo(12 + APERTURE, 9);
    // The gap between them equals TERMINATED_DELTA_CENTRE_GAP_M.
    const gapDist = Math.hypot(
      rightStart[0] - leftEnd[0],
      rightStart[1] - leftEnd[1],
      rightStart[2] - leftEnd[2],
    );
    expect(gapDist).toBeCloseTo(TERMINATED_DELTA_CENTRE_GAP_M, 6);
  });

  it('forms a closed loop — connector endpoints coincide with both conductors', () => {
    const wires = foldedAntennaWires();
    const left = wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    const opp = wires.find((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG)!;
    const connectors = wires.filter((w) => w.tag === FOLDED_DIPOLE_CONNECTOR_TAG);
    // One connector must touch the fed conductor's left end and the opposite
    // conductor's matching end.
    const touchesFedLeft = connectors.some(
      (c) => c.start.every((v, i) => Math.abs(v - left.start[i]) < 1e-9),
    );
    const touchesOppLeft = connectors.some(
      (c) => c.end.every((v, i) => Math.abs(v - opp.start[i]) < 1e-9),
    );
    expect(touchesFedLeft).toBe(true);
    expect(touchesOppLeft).toBe(true);
  });
});

describe('folded dipole excitation and termination', () => {
  function fullState(overrides: Partial<AntennaState>): AntennaState {
    return {
      ...useAntennaStore.getState(),
      antennaType: 'folded-dipole',
      length: 20,
      height: 10,
      frequency: FREQ,
      orientation: 'EW',
      foldedDipoleAperture: APERTURE,
      terminatingResistor: 0,
      // Bare antenna by default — feedline coverage lives in its own block.
      feedlineId: 'none',
      ...overrides,
    } as AntennaState;
  }

  it('feeds the bridge at the centre of the lower conductor', () => {
    const input = selectSimulationInput(fullState({}));
    expect(input.excitation).toEqual({ wireTag: FEED_BRIDGE_TAG, segment: 1 });
  });

  it('adds no termination load or bridge wire when unterminated', () => {
    const input = selectSimulationInput(fullState({ terminatingResistor: 0 }));
    // No LD on the opposite conductor wires.
    const oppLoads = (input.loads ?? []).filter((l) => l.wireTag === FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(oppLoads).toHaveLength(0);
    // No termination bridge wire present.
    const termBridges = input.wires.filter((w) => w.tag === FOLDED_DIPOLE_TERM_BRIDGE_TAG);
    expect(termBridges).toHaveLength(0);
  });

  it('adds a gap-spanning bridge wire with LD-4 at the top-conductor centre when terminated', () => {
    const state = fullState({ terminatingResistor: 600 });
    const input = selectSimulationInput(state);

    // A bridge wire (FOLDED_DIPOLE_TERM_BRIDGE_TAG) must be present.
    const termBridges = input.wires.filter((w) => w.tag === FOLDED_DIPOLE_TERM_BRIDGE_TAG);
    expect(termBridges).toHaveLength(1);
    const bridge = termBridges[0]!;
    expect(bridge.segments).toBe(1);

    // Bridge must span the gap between the two top-conductor halves.
    // Both endpoints are at z = height + aperture.
    expect(bridge.start[2]).toBeCloseTo(10 + APERTURE, 9);
    expect(bridge.end[2]).toBeCloseTo(10 + APERTURE, 9);

    // Bridge length equals the gap width.
    const bridgeLen = Math.hypot(
      bridge.end[0] - bridge.start[0],
      bridge.end[1] - bridge.start[1],
      bridge.end[2] - bridge.start[2],
    );
    expect(bridgeLen).toBeCloseTo(TERMINATED_DELTA_CENTRE_GAP_M, 6);

    // LD-4 on segment 1 of the bridge wire, with the correct resistance.
    const bridgeLoads = (input.loads ?? []).filter((l) => l.wireTag === FOLDED_DIPOLE_TERM_BRIDGE_TAG);
    expect(bridgeLoads).toHaveLength(1);
    expect(bridgeLoads[0]).toMatchObject({
      type: 4,
      wireTag: FOLDED_DIPOLE_TERM_BRIDGE_TAG,
      segmentStart: 1,
      segmentEnd: 1,
      param1: 600,
      param2: 0,
    });

    // No LD placed directly on the opposite conductor wires.
    const oppLoads = (input.loads ?? []).filter((l) => l.wireTag === FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(oppLoads).toHaveLength(0);
  });
});

describe('folded dipole feedline', () => {
  function feedlineState(overrides: Partial<AntennaState> = {}): AntennaState {
    return {
      ...useAntennaStore.getState(),
      antennaType: 'folded-dipole',
      length: 20,
      height: 10,
      frequency: FREQ,
      orientation: 'EW',
      foldedDipoleAperture: APERTURE,
      terminatingResistor: 0,
      feedlineId: 'rg58',
      feedlineLength: 10,
      transformerEnabled: false,
      ...overrides,
    } as AntennaState;
  }

  it('drops a coax shield wire vertically from the bottom-conductor feedpoint', () => {
    const wires = buildWires(feedlineState());
    const shields = wires.filter((w) => w.tag === FEEDLINE_SHIELD_TAG);
    expect(shields).toHaveLength(1);
    const shield = shields[0]!;
    const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
    // Shield starts at the feed bridge end…
    expect(shield.start[0]).toBeCloseTo(bridge.end[0], 9);
    expect(shield.start[1]).toBeCloseTo(bridge.end[1], 9);
    expect(shield.start[2]).toBeCloseTo(bridge.end[2], 9);
    // …and drops straight down (same x,y; lower z).
    expect(shield.end[0]).toBeCloseTo(shield.start[0], 9);
    expect(shield.end[1]).toBeCloseTo(shield.start[1], 9);
    expect(shield.end[2]).toBeLessThan(shield.start[2]);
  });

  it('moves the excitation to the shield and adds a transmission line when fed', () => {
    const input = selectSimulationInput(feedlineState());
    expect(input.excitation.wireTag).toBe(FEEDLINE_SHIELD_TAG);
    expect((input.transmissionLines ?? []).length).toBeGreaterThan(0);
  });

  it('builds no shield and feeds the bridge directly when the feedline is off', () => {
    const input = selectSimulationInput(feedlineState({ feedlineId: 'none' }));
    const shields = input.wires.filter((w) => w.tag === FEEDLINE_SHIELD_TAG);
    expect(shields).toHaveLength(0);
    expect(input.excitation).toEqual({ wireTag: FEED_BRIDGE_TAG, segment: 1 });
  });
});
