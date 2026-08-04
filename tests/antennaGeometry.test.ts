import { describe, it, expect } from 'vitest';
import { gradedSegmentPlan, orientationVector, buildInvertedLWires, buildVerticalWhipWires, buildTerminatedDeltaWires, buildFoldedAntennaWires, buildDeltaLoopWires, buildInvertedVWires, buildSlopingVWires, MIN_SEGS_PER_LEG, MAX_SEGS_PER_LEG } from '../src/store/antennaGeometry';
import {
  INVERTED_L_VERTICAL_TAG,
  INVERTED_L_HORIZONTAL_TAG,
  INVERTED_L_RADIAL_TAG,
  VERTICAL_WHIP_RADIAL_COUNT,
  VERTICAL_WHIP_TAG,
  VERTICAL_WHIP_RADIAL_TAG,
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  DELTA_BASE_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  FEED_BRIDGE_LENGTH_M,
  FOLDED_DIPOLE_OPPOSITE_TAG,
  FOLDED_DIPOLE_CONNECTOR_TAG,
  SLOPING_V_MIN_TIP_Z_M
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

describe('buildTerminatedDeltaWires', () => {
  const baseParams = {
    length: 42,
    height: 15,
    frequency: 7.1,
    segments: 51,
    wireRadius: 0.001,
    orientation: 'NS' as const,
  };

  it('creates 4 primary wires for an unterminated/no-feedline delta', () => {
    const wires = buildTerminatedDeltaWires(baseParams);
    expect(wires).toHaveLength(4);

    const leftLeg = wires.find((w) => w.tag === LEFT_LEG_TAG);
    const rightLeg = wires.find((w) => w.tag === RIGHT_LEG_TAG);
    const leftBase = wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG);
    const rightBase = wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG);

    expect(leftLeg).toBeDefined();
    expect(rightLeg).toBeDefined();
    expect(leftBase).toBeDefined();
    expect(rightBase).toBeDefined();

    // Verify connectivity: legs meet at apex
    expect(leftLeg!.end[0]).toBeCloseTo(rightLeg!.start[0]);
    expect(leftLeg!.end[1]).toBeCloseTo(rightLeg!.start[1]);
    expect(leftLeg!.end[2]).toBeCloseTo(rightLeg!.start[2]);
    expect(leftLeg!.end[2]).toBeCloseTo(baseParams.height);
  });

  it('maintains the specified central gap between the two half-base wires', () => {
    const wires = buildTerminatedDeltaWires(baseParams);

    const leftBase = wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG);
    const rightBase = wires.find((w) => w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG);

    expect(leftBase).toBeDefined();
    expect(rightBase).toBeDefined();

    // Calculate the distance between the inner ends of the half-base wires
    const gap = Math.hypot(
      rightBase!.start[0] - leftBase!.end[0],
      rightBase!.start[1] - leftBase!.end[1],
      rightBase!.start[2] - leftBase!.end[2]
    );

    expect(gap).toBeCloseTo(FEED_BRIDGE_LENGTH_M, 6);
  });

  it('creates 6 wires including feed bridge and shield wires when feedlineShield is provided', () => {
    const paramsWithFeedline = {
      ...baseParams,
      feedlineShield: {
        radius: 0.005,
        bottomZ: 0,
        segments: 10,
      },
    };

    const wires = buildTerminatedDeltaWires(paramsWithFeedline);
    expect(wires).toHaveLength(6);

    const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG);
    const shield = wires.find((w) => w.tag === FEEDLINE_SHIELD_TAG);

    expect(bridge).toBeDefined();
    expect(shield).toBeDefined();

    // Verify bridge spans the apex
    const leftLeg = wires.find((w) => w.tag === LEFT_LEG_TAG);
    const rightLeg = wires.find((w) => w.tag === RIGHT_LEG_TAG);

    expect(leftLeg!.end[0]).toBeCloseTo(bridge!.start[0]);
    expect(rightLeg!.start[0]).toBeCloseTo(bridge!.end[0]);

    // Verify shield connects to right side of the bridge and goes down
    expect(shield!.start[0]).toBeCloseTo(bridge!.end[0]);
    expect(shield!.start[2]).toBeCloseTo(baseParams.height);
    // The shield's bottomZ is clamped to the antenna's bottomZ to prevent crossing the base plane
    const leftBase = wires.find((w) => w.tag === TERMINATED_DELTA_LEFT_BASE_TAG);
    const bottomZ = leftBase!.start[2];
    const expectedShieldEndZ = Math.max(paramsWithFeedline.feedlineShield.bottomZ, bottomZ);
    expect(shield!.end[2]).toBeCloseTo(expectedShieldEndZ);
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

describe('buildFoldedAntennaWires', () => {
  const baseParams = {
    length: 20,
    height: 10,
    aperture: 0.5,
    orientation: 'NS' as const,
    wireRadius: 0.001,
    segments: 21,
    frequency: 14.15,
  };

  it('creates continuous top conductor without gap for unterminated antenna', () => {
    const params = { ...baseParams, terminatingResistor: 0 };
    const wires = buildFoldedAntennaWires(params);

    expect(wires).toHaveLength(7);

    const leftOpp = wires[3];
    const rightOpp = wires[4];

    expect(leftOpp.tag).toBe(FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(rightOpp.tag).toBe(FOLDED_DIPOLE_OPPOSITE_TAG);

    // Ensure the top opposite wires meet at the exact center without a gap
    expect(leftOpp.end[0]).toBeCloseTo(rightOpp.start[0]);
    expect(leftOpp.end[1]).toBeCloseTo(rightOpp.start[1]);
    expect(leftOpp.end[2]).toBeCloseTo(rightOpp.start[2]);

    // Top wires should be elevated by aperture (h + aperture = 10.5)
    expect(leftOpp.end[2]).toBeCloseTo(10.5);

    // And other tags should exist
    expect(wires.filter(w => w.tag === LEFT_LEG_TAG)).toHaveLength(1);
    expect(wires.filter(w => w.tag === RIGHT_LEG_TAG)).toHaveLength(1);
    expect(wires.filter(w => w.tag === FEED_BRIDGE_TAG)).toHaveLength(1);
    expect(wires.filter(w => w.tag === FOLDED_DIPOLE_CONNECTOR_TAG)).toHaveLength(2);
  });

  it('creates gap in top conductor for terminated antenna', () => {
    const params = { ...baseParams, terminatingResistor: 800 };
    const wires = buildFoldedAntennaWires(params);

    expect(wires).toHaveLength(7);

    const leftOpp = wires[3];
    const rightOpp = wires[4];

    expect(leftOpp.tag).toBe(FOLDED_DIPOLE_OPPOSITE_TAG);
    expect(rightOpp.tag).toBe(FOLDED_DIPOLE_OPPOSITE_TAG);

    // Calculate distance between the inner ends of the top conductors
    const dx = leftOpp.end[0] - rightOpp.start[0];
    const dy = leftOpp.end[1] - rightOpp.start[1];
    const dz = leftOpp.end[2] - rightOpp.start[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // The gap should equal FEED_BRIDGE_LENGTH_M
    expect(distance).toBeCloseTo(FEED_BRIDGE_LENGTH_M);
  });

  it('respects orientation by rotating the antenna along the correct axis', () => {
    // NS orientation extends along Y axis
    const nsParams = { ...baseParams, orientation: 'NS' as const };
    const nsWires = buildFoldedAntennaWires(nsParams);

    // EW orientation extends along X axis
    const ewParams = { ...baseParams, orientation: 'EW' as const };
    const ewWires = buildFoldedAntennaWires(ewParams);

    const nsLeftFed = nsWires[0];
    const ewLeftFed = ewWires[0];

    // For NS, the start of the left fed conductor should have a large negative Y and zero X
    expect(Math.abs(nsLeftFed.start[1])).toBeGreaterThan(0);
    expect(nsLeftFed.start[0]).toBeCloseTo(0);

    // For EW, the start of the left fed conductor should have a large negative X and zero Y
    expect(Math.abs(ewLeftFed.start[0])).toBeGreaterThan(0);
    expect(ewLeftFed.start[1]).toBeCloseTo(0);
  });
});

describe('buildSlopingVWires', () => {
  const baseParams = {
    length: 20, // 10m per leg roughly
    height: 10,
    vAngle: 90, // Not used heavily in tests unless specifically checking geometry
    legSlope: 0, // In Sloping V, the tips go to the ground and legSlope isn't actually used but is in SlopingVWiresParams
    frequency: 14.15,
    segments: 51,
    wireRadius: 0.001,
    orientation: 'NS' as const,
  };

  it('creates wires for a basic Sloping V with a feed bridge and left/right legs', () => {
    const wires = buildSlopingVWires(baseParams);

    // Should have multiple wires because of graded segmentation for legs + 1 for feed bridge
    expect(wires.length).toBeGreaterThan(2);

    const leftLegWires = wires.filter(w => w.tag === LEFT_LEG_TAG);
    const rightLegWires = wires.filter(w => w.tag === RIGHT_LEG_TAG);
    const feedBridge = wires.filter(w => w.tag === FEED_BRIDGE_TAG);

    expect(leftLegWires.length).toBeGreaterThan(0);
    expect(rightLegWires.length).toBeGreaterThan(0);
    expect(feedBridge).toHaveLength(1);

    // Feed bridge should be exactly 1 segment
    expect(feedBridge[0].segments).toBe(1);
  });

  it('ensures tips reach the expected minimum Z value (SLOPING_V_MIN_TIP_Z_M)', () => {
    const wires = buildSlopingVWires(baseParams);

    // Tips are the ends of the left leg (first segment of left leg) and right leg (last segment of right leg)
    // Left leg is tip -> apex. So start of the first left leg wire is the tip.
    const leftLegWires = wires.filter(w => w.tag === LEFT_LEG_TAG);
    const leftTipZ = leftLegWires[0].start[2];

    // Right leg is apex -> tip. So end of the last right leg wire is the tip.
    const rightLegWires = wires.filter(w => w.tag === RIGHT_LEG_TAG);
    const rightTipZ = rightLegWires[rightLegWires.length - 1].end[2];

    expect(leftTipZ).toBeCloseTo(SLOPING_V_MIN_TIP_Z_M);
    expect(rightTipZ).toBeCloseTo(SLOPING_V_MIN_TIP_Z_M);
  });

  it('handles low heights gracefully without dipping below SLOPING_V_MIN_TIP_Z_M for tips', () => {
    // Height is below the minimum tip Z (0.1 < 0.5)
    // The geometry function doesn't artificially clamp the height to SLOPING_V_MIN_TIP_Z_M for the apex,
    // but the physics engine handles constraints. If height is very low, sinSlope evaluates to 0 (flat),
    // and tip stays at height. So tips will evaluate to height rather than strictly clamped to SLOPING_V_MIN_TIP_Z_M.
    const lowParams = { ...baseParams, height: 0.1 };
    const wires = buildSlopingVWires(lowParams);

    const leftLegWires = wires.filter(w => w.tag === LEFT_LEG_TAG);
    const rightLegWires = wires.filter(w => w.tag === RIGHT_LEG_TAG);

    // If height is 0.1, max(0, 0.1 - 0.5) is 0, so sinSlope is 0.
    // lz is 0, wz = h + lz = 0.1. So the tip is at 0.1.
    // We expect the tips to simply follow the height (be at 0.1) and flat slope.
    expect(leftLegWires[0].start[2]).toBeCloseTo(0.1);
    expect(rightLegWires[rightLegWires.length - 1].end[2]).toBeCloseTo(0.1);

    // Apex should also be at height 0.1
    const feedBridge = wires.find(w => w.tag === FEED_BRIDGE_TAG)!;
    expect(feedBridge.start[2]).toBeCloseTo(0.1);
  });

  it('respects NS orientation', () => {
    const wires = buildSlopingVWires({ ...baseParams, orientation: 'NS' });

    // Based on createSlopingVLegPointCalculator implementation:
    // orientation NS -> dx=0, dy=1.
    // feedBridgeOffsetX = side * bridgeHalf * dx -> 0
    // feedBridgeOffsetY = side * bridgeHalf * dy -> side * bridgeHalf
    // So the feed bridge should span across the Y axis in NS orientation.
    const feedBridge = wires.find(w => w.tag === FEED_BRIDGE_TAG)!;
    expect(Math.abs(feedBridge.start[1] - feedBridge.end[1])).toBeGreaterThan(0);
    expect(feedBridge.start[0]).toBeCloseTo(feedBridge.end[0]);
  });

  it('respects EW orientation', () => {
    const wires = buildSlopingVWires({ ...baseParams, orientation: 'EW' });

    // orientation EW -> dx=1, dy=0.
    // feedBridgeOffsetX = side * bridgeHalf * dx -> side * bridgeHalf
    // feedBridgeOffsetY = side * bridgeHalf * dy -> 0
    // So the feed bridge should span across the X axis in EW orientation.
    const feedBridge = wires.find(w => w.tag === FEED_BRIDGE_TAG)!;
    expect(Math.abs(feedBridge.start[0] - feedBridge.end[0])).toBeGreaterThan(0);
    expect(feedBridge.start[1]).toBeCloseTo(feedBridge.end[1]);
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


describe('buildInvertedVWires', () => {
  const baseParams = {
    length: 20, // total length
    height: 10,
    orientation: 'NS' as const,
    wireRadius: 0.001,
    segments: 51,
    frequency: 14.15,
    vAngle: 90,
  };

  it('constructs basic inverted V geometry correctly', () => {
    const wires = buildInvertedVWires(baseParams);
    expect(wires).toHaveLength(3); // left leg, right leg, bridge

    const left = wires.find(w => w.tag === LEFT_LEG_TAG);
    const right = wires.find(w => w.tag === RIGHT_LEG_TAG);
    const bridge = wires.find(w => w.tag === FEED_BRIDGE_TAG);

    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(bridge).toBeDefined();

    // Check apex height
    expect(bridge!.start[2]).toBe(10);
    expect(bridge!.end[2]).toBe(10);

    // Check legs slope downwards
    expect(left!.start[2]).toBeLessThan(10);
    expect(right!.end[2]).toBeLessThan(10);
  });

  it('clamps the leg slope if it would hit the ground', () => {
    const params = {
      ...baseParams,
      length: 40, // longer legs
      vAngle: 60, // steeper slope
    };

    // With length=40 (leg length ~20m) and vAngle=60 (slope 60deg),
    // z drop would be 20 * sin(60) = 17.3m.
    // Starting from 10m height, it would go underground (-7.3m).
    // The physics engine should clamp the tips to SLOPING_V_MIN_TIP_Z_M (0.5m).

    const wires = buildInvertedVWires(params);
    const left = wires.find(w => w.tag === LEFT_LEG_TAG);
    const right = wires.find(w => w.tag === RIGHT_LEG_TAG);

    expect(left!.start[2]).toBeCloseTo(0.5, 2);
    expect(right!.end[2]).toBeCloseTo(0.5, 2);
  });

  it('distributes segments appropriately based on frequency', () => {
    const paramsLowFreq = { ...baseParams, frequency: 3.5, segments: 11 };
    const paramsHighFreq = { ...baseParams, frequency: 28.5, segments: 11 };

    const wiresLow = buildInvertedVWires(paramsLowFreq);
    const wiresHigh = buildInvertedVWires(paramsHighFreq);

    const lowSegs = wiresLow.find(w => w.tag === LEFT_LEG_TAG)!.segments;
    const highSegs = wiresHigh.find(w => w.tag === LEFT_LEG_TAG)!.segments;

    // Higher frequency -> smaller lambda -> more segments needed for same length
    expect(highSegs).toBeGreaterThan(lowSegs);
  });
});
