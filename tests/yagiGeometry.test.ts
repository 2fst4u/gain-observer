import { describe, expect, it } from 'vitest';
import { buildYagiWires } from '../src/store/antennaGeometry';
import { buildWires, calculateDefaultLength } from '../src/store/antennaSimulation';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { YAGI_DIRECTOR_RATIO, YAGI_REFLECTOR_RATIO, YAGI_SPACING_RATIO, wavelengthMeters, yagiDimensions } from '../src/physics/constants';
import { FEED_BRIDGE_TAG, FEEDLINE_SHIELD_TAG, MAIN_WIRE_TAG, YAGI_DIRECTOR_TAG, YAGI_REFLECTOR_TAG } from '../src/physics/tags';
import type { Wire } from '../src/physics/types';

const len = (w: Wire) => Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1], w.end[2] - w.start[2]);
const mid = (w: Wire) => [(w.start[0] + w.end[0]) / 2, (w.start[1] + w.end[1]) / 2, (w.start[2] + w.end[2]) / 2];

describe('wire Yagi geometry', () => {
  const base = { length: 20, height: 8, wireRadius: 0.001, segments: 21, layout: null };

  it('scales the reflector, director and spacing with the driven element', () => {
    for (const length of [10, 20, 31.7]) {
      const wires = buildYagiWires({ ...base, length, orientation: 90 });
      const driven = wires.find((w) => w.tag === MAIN_WIRE_TAG)!;
      const reflector = wires.find((w) => w.tag === YAGI_REFLECTOR_TAG)!;
      const director = wires.find((w) => w.tag === YAGI_DIRECTOR_TAG)!;
      expect(len(driven)).toBeCloseTo(length, 9);
      expect(len(reflector)).toBeCloseTo(length * YAGI_REFLECTOR_RATIO, 9);
      expect(len(director)).toBeCloseTo(length * YAGI_DIRECTOR_RATIO, 9);
      // Heading 90° = East: the boom runs along +x, the elements along y.
      expect(mid(reflector)[0]).toBeCloseTo(-length * YAGI_SPACING_RATIO, 9);
      expect(mid(director)[0]).toBeCloseTo(length * YAGI_SPACING_RATIO, 9);
      for (const w of [driven, reflector, director]) {
        expect(w.start[0]).toBeCloseTo(w.end[0], 9);
        expect(w.start[2]).toBe(8);
        expect(w.end[2]).toBe(8);
      }
    }
  });

  it('points the director along the beam heading', () => {
    const north = buildYagiWires({ ...base, orientation: 0 });
    expect(mid(north.find((w) => w.tag === YAGI_DIRECTOR_TAG)!)[1]).toBeGreaterThan(0);
    const preset = buildYagiWires({ ...base, orientation: 'EW' });
    expect(mid(preset.find((w) => w.tag === YAGI_DIRECTOR_TAG)!)[0]).toBeGreaterThan(0);
  });

  it('keeps the parasitic elements unbroken and unfed, with a coax shield only on the driven element', () => {
    useAntennaStore.getState().setAntennaType('yagi');
    const state = useAntennaStore.getState();
    const wires = buildWires(state);
    expect(wires.filter((w) => w.tag === YAGI_REFLECTOR_TAG)).toHaveLength(1);
    expect(wires.filter((w) => w.tag === YAGI_DIRECTOR_TAG)).toHaveLength(1);
    expect(wires.some((w) => w.tag === FEED_BRIDGE_TAG)).toBe(true);
    expect(wires.some((w) => w.tag === FEEDLINE_SHIELD_TAG)).toBe(true);
    const input = selectSimulationInput(state);
    expect([FEEDLINE_SHIELD_TAG, FEED_BRIDGE_TAG]).toContain(input.excitation.wireTag);
    expect(input.loads?.some((l) => l.wireTag === YAGI_REFLECTOR_TAG || l.wireTag === YAGI_DIRECTOR_TAG) ?? false).toBe(false);
  });

  it('defaults the driven element to its resonant fraction of a wavelength', () => {
    useAntennaStore.getState().setAntennaType('yagi');
    const s = useAntennaStore.getState();
    expect(s.length).toBeCloseTo(calculateDefaultLength('yagi', s.frequency), 9);
    expect(s.length / wavelengthMeters(s.frequency)).toBeCloseTo(0.4834, 4);
    expect(yagiDimensions(s.length).spacingM / wavelengthMeters(s.frequency)).toBeCloseTo(0.2, 4);
    expect(s.transformerEnabled).toBe(true);
    expect(s.transformerRatio).toBe(1);
  });

  it('keeps the built array when only the operating frequency changes', () => {
    useAntennaStore.getState().setAntennaType('yagi');
    const before = buildWires(useAntennaStore.getState()).filter((w) => w.tag !== FEEDLINE_SHIELD_TAG);
    useAntennaStore.getState().setFrequency(10.1);
    const after = buildWires(useAntennaStore.getState()).filter((w) => w.tag !== FEEDLINE_SHIELD_TAG);
    expect(after).toEqual(before);
  });
});
