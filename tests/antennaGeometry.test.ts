import { describe, it, expect } from 'vitest';
import { gradedSegmentPlan, orientationVector, buildInvertedLWires, buildDeltaLoopWires, MIN_SEGS_PER_LEG, MAX_SEGS_PER_LEG } from '../src/store/antennaGeometry';
import {
  INVERTED_L_VERTICAL_TAG,
  INVERTED_L_HORIZONTAL_TAG,
  INVERTED_L_RADIAL_TAG,
  VERTICAL_WHIP_RADIAL_COUNT,
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  DELTA_BASE_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG
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

describe('buildDeltaLoopWires', () => {
  const baseParams = {
    length: 21, // perimeter ~ 1 wavelength at 14.15 MHz
    height: 10,
    frequency: 14.15,
    segments: 51,
    wireRadius: 0.001,
    orientation: 'NS' as const,
    feedlineShield: null,
  };

  it('creates three wires for a basic un-fed delta loop', () => {
    const wires = buildDeltaLoopWires(baseParams);
    expect(wires).toHaveLength(3);

    const leftLeg = wires.find(w => w.tag === LEFT_LEG_TAG);
    const rightLeg = wires.find(w => w.tag === RIGHT_LEG_TAG);
    const baseWire = wires.find(w => w.tag === DELTA_BASE_TAG);

    expect(leftLeg).toBeDefined();
    expect(rightLeg).toBeDefined();
    expect(baseWire).toBeDefined();
  });

  it('creates five wires when a feedline shield is present', () => {
    const params = {
      ...baseParams,
      feedlineShield: {
        bottomZ: 0,
        radius: 0.005,
        segments: 10,
      },
    };
    const wires = buildDeltaLoopWires(params);
    expect(wires).toHaveLength(5);

    const feedBridge = wires.find(w => w.tag === FEED_BRIDGE_TAG);
    const feedlineShield = wires.find(w => w.tag === FEEDLINE_SHIELD_TAG);

    expect(feedBridge).toBeDefined();
    expect(feedlineShield).toBeDefined();
  });

  it('clamps feedline shield bottom Z to prevent crossing the base wire', () => {
    const params = {
      ...baseParams,
      feedlineShield: {
        bottomZ: -10, // Far below the base wire
        radius: 0.005,
        segments: 10,
      },
    };
    const wires = buildDeltaLoopWires(params);
    const feedlineShield = wires.find(w => w.tag === FEEDLINE_SHIELD_TAG);

    // Height is 10, triangle height is roughly ~6, so bottomZ is roughly ~4
    // The shield end Z should be clamped to bottomZ.
    expect(feedlineShield!.end[2]).toBeGreaterThan(0);
  });
  it('calculates segment counts based on geometry and safe bounds', () => {
    const params = {
      ...baseParams,
      frequency: 28.3, // Higher frequency -> shorter wavelength -> more min segments
      segments: 51,
    };
    const wires = buildDeltaLoopWires(params);

    const leftLeg = wires.find(w => w.tag === LEFT_LEG_TAG);
    const baseWire = wires.find(w => w.tag === DELTA_BASE_TAG);

    // It should have reasonable segment counts that are > 0
    expect(leftLeg!.segments).toBeGreaterThan(0);
    expect(baseWire!.segments).toBeGreaterThan(0);
    // Base segments should be odd
    expect(baseWire!.segments % 2).toBe(1);
  });
it('caps segments per leg to max and ensures minimum', () => {
    // Force a very high segments value to test MAX_SEGS_PER_LEG
    const paramsMax = {
      ...baseParams,
      frequency: 28.3,
      segments: 5000,
    };
    const wiresMax = buildDeltaLoopWires(paramsMax);
    const leftLegMax = wiresMax.find(w => w.tag === LEFT_LEG_TAG);
    const baseWireMax = wiresMax.find(w => w.tag === DELTA_BASE_TAG);

    // MAX_SEGS_PER_LEG is 100, but base segments rounds up to odd, so could be 101
    expect(leftLegMax!.segments).toBeLessThanOrEqual(MAX_SEGS_PER_LEG + 1);
    expect(baseWireMax!.segments).toBeLessThanOrEqual(MAX_SEGS_PER_LEG + 1);

    // Force a very low segments value to test MIN_SEGS_PER_LEG
    const paramsMin = {
      ...baseParams,
      frequency: 1.8,
      segments: 1,
    };
    const wiresMin = buildDeltaLoopWires(paramsMin);
    const leftLegMin = wiresMin.find(w => w.tag === LEFT_LEG_TAG);
    const baseWireMin = wiresMin.find(w => w.tag === DELTA_BASE_TAG);

    expect(leftLegMin!.segments).toBeGreaterThanOrEqual(MIN_SEGS_PER_LEG);
    expect(baseWireMin!.segments).toBeGreaterThanOrEqual(MIN_SEGS_PER_LEG);
  });

  it('handles small segments with odd number calculation for base wire', () => {
    const params = {
      ...baseParams,
      frequency: 14.15,
      segments: 6, // Base segments will be roughly 6 / 3 = 2, so to make it odd it becomes 3
    };
    const wires = buildDeltaLoopWires(params);
    const baseWire = wires.find(w => w.tag === DELTA_BASE_TAG);

    // Check it forces an odd number
    expect(baseWire!.segments % 2).toBe(1);
  });
});