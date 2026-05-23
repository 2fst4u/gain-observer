import {
  SLOPING_V_MIN_TIP_Z_M,
  wavelengthMeters,
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  FEED_BRIDGE_TAG,
  FEED_BRIDGE_LENGTH_M,
  DELTA_BASE_TAG,
  FEEDLINE_SHIELD_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  TERMINATED_DELTA_CENTRE_GAP_M,
  VERTICAL_WHIP_TAG,
  VERTICAL_WHIP_BASE_GAP_M,
} from '../physics/constants';
import type { Wire } from '../physics/types';

/** Minimum number of NEC segments per wavelength along each V leg. */
export const SEGS_PER_WAVELENGTH = 20;

/** Absolute minimum segments per leg/side regardless of electrical length. */
export const MIN_SEGS_PER_LEG = 9;

/**
 * Hard cap on segments per leg to bound NEC runtime for very long or high-frequency
 * antennas. At 100 segments/leg the worst-case per-leg segment length stays
 * above ~0.1λ even for a 5λ leg, which is adequate for pattern accuracy.
 *
 * NOTE: Builders that use tapered/graded segmentation (e.g. `buildSlopingVWires`)
 * derive segment count from segment-length physics rather than this cap, so the
 * cap is bypassed when graded segmentation is in effect.
 */
export const MAX_SEGS_PER_LEG = 100;

/**
 * Plan for tapered (graded) segmentation of a wire connected to a short
 * feed segment. Used to satisfy NEC's adjacent-segment ratio rule: the
 * moment-method solver requires neighbouring segments to differ by no more
 * than ~2× in length, otherwise basis functions can't resolve the rapid
 * current variation at the source.
 */
export interface GradedSegmentPlan {
  /** Lengths of the geometrically-growing prefix segments (short → long). */
  readonly prefixLens: number[];
  /** Length of each uniform tail segment (0 if no tail). */
  readonly tailLen: number;
  /** Number of uniform tail segments (0 if no tail). */
  readonly tailCount: number;
}

/**
 * Builds a graded-segmentation plan for a wire of length `totalLen` where the
 * end adjacent to the source has segments of `startSegLen` that grow by
 * `growthRatio` each step until reaching `maxSegLen`, then continue uniformly.
 *
 * The plan's segment lengths sum to `totalLen` (within float precision). The
 * uniform tail length is distributed evenly so the boundary ratio between the
 * last graded segment and the first tail segment stays close to `growthRatio`.
 */
export function gradedSegmentPlan(
  totalLen: number,
  startSegLen: number,
  maxSegLen: number,
  growthRatio: number = 2,
): GradedSegmentPlan {
  if (totalLen <= 0) return { prefixLens: [], tailLen: 0, tailCount: 0 };

  const prefixLens: number[] = [];
  let accum = 0;
  let cur = Math.max(startSegLen, 1e-9);
  while (cur < maxSegLen && accum + cur < totalLen) {
    prefixLens.push(cur);
    accum += cur;
    cur *= growthRatio;
  }

  const remaining = totalLen - accum;
  if (remaining < 1e-9) {
    return { prefixLens, tailLen: 0, tailCount: 0 };
  }
  const tailCount = Math.max(1, Math.round(remaining / Math.max(maxSegLen, 1e-9)));
  const tailLen = remaining / tailCount;
  return { prefixLens, tailLen, tailCount };
}

export type OrientationPreset = 'EW' | 'NS' | 'NE-SW' | 'NW-SE';
export type Orientation = OrientationPreset | number;

/**
 * Helper to build a unit-vector along the chosen dipole orientation in the XY plane.
 */
export function orientationVector(o: Orientation): [number, number] {
  let deg = 0;
  if (typeof o === 'number') {
    deg = o;
  } else {
    switch (o) {
      case 'NS': deg = 0; break;
      case 'EW': deg = 90; break;
      case 'NE-SW': deg = 45; break;
      case 'NW-SE': deg = 315; break;
    }
  }

  const rad = ((90 - deg) * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

export interface InvertedVWiresParams {
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  vAngle: number;
}

/**
 * Builds the wires for an Inverted V antenna.
 */
export function buildInvertedVWires(params: InvertedVWiresParams): Wire[] {
  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);
  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  const slopeDeg = (180 - params.vAngle) / 2;

  // Total radiating length is params.length. Each leg is (params.length - bridge) / 2.
  const legLen = Math.max(0.1, (params.length - FEED_BRIDGE_LENGTH_M) / 2);

  const maxSin = legLen > 0 ? (h - SLOPING_V_MIN_TIP_Z_M) / legLen : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const requestedSlopeRad = (slopeDeg * Math.PI) / 180;
  const effectiveSlopeRad = Math.min(requestedSlopeRad, maxSlopeRad);

  const cosS = Math.cos(effectiveSlopeRad);
  const sinS = Math.sin(effectiveSlopeRad);

  function legPointAt(axis: number, side: number): [number, number, number] {
    // axis is distance along the sloping leg starting from the apex bridge connection.
    const lx = (bridgeHalf + axis * cosS) * side;
    const lz = -axis * sinS;

    const wx = dx * lx;
    const wy = dy * lx;
    const wz = h + lz;

    return [cleanZero(wx), cleanZero(wy), cleanZero(wz)];
  }

  const lambda = wavelengthMeters(params.frequency);
  const minSegPerLeg = Math.ceil((SEGS_PER_WAVELENGTH * legLen) / lambda);
  const segmentsPerLeg = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minSegPerLeg, Math.round(params.segments / 2)),
  );

  const apexLeft = legPointAt(0, -1);
  const apexRight = legPointAt(0, 1);

  return [
    {
      start: legPointAt(legLen, -1),
      end: apexLeft,
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: apexRight,
      end: legPointAt(legLen, 1),
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_RIGHT_TAG,
    },
    {
      start: apexLeft,
      end: apexRight,
      radius: params.wireRadius,
      segments: 1,
      tag: FEED_BRIDGE_TAG,
    },
  ];
}

export interface SlopingVWiresParams {
  length: number; // total length (both legs + bridge)
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  vAngle: number;
  legSlope: number;
}

/**
 * Builds the wires for a Sloping V or V-Beam antenna.
 *
 * The sloping V's leg slope is **not user-configurable**: it is always set so
 * the tips rest at the ground floor (`SLOPING_V_MIN_TIP_Z_M`). The `legSlope`
 * field on the input is therefore ignored and retained only for state shape
 * compatibility.
 *
 * Each leg uses **graded (tapered) segmentation**: the segment adjacent to the
 * apex matches the feed-bridge length, growing geometrically (×2 per step) up
 * to ~λ/SEGS_PER_WAVELENGTH, then continuing uniformly to the tip. This
 * satisfies NEC's adjacent-segment ratio rule at the source — uniform leg
 * segments on a multi-wavelength leg would be 10×–20× longer than the 0.1 m
 * bridge, which corrupts the moment-method solver's feedpoint impedance.
 *
 * A leg is emitted as one Wire per graded prefix segment plus one
 * multi-segment Wire covering the uniform tail. All sub-wires of a given leg
 * share the same tag (DIPOLE_LEFT_TAG / DIPOLE_RIGHT_TAG) so that current-
 * ripple and load diagnostics continue to group by leg correctly.
 *
 * Convention:
 *   LEFT leg  is emitted tip → apex (first Wire returned for the tag is the
 *             tail-end at the tip; its `.start` is the tip).
 *   RIGHT leg is emitted apex → tip (last Wire returned for the tag is the
 *             tail-end at the tip; its `.end` is the tip).
 */
export function buildSlopingVWires(params: SlopingVWiresParams): Wire[] {
  const h = params.height;
  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;

  // Tips always at the ground floor: slope = arcsin((h − tipMinZ) / legLen).
  // Total radiating length is params.length. Each leg is (params.length - bridge) / 2.
  const legLen = Math.max(0.1, (params.length - FEED_BRIDGE_LENGTH_M) / 2);
  const sinSlope = legLen > 0 ? Math.max(0, h - SLOPING_V_MIN_TIP_Z_M) / legLen : 0;
  const effectiveSlopeRad = Math.asin(Math.min(1, sinSlope));

  const [dx, dy] = orientationVector(params.orientation);
  const [px, py] = [-dy, dx];

  const halfV = ((params.vAngle / 2) * Math.PI) / 180;
  const cosS = Math.cos(effectiveSlopeRad);
  const sinS = Math.sin(effectiveSlopeRad);
  const cosV = Math.cos(halfV);
  const sinV = Math.sin(halfV);

  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  function legPointAt(axis: number, side: number): [number, number, number] {
    // axis is distance along the sloping leg starting from the apex.
    // At axis=0, we are at the apex connection point.
    const horizontalDistFromApex = axis * cosS;
    const lz = -axis * sinS;

    const la = horizontalDistFromApex * cosV;
    const lp = horizontalDistFromApex * sinV * side;

    // Offset the entire leg by the bridge half-width.
    // We assume the bridge is aligned with the orientation vector (dx, dy).
    const bridgeOffsetX = side * bridgeHalf * dx;
    const bridgeOffsetY = side * bridgeHalf * dy;

    const wx = dx * la + px * lp + bridgeOffsetX;
    const wy = dy * la + py * lp + bridgeOffsetY;
    const wz = h + lz;

    return [cleanZero(wx), cleanZero(wy), cleanZero(wz)];
  }

  const lambda = wavelengthMeters(params.frequency);
  const maxSegLen = lambda / SEGS_PER_WAVELENGTH;
  const plan = gradedSegmentPlan(legLen, FEED_BRIDGE_LENGTH_M, maxSegLen);

  // Axis positions (distance from apex) at every segment boundary along a leg.
  // `breakpoints[0] = 0` (apex), `breakpoints[K] = prefix end`, then a final
  // `legLen` (tip) at the end of the tail wire.
  const breakpoints: number[] = [0];
  let pos = 0;
  for (const pl of plan.prefixLens) {
    pos += pl;
    breakpoints.push(pos);
  }
  const prefixEnd = pos;

  // Enforce a floor on total segments for very short legs (NEC needs enough
  // basis functions to represent currents). When the natural graded plan
  // gives too few segments, pad the tail count — NEC distributes them evenly
  // along the tail wire's length.
  let tailCount = plan.tailCount;
  const naturalTotal = plan.prefixLens.length + tailCount;
  if (naturalTotal < MIN_SEGS_PER_LEG && legLen > prefixEnd + 1e-9) {
    tailCount = Math.max(1, MIN_SEGS_PER_LEG - plan.prefixLens.length);
  }

  const apexLeft = legPointAt(0, -1);
  const apexRight = legPointAt(0, 1);

  const wires: Wire[] = [];

  // LEFT leg: emit tip → apex.
  // (1) Uniform tail wire from tip back to the end of the prefix.
  if (tailCount > 0) {
    wires.push({
      start: legPointAt(legLen, -1),
      end: legPointAt(prefixEnd, -1),
      radius: params.wireRadius,
      segments: tailCount,
      tag: DIPOLE_LEFT_TAG,
    });
  }
  // (2) Graded prefix wires in reverse (largest to smallest, toward apex).
  for (let i = plan.prefixLens.length - 1; i >= 0; i--) {
    wires.push({
      start: legPointAt(breakpoints[i + 1]!, -1),
      end: legPointAt(breakpoints[i]!, -1),
      radius: params.wireRadius,
      segments: 1,
      tag: DIPOLE_LEFT_TAG,
    });
  }

  // RIGHT leg: emit apex → tip.
  // (1) Graded prefix wires in natural order (smallest to largest, away from apex).
  for (let i = 0; i < plan.prefixLens.length; i++) {
    wires.push({
      start: legPointAt(breakpoints[i]!, 1),
      end: legPointAt(breakpoints[i + 1]!, 1),
      radius: params.wireRadius,
      segments: 1,
      tag: DIPOLE_RIGHT_TAG,
    });
  }
  // (2) Uniform tail wire from end of prefix out to tip.
  if (tailCount > 0) {
    wires.push({
      start: legPointAt(prefixEnd, 1),
      end: legPointAt(legLen, 1),
      radius: params.wireRadius,
      segments: tailCount,
      tag: DIPOLE_RIGHT_TAG,
    });
  }

  // Apex feed bridge.
  wires.push({
    start: apexLeft,
    end: apexRight,
    radius: params.wireRadius,
    segments: 1,
    tag: FEED_BRIDGE_TAG,
  });

  return wires;
}

export interface FeedlineShield {
  readonly bottomZ: number;
  readonly radius: number;
  readonly segments: number;
}

export interface DeltaLoopWiresParams {
  length: number; // perimeter
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  feedlineShield?: FeedlineShield | null;
}

/**
 * Builds the wires for a Delta Loop antenna (apex-up, apex-fed).
 *
 * Produces an isosceles triangle whose perimeter always equals params.length.
 * When the equilateral triangle height fits within the mast height, the result
 * is equilateral. When the mast is too short the triangle is flattened while
 * preserving the full perimeter.
 *
 * Tags:
 *   DIPOLE_LEFT_TAG  (1) — left leg:  leftCorner → apex
 *   DIPOLE_RIGHT_TAG (2) — right leg: apex → rightCorner
 *   DELTA_BASE_TAG   (6) — base wire: leftCorner → rightCorner
 *
 * Excitation is placed on the last segment of DIPOLE_LEFT_TAG (the apex end).
 */
export function buildDeltaLoopWires(params: DeltaLoopWiresParams): Wire[] {
  const perimeter = params.length;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);

  // Maximum available triangle height given the mast height.
  const equilateralHeight = (perimeter * Math.sqrt(3)) / 6;
  const maxAvailable = Math.max(0, h - SLOPING_V_MIN_TIP_Z_M);
  const triHeight = Math.min(equilateralHeight, maxAvailable);

  const bottomZ = h - triHeight;

  // Isosceles triangle with fixed perimeter P and height t:
  //   leg  = t²/P + P/4
  //   base = P − 2·leg  →  halfBase = P/4 − t²/P
  const legLength = (triHeight * triHeight) / perimeter + perimeter / 4;
  const halfBase = perimeter / 4 - (triHeight * triHeight) / perimeter;

  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;
  const apex: [number, number, number] = [0, 0, h];

  // When a feedline is active we split the apex with a source bridge so the
  // TL card can connect to it, just like the dipole topology.
  const apexLeft: [number, number, number] = params.feedlineShield
    ? [-bridgeHalf * dx, -bridgeHalf * dy, h]
    : apex;
  const apexRight: [number, number, number] = params.feedlineShield
    ? [bridgeHalf * dx, bridgeHalf * dy, h]
    : apex;

  const leftCorner: [number, number, number] = [-halfBase * dx, -halfBase * dy, bottomZ];
  const rightCorner: [number, number, number] = [halfBase * dx, halfBase * dy, bottomZ];

  const lambda = wavelengthMeters(params.frequency);

  const minLegSegs = Math.ceil((SEGS_PER_WAVELENGTH * legLength) / lambda);
  const segmentsPerLeg = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minLegSegs, Math.round(params.segments / 3)),
  );

  const baseLength = halfBase * 2;
  const minBaseSegs = Math.ceil((SEGS_PER_WAVELENGTH * baseLength) / lambda);
  const rawBaseSegs = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minBaseSegs, Math.round(params.segments / 3)),
  );
  const baseSegments = rawBaseSegs % 2 === 0 ? rawBaseSegs + 1 : rawBaseSegs;

  const wires: Wire[] = [
    {
      start: leftCorner,
      end: apexLeft,
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: apexRight,
      end: rightCorner,
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_RIGHT_TAG,
    },
    {
      start: leftCorner,
      end: rightCorner,
      radius: params.wireRadius,
      segments: baseSegments,
      tag: DELTA_BASE_TAG,
    },
  ];

  if (params.feedlineShield) {
    wires.push({
      start: apexLeft,
      end: apexRight,
      radius: params.wireRadius,
      segments: 1,
      tag: FEED_BRIDGE_TAG,
    });
    // Clamp the shield bottom to be at or above the base wire (z = bottomZ) so
    // the shield never crosses the base wire plane. When it does cross, the NEC
    // impedance matrix becomes ill-conditioned: the excitation segment midpoint
    // ends up on the opposite side of the nearby base wire, corrupting mutual-
    // coupling integrals and producing -999.99 sentinel gains / negative R.
    const shieldEndZ = Math.max(params.feedlineShield.bottomZ, bottomZ);
    wires.push({
      start: apexRight,
      end: [apexRight[0], apexRight[1], shieldEndZ],
      radius: params.feedlineShield.radius,
      segments: params.feedlineShield.segments,
      tag: FEEDLINE_SHIELD_TAG,
    });
  }

  return wires;
}

export interface TerminatedDeltaWiresParams {
  length: number; // perimeter
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  feedlineShield?: FeedlineShield | null;
}

/**
 * Builds the wires for a Terminated Delta antenna (apex-up, apex-fed).
 *
 * Geometry is identical to the Delta Loop's isosceles triangle: same
 * perimeter-preserving leg/base math, same equilateral-when-possible
 * shape, same apex feed convention. The only structural difference is
 * that the base is **split in the middle** into two independent
 * half-base wires separated by `TERMINATED_DELTA_CENTRE_GAP_M`. Each
 * half-base ends near the centre and the termination network (vertical
 * stub + LD-4 resistor) is added in selectSimulationInput when the user
 * specifies a non-zero terminating resistance — mirroring the
 * physically-correct sloping-V tip-to-earth shunt termination.
 *
 * Tags:
 *   DIPOLE_LEFT_TAG               (1)  — top-left leg:  leftCorner → apex
 *   DIPOLE_RIGHT_TAG              (2)  — top-right leg: apex → rightCorner
 *   TERMINATED_DELTA_LEFT_BASE_TAG  (9)  — left half-base:  leftCorner → centreLeft
 *   TERMINATED_DELTA_RIGHT_BASE_TAG (10) — right half-base: centreRight → rightCorner
 *
 * Excitation is placed on the last segment of DIPOLE_LEFT_TAG (the apex
 * end), or on the feed bridge / shield when a feedline is active —
 * exactly as for the delta loop.
 */
export function buildTerminatedDeltaWires(params: TerminatedDeltaWiresParams): Wire[] {
  const perimeter = params.length;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);

  // Maximum available triangle height given the mast height.
  // Identical to the delta loop's geometry math so that the two
  // antennas occupy the same physical envelope for the same length.
  const equilateralHeight = (perimeter * Math.sqrt(3)) / 6;
  const maxAvailable = Math.max(0, h - SLOPING_V_MIN_TIP_Z_M);
  const triHeight = Math.min(equilateralHeight, maxAvailable);

  const bottomZ = h - triHeight;

  // Isosceles triangle with fixed perimeter P and height t:
  //   leg  = t²/P + P/4
  //   base = P − 2·leg  →  halfBase = P/4 − t²/P
  const legLength = (triHeight * triHeight) / perimeter + perimeter / 4;
  const halfBase = perimeter / 4 - (triHeight * triHeight) / perimeter;

  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;
  const apex: [number, number, number] = [0, 0, h];

  // When a feedline is active we split the apex with a source bridge so
  // the TL card can connect to it, just like the delta loop topology.
  const apexLeft: [number, number, number] = params.feedlineShield
    ? [-bridgeHalf * dx, -bridgeHalf * dy, h]
    : apex;
  const apexRight: [number, number, number] = params.feedlineShield
    ? [bridgeHalf * dx, bridgeHalf * dy, h]
    : apex;

  const leftCorner: [number, number, number] = [-halfBase * dx, -halfBase * dy, bottomZ];
  const rightCorner: [number, number, number] = [halfBase * dx, halfBase * dy, bottomZ];

  // Inner ends of the two half-base wires. They sit slightly to the left
  // and right of the geometric centre with a gap of TERMINATED_DELTA_CENTRE_GAP_M
  // between them — the gap is electrically open in the unterminated case
  // and is bridged by the stub+resistor pair to ground when terminated.
  const innerOffset = Math.max(0, TERMINATED_DELTA_CENTRE_GAP_M / 2);
  const innerHalfBase = Math.max(0.01, halfBase - innerOffset);
  const centreLeft: [number, number, number] = [-innerOffset * dx, -innerOffset * dy, bottomZ];
  const centreRight: [number, number, number] = [innerOffset * dx, innerOffset * dy, bottomZ];

  const lambda = wavelengthMeters(params.frequency);

  const minLegSegs = Math.ceil((SEGS_PER_WAVELENGTH * legLength) / lambda);
  const segmentsPerLeg = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minLegSegs, Math.round(params.segments / 3)),
  );

  const minHalfBaseSegs = Math.ceil((SEGS_PER_WAVELENGTH * innerHalfBase) / lambda);
  const halfBaseSegments = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minHalfBaseSegs, Math.round(params.segments / 6)),
  );

  // Half-base wires are oriented so that the segment adjacent to the
  // termination is the LAST segment of the wire — analogous to the way
  // the delta loop's left leg is oriented so its last segment is at the
  // apex feed. This gives the termination diagnostics a consistent
  // "current at the loaded end" interpretation.
  //   LEFT  half-base:  leftCorner  → centreLeft   (last seg = inner end)
  //   RIGHT half-base:  centreRight → rightCorner  (first seg = inner end)
  // We keep the right-leg ordering "outward" for symmetry with the
  // delta-loop's right-leg convention (apex → rightCorner).
  const wires: Wire[] = [
    {
      start: leftCorner,
      end: apexLeft,
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: apexRight,
      end: rightCorner,
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_RIGHT_TAG,
    },
    {
      start: leftCorner,
      end: centreLeft,
      radius: params.wireRadius,
      segments: halfBaseSegments,
      tag: TERMINATED_DELTA_LEFT_BASE_TAG,
    },
    {
      start: centreRight,
      end: rightCorner,
      radius: params.wireRadius,
      segments: halfBaseSegments,
      tag: TERMINATED_DELTA_RIGHT_BASE_TAG,
    },
  ];

  if (params.feedlineShield) {
    wires.push({
      start: apexLeft,
      end: apexRight,
      radius: params.wireRadius,
      segments: 1,
      tag: FEED_BRIDGE_TAG,
    });
    // Same base-wire crossing guard as buildDeltaLoopWires: clamp shield end
    // to bottomZ so the shield never crosses the base wire plane.
    const shieldEndZ = Math.max(params.feedlineShield.bottomZ, bottomZ);
    wires.push({
      start: apexRight,
      end: [apexRight[0], apexRight[1], shieldEndZ],
      radius: params.feedlineShield.radius,
      segments: params.feedlineShield.segments,
      tag: FEEDLINE_SHIELD_TAG,
    });
  }

  return wires;
}

export interface VerticalWhipWiresParams {
  /** Whip length, metres (the radiating wire length). */
  length: number;
  /** Base height above ground, metres. 0 means ground-mounted. */
  height: number;
  wireRadius: number;
  segments: number;
  frequency: number;
}

/**
 * Builds the wires for a vertical whip (monopole) antenna.
 *
 * Geometry is a single vertical wire from (0, 0, baseZ) up to
 * (0, 0, baseZ + length). The wire is fed at its base — the first segment
 * is at the bottom, so excitation goes on segment 1 in
 * selectSimulationInput.
 *
 * When the user requests a ground-mounted whip (height = 0) the base is
 * lifted by VERTICAL_WHIP_BASE_GAP_M (1 cm) so the wire does not touch
 * z = 0 — NEC's Sommerfeld-Norton ground model is undefined for wires
 * intersecting the ground plane. The cm-scale offset is well below the
 * accuracy envelope of the model at HF.
 *
 * Segment count is sized to give at least SEGS_PER_WAVELENGTH segments per
 * wavelength of whip, with the same MIN/MAX bounds used by the other
 * builders, so that long whips at high frequencies still resolve the
 * standing-wave structure correctly.
 */
export function buildVerticalWhipWires(params: VerticalWhipWiresParams): Wire[] {
  const length = Math.max(0.1, params.length);
  const baseZ = Math.max(VERTICAL_WHIP_BASE_GAP_M, params.height);
  const topZ = baseZ + length;

  const lambda = wavelengthMeters(params.frequency);
  const minSegs = Math.ceil((SEGS_PER_WAVELENGTH * length) / lambda);
  const segments = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minSegs, params.segments),
  );

  return [
    {
      start: [0, 0, baseZ],
      end: [0, 0, topZ],
      radius: params.wireRadius,
      segments,
      tag: VERTICAL_WHIP_TAG,
    },
  ];
}
