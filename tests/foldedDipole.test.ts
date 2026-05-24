import { describe, expect, it } from 'vitest';
import {
  useAntennaStore,
  buildWires,
  selectSimulationInput,
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  FEED_BRIDGE_TAG,
  FOLDED_DIPOLE_OPPOSITE_TAG,
  FOLDED_DIPOLE_CONNECTOR_TAG,
  type AntennaState,
} from '../src/store/antennaStore';

const FREQ = 7.1;
const APERTURE = 0.5;

function foldedDipoleWires(overrides: Partial<Parameters<typeof buildWires>[0]> = {}) {
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
    ...overrides,
  });
}

describe('folded dipole geometry', () => {
  it('emits the six expected wires with the correct tags', () => {
    const wires = foldedDipoleWires();
    expect(wires).toHaveLength(6);
    const tags = wires.map((w) => w.tag);
    expect(tags).toContain(DIPOLE_LEFT_TAG);
    expect(tags).toContain(DIPOLE_RIGHT_TAG);
    expect(tags).toContain(FEED_BRIDGE_TAG);
    expect(tags).toContain(FOLDED_DIPOLE_OPPOSITE_TAG);
    // Two connectors share the connector tag.
    expect(tags.filter((t) => t === FOLDED_DIPOLE_CONNECTOR_TAG)).toHaveLength(2);
  });

  it('keeps every wire at the single antenna height (planar, horizontal)', () => {
    const wires = foldedDipoleWires({ height: 12 });
    for (const w of wires) {
      expect(w.start[2]).toBeCloseTo(12, 9);
      expect(w.end[2]).toBeCloseTo(12, 9);
    }
  });

  it('separates the two conductors by exactly the aperture', () => {
    const wires = foldedDipoleWires();
    const fed = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
    const opp = wires.find((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG)!;
    // EW orientation → conductors offset along the y-axis.
    expect(Math.abs(opp.start[1] - fed.start[1])).toBeCloseTo(APERTURE, 9);
  });

  it('gives the opposite conductor an odd segment count (precise centre for the resistor)', () => {
    const wires = foldedDipoleWires();
    const opp = wires.find((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG)!;
    expect(opp.segments % 2).toBe(1);
  });

  it('forms a closed loop — connector endpoints coincide with both conductors', () => {
    const wires = foldedDipoleWires();
    const left = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
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
      ...overrides,
    } as AntennaState;
  }

  it('feeds the bridge at the centre of the lower conductor', () => {
    const input = selectSimulationInput(fullState({}));
    expect(input.excitation).toEqual({ wireTag: FEED_BRIDGE_TAG, segment: 1 });
  });

  it('adds no termination load when unterminated', () => {
    const input = selectSimulationInput(fullState({ terminatingResistor: 0 }));
    const oppLoads = (input.loads ?? []).filter((l) => l.wireTag === FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(oppLoads).toHaveLength(0);
  });

  it('places one LD-4 resistor on the opposite conductor centre when terminated', () => {
    const state = fullState({ terminatingResistor: 600 });
    const input = selectSimulationInput(state);
    const oppLoads = (input.loads ?? []).filter((l) => l.wireTag === FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(oppLoads).toHaveLength(1);

    const wires = buildWires(state);
    const opp = wires.find((w) => w.tag === FOLDED_DIPOLE_OPPOSITE_TAG)!;
    const centre = Math.ceil(opp.segments / 2);
    expect(oppLoads[0]).toMatchObject({
      type: 4,
      segmentStart: centre,
      segmentEnd: centre,
      param1: 600,
    });
  });
});
