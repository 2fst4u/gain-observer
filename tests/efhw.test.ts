/**
 * Tests for the End-Fed Half-Wave (EFHW) antenna implementation.
 *
 * Verifies:
 *   - geometry builder produces the correct single wire
 *   - excitation is placed on segment 1 (feed end)
 *   - default state on type-switch (transformer on, 49:1 ratio)
 *   - reference length equals ½λ × 0.95
 *   - feedline is NOT supported (no feedline shield emitted)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAntennaStore, EFHW_TAG } from '../src/store/antennaStore';
import { buildEfhwWires } from '../src/store/antennaGeometry';
import { referenceLength } from '../src/physics/constants';
import { selectSimulationInput } from '../src/store/antennaStore';

describe('buildEfhwWires', () => {
  it('returns a single wire with EFHW_TAG', () => {
    const wires = buildEfhwWires({
      length: 10,
      height: 5,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 21,
      frequency: 14.15,
    });
    expect(wires).toHaveLength(1);
    expect(wires[0]!.tag).toBe(EFHW_TAG);
  });

  it('feed end is at the origin, far end along the orientation vector', () => {
    const wires = buildEfhwWires({
      length: 10,
      height: 5,
      orientation: 'EW', // EW → dx=1, dy=0
      wireRadius: 0.001,
      segments: 21,
      frequency: 14.15,
    });
    const wire = wires[0]!;
    // Feed end at origin (x=0, y=0, z=height)
    expect(wire.start[0]).toBeCloseTo(0);
    expect(wire.start[1]).toBeCloseTo(0);
    expect(wire.start[2]).toBeCloseTo(5);
    // Far end displaced along E–W axis
    expect(Math.abs(wire.end[0])).toBeCloseTo(10);
    expect(wire.end[1]).toBeCloseTo(0);
    expect(wire.end[2]).toBeCloseTo(5);
  });

  it('segments are at least MIN_SEGS_PER_LEG (9) even for a short wire', () => {
    const wires = buildEfhwWires({
      length: 0.5,
      height: 5,
      orientation: 'NS',
      wireRadius: 0.001,
      segments: 1,
      frequency: 1.9,
    });
    expect(wires[0]!.segments).toBeGreaterThanOrEqual(9);
  });

  it('segment count scales with electrical length', () => {
    // At 28 MHz the ½λ wire is short → fewer segments than at 3.5 MHz
    const wiresHf = buildEfhwWires({
      length: 5,
      height: 5,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 21,
      frequency: 28,
    });
    const wiresLf = buildEfhwWires({
      length: 40,
      height: 5,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 21,
      frequency: 3.5,
    });
    expect(wiresLf[0]!.segments).toBeGreaterThanOrEqual(wiresHf[0]!.segments);
  });
});

describe('referenceLength for efhw', () => {
  it('equals ½λ × 0.95 at 14.15 MHz', () => {
    const lambda = 299.792458 / 14.15;
    const expected = lambda * 0.5 * 0.95;
    expect(referenceLength('efhw', 14.15)).toBeCloseTo(expected, 5);
  });

  it('equals ½λ × 0.95 at 7.1 MHz', () => {
    const lambda = 299.792458 / 7.1;
    const expected = lambda * 0.5 * 0.95;
    expect(referenceLength('efhw', 7.1)).toBeCloseTo(expected, 5);
  });
});

describe('antennaStore EFHW type-switch', () => {
  beforeEach(() => {
    // Reset the store to a known state before each test
    useAntennaStore.getState().setAntennaType('dipole');
    useAntennaStore.getState().setFrequency(14.15);
    useAntennaStore.getState().setTransformerEnabled(false);
    useAntennaStore.getState().setTransformerRatio(1);
  });

  it('setAntennaType("efhw") sets transformerEnabled=true and transformerRatio=49', () => {
    useAntennaStore.getState().setAntennaType('efhw');
    const s = useAntennaStore.getState();
    expect(s.antennaType).toBe('efhw');
    expect(s.transformerEnabled).toBe(true);
    expect(s.transformerRatio).toBe(49);
  });

  it('setAntennaType("efhw") sets terminatingResistor=0', () => {
    // Start with a terminated antenna to verify it gets reset
    useAntennaStore.getState().setAntennaType('sloping-v'); // sets R=300
    useAntennaStore.getState().setAntennaType('efhw');
    expect(useAntennaStore.getState().terminatingResistor).toBe(0);
  });

  it('setAntennaType("efhw") sets resonant default length ≈ ½λ × 0.95', () => {
    useAntennaStore.getState().setAntennaType('efhw');
    const s = useAntennaStore.getState();
    const lambda = 299.792458 / s.frequency;
    const expected = lambda * 0.5 * 0.95;
    expect(s.length).toBeCloseTo(expected, 3);
  });
});

describe('selectSimulationInput for EFHW', () => {
  beforeEach(() => {
    useAntennaStore.getState().setAntennaType('efhw');
    useAntennaStore.getState().setFrequency(14.15);
    useAntennaStore.getState().setHeight(10);
  });

  it('produces exactly one wire with EFHW_TAG', () => {
    const input = selectSimulationInput(useAntennaStore.getState());
    const efhwWires = input.wires.filter((w) => w.tag === EFHW_TAG);
    expect(efhwWires).toHaveLength(1);
  });

  it('excitation is placed on EFHW_TAG segment 1', () => {
    const input = selectSimulationInput(useAntennaStore.getState());
    expect(input.excitation.wireTag).toBe(EFHW_TAG);
    expect(input.excitation.segment).toBe(1);
  });

  it('does NOT produce a feedline shield wire (feedline not supported)', () => {
    // Set a feedline to verify it is ignored for EFHW
    useAntennaStore.getState().setFeedline('rg58');
    useAntennaStore.getState().setFeedlineLength(10);
    const input = selectSimulationInput(useAntennaStore.getState());
    // FEEDLINE_SHIELD_TAG = 4 — should not appear in EFHW wires
    const shieldWires = input.wires.filter((w) => w.tag === 4);
    expect(shieldWires).toHaveLength(0);
  });
});
