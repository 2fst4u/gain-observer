import { describe, it, expect } from 'vitest';
import { gradedSegmentPlan, orientationVector, buildInvertedLWires, buildVerticalWhipWires } from '../src/store/antennaGeometry';
import {
  INVERTED_L_VERTICAL_TAG,
  INVERTED_L_HORIZONTAL_TAG,
  INVERTED_L_RADIAL_TAG,
  VERTICAL_WHIP_RADIAL_COUNT,
  VERTICAL_WHIP_TAG,
  VERTICAL_WHIP_RADIAL_TAG
} from '../src/physics/constants';

describe('gradedSegmentPlan', () => {
  it('returns empty plan for zero or negative length', () => {
    expect(gradedSegmentPlan(0, 1, 2)).toEqual({ prefixLens: [], tailLen: 0, tailCount: 0 });
    expect(gradedSegmentPlan(-5, 1, 2)).toEqual({ prefixLens: [], tailLen: 0, tailCount: 0 });
  });

  it('calculates geometric growth and uniform tail correctly', () => {
    // total = 10, start = 1, max = 4, growth = 2
    // Loop 1: cur=1 -> accum=1, cur=2
    // Loop 2: cur=2 -> accum=3, cur=4
    // Loop ends (cur=4 is not < maxSegLen)
    // remaining = 7. tailCount = round(7 / 4) = 2. tailLen = 7 / 2 = 3.5
    const plan = gradedSegmentPlan(10, 1, 4, 2);
    expect(plan.prefixLens).toEqual([1, 2]);
    expect(plan.tailCount).toBe(2);
    expect(plan.tailLen).toBeCloseTo(3.5);
  });

  it('handles small remaining length without creating tails if close to 0', () => {
    // total = 1e-10, start = 1, max = 4, growth = 2
    // Loop won't run because 1 < 1e-10 is false
    // accum = 0, remaining = 1e-10 which is < 1e-9
    const plan = gradedSegmentPlan(1e-10, 1, 4, 2);
    expect(plan.prefixLens).toEqual([]);
    expect(plan.tailCount).toBe(0);
    expect(plan.tailLen).toBe(0);
  });

  it('clamps startSegLen and maxSegLen to prevent infinite loops / div by 0', () => {
    // testing minimum lengths handled by Math.max(..., 1e-9)
    const plan = gradedSegmentPlan(1, 0, 0, 2);
    // startSegLen = 1e-9, maxSegLen = 1e-9
    // loop won't execute because cur < maxSegLen is 1e-9 < 1e-9 (false)
    // remaining = 1. tailCount = round(1 / 1e-9) = 1e9.
    // tailLen = 1 / 1e9 = 1e-9
    expect(plan.prefixLens).toEqual([]);
    expect(plan.tailCount).toBe(1000000000);
    expect(plan.tailLen).toBeCloseTo(1e-9);
  });
});

describe('orientationVector', () => {
  it('handles NS preset (0 degrees)', () => {
    const [x, y] = orientationVector('NS');
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });

  it('handles EW preset (90 degrees)', () => {
    const [x, y] = orientationVector('EW');
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
  });

  it('handles NE-SW preset (45 degrees)', () => {
    const [x, y] = orientationVector('NE-SW');
    expect(x).toBeCloseTo(Math.SQRT1_2); // cos(45deg)
    expect(y).toBeCloseTo(Math.SQRT1_2); // sin(45deg)
  });

  it('handles NW-SE preset (315 degrees)', () => {
    const [x, y] = orientationVector('NW-SE');
    expect(x).toBeCloseTo(-Math.SQRT1_2); // cos(-225deg) = -0.707
    expect(y).toBeCloseTo(Math.SQRT1_2);  // sin(-225deg) = 0.707
  });

  it('handles arbitrary numeric degrees', () => {
    // 180 deg (South)
    const [x, y] = orientationVector(180);
    // (90 - 180) = -90. cos(-90)=0, sin(-90)=-1
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-1);
  });

  it('handles unrecognised string by falling back to 0 degrees', () => {
    // @ts-expect-error intentionally invalid input
    const [x, y] = orientationVector('INVALID');
    // switch won't match, deg stays 0
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });
});

describe('buildInvertedLWires', () => {
  const baseParams = {
    length: 20, // total 20m
    height: 10, // bend at 10m
    frequency: 14.15,
    segments: 51,
    wireRadius: 0.001,
    orientation: 'NS' as const,
    counterpoise: false,
  };

  it('creates both vertical and horizontal sections for standard params', () => {
    const wires = buildInvertedLWires(baseParams);
    expect(wires).toHaveLength(2);

    const vertical = wires.find(w => w.tag === INVERTED_L_VERTICAL_TAG);
    const horizontal = wires.find(w => w.tag === INVERTED_L_HORIZONTAL_TAG);

    expect(vertical).toBeDefined();
    expect(horizontal).toBeDefined();

    // Verify lengths roughly (bendZ = 10.1 if baseZ = 0.1, vertical ~10m, horiz ~10m)
    expect(vertical!.end[2]).toBeGreaterThan(9.9);
    expect(horizontal!.end[1]).toBeGreaterThan(9); // NS orientation means Y increases
  });

  it('omits horizontal section if height >= total length', () => {
    const tallParams = { ...baseParams, height: 25, length: 20 };
    const wires = buildInvertedLWires(tallParams);

    // Total length clamped to height roughly.
    expect(wires).toHaveLength(1);
    expect(wires[0].tag).toBe(INVERTED_L_VERTICAL_TAG);
    expect(wires.find(w => w.tag === INVERTED_L_HORIZONTAL_TAG)).toBeUndefined();
  });

  it('adds counterpoise radials if requested', () => {
    const params = { ...baseParams, counterpoise: true };
    const wires = buildInvertedLWires(params);

    const radials = wires.filter(w => w.tag === INVERTED_L_RADIAL_TAG);
    expect(radials).toHaveLength(VERTICAL_WHIP_RADIAL_COUNT);
  });

  it('clamps segments for very short sections to maintain NEC stability', () => {
    const shortParams = {
      ...baseParams,
      length: 8.01,
      height: 8,
      wireRadius: 0.001,
      segments: 51,
    };
    // baseZ = 0.01. vertLen = min(8.01, 8 - 0.01) = 7.99.
    // horizLen = 8.01 - 7.99 = 0.02.
    // safeSegs for horiz: floor(0.02 / (4 * 0.001)) = 5.
    const wires = buildInvertedLWires(shortParams);
    const horizontal = wires.find(w => w.tag === INVERTED_L_HORIZONTAL_TAG);
    expect(horizontal).toBeDefined();
    expect(horizontal!.segments).toBeLessThanOrEqual(5);
  });
});

describe('buildVerticalWhipWires', () => {
  const baseParams = {
    length: 10,
    height: 0,
    frequency: 14.15,
    segments: 51,
    wireRadius: 0.001,
    counterpoise: false,
  };

  it('creates a single vertical wire with the correct tag', () => {
    const wires = buildVerticalWhipWires(baseParams);
    expect(wires).toHaveLength(1);

    const vertical = wires[0];
    expect(vertical.tag).toBe(VERTICAL_WHIP_TAG);
    expect(vertical.start).toEqual([0, 0, 0.01]); // VERTICAL_WHIP_BASE_GAP_M is 0.01
    expect(vertical.end).toEqual([0, 0, 10.01]); // 0.01 + 10
  });

  it('respects minimum length and height gap bounds', () => {
    const smallParams = {
      ...baseParams,
      length: 0.05, // Should be max(0.1, length) = 0.1
      height: 0.005, // Should be max(0.01, height) = 0.01
    };
    const wires = buildVerticalWhipWires(smallParams);
    expect(wires).toHaveLength(1);

    const vertical = wires[0];
    expect(vertical.start).toEqual([0, 0, 0.01]);
    expect(vertical.end[2]).toBeCloseTo(0.11); // 0.01 + 0.1
  });

  it('adds radials when counterpoise is true', () => {
    const params = { ...baseParams, counterpoise: true };
    const wires = buildVerticalWhipWires(params);

    // 1 vertical wire + 4 radials
    expect(wires).toHaveLength(1 + VERTICAL_WHIP_RADIAL_COUNT);

    const radials = wires.filter(w => w.tag === VERTICAL_WHIP_RADIAL_TAG);
    expect(radials).toHaveLength(VERTICAL_WHIP_RADIAL_COUNT);

    // Radials should start at the baseZ
    radials.forEach(radial => {
      expect(radial.start).toEqual([0, 0, 0.01]);
      expect(radial.end[2]).toBe(0.01);
    });
  });

  it('calculates segment lengths based on frequency lambda bounds', () => {
    const params = {
      ...baseParams,
      length: 20, // Long whip
      segments: 5, // Request very few segments
    };

    // lambda ~ 21.2m
    // minSegs = ceil((21 * 20) / 21.2) ~ 20.
    // segments = min(200, max(1, 20, 5)) -> 20.

    const wires = buildVerticalWhipWires(params);
    expect(wires).toHaveLength(1);

    const vertical = wires[0];
    expect(vertical.segments).toBeGreaterThan(5); // Forced up by minSegs
  });
});
