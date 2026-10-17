import { cleanZero } from "../utils/math";
import { SLOPING_V_MIN_TIP_Z_M, wavelengthMeters, FEED_BRIDGE_LENGTH_M, VERTICAL_WHIP_BASE_GAP_M, VERTICAL_WHIP_RADIAL_COUNT, findFeedlinePreset, FOLDED_DIPOLE_DEFAULT_APERTURE_M, SLOPING_V_COUNTERPOISE_RADIALS, SLOPING_V_COUNTERPOISE_LENGTH_WL, slopingVTerminationHubZ } from '../physics/constants';
import type { Wire, AntennaType, SegmentLoad } from '../physics/types';
import { MAIN_WIRE_TAG, LEFT_LEG_TAG, RIGHT_LEG_TAG, FEED_BRIDGE_TAG, DELTA_BASE_TAG, FEEDLINE_SHIELD_TAG, TERMINATED_DELTA_LEFT_BASE_TAG, TERMINATED_DELTA_RIGHT_BASE_TAG, TERMINATED_DELTA_BRIDGE_TAG, VERTICAL_WHIP_TAG, VERTICAL_WHIP_RADIAL_TAG, INVERTED_L_VERTICAL_TAG, INVERTED_L_HORIZONTAL_TAG, INVERTED_L_RADIAL_TAG, FOLDED_DIPOLE_OPPOSITE_TAG, FOLDED_DIPOLE_CONNECTOR_TAG, FOLDED_DIPOLE_TERM_BRIDGE_TAG, SLOPING_V_LEFT_STUB_TAG, SLOPING_V_RIGHT_STUB_TAG, SLOPING_V_LEFT_COUNTERPOISE_TAG, SLOPING_V_RIGHT_COUNTERPOISE_TAG } from '../physics/tags';

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
interface GradedSegmentPlan {
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

function calcInvertedVPoints(
  orientation: Orientation,
  h: number,
  vAngle: number,
  length: number,
) {
  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;
  const [dx, dy] = orientationVector(orientation);
  const slopeDeg = (180 - vAngle) / 2;

  // Total radiating length is length. Each leg is (length - bridge) / 2.
  const legLen = Math.max(0.1, (length - FEED_BRIDGE_LENGTH_M) / 2);

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

  return {
    legLen,
    legPointAt,
    apexLeft: legPointAt(0, -1),
    apexRight: legPointAt(0, 1),
    tipLeft: legPointAt(legLen, -1),
    tipRight: legPointAt(legLen, 1),
  };
}

/**
 * Builds the wires for an Inverted V antenna.
 */
export function buildInvertedVWires(params: InvertedVWiresParams): Wire[] {
  const { legLen, legPointAt, apexLeft, apexRight } = calcInvertedVPoints(
    params.orientation,
    params.height,
    params.vAngle,
    params.length
  );

  const lambda = wavelengthMeters(params.frequency);
  const minSegPerLeg = Math.ceil((SEGS_PER_WAVELENGTH * legLen) / lambda);
  const segmentsPerLeg = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minSegPerLeg, Math.round(params.segments / 2)),
  );

  // Grade the segment length up from the feed bridge, exactly as the sloping
  // V does. A uniform leg puts a ~λ/20 segment hard against the 0.1 m bridge
  // segment carrying the source, and NEC-2's thin-wire kernel needs adjacent
  // segments within about 2:1 of each other. At the ~20:1 this produced, the
  // solved current at the source is wrong enough to mis-normalise the whole
  // pattern: the deck failed NEC's average-gain test by +0.97 dB, i.e. it
  // radiated 125 % of the power put into it. See §14 of `antenna-spec.md`.
  //
  // `segmentsPerLeg` still sets the density over the bulk of the leg, so the
  // segment-count control keeps working; grading only refines the few
  // segments nearest the feed.
  const maxSegLen = legLen / segmentsPerLeg;
  const plan = gradedSegmentPlan(legLen, FEED_BRIDGE_LENGTH_M, maxSegLen);
  const { breakpoints, prefixEnd, tailCount } = resolveGradedSegmentBreakpoints(plan, legLen);

  const wires: Wire[] = [];

  // LEFT leg: emit tip → apex, so the last segment is at the feed.
  wires.push(...buildGradedLegWires({
    legLen,
    prefixEnd,
    breakpoints,
    prefixLens: plan.prefixLens,
    tailCount,
    wireRadius: params.wireRadius,
    tag: LEFT_LEG_TAG,
    side: -1,
    legPointAt,
    reverse: true,
  }));

  // RIGHT leg: emit apex → tip.
  wires.push(...buildGradedLegWires({
    legLen,
    prefixEnd,
    breakpoints,
    prefixLens: plan.prefixLens,
    tailCount,
    wireRadius: params.wireRadius,
    tag: RIGHT_LEG_TAG,
    side: 1,
    legPointAt,
    reverse: false,
  }));

  wires.push({
    start: apexLeft,
    end: apexRight,
    radius: params.wireRadius,
    segments: 1,
    tag: FEED_BRIDGE_TAG,
  });

  return wires;
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
 * Builds the wires for a Sloping V antenna.
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
 * share the same tag (LEFT_LEG_TAG / RIGHT_LEG_TAG) so that current-
 * ripple and load diagnostics continue to group by leg correctly.
 *
 * Convention:
 *   LEFT leg  is emitted tip → apex (first Wire returned for the tag is the
 *             tail-end at the tip; its `.start` is the tip).
 *   RIGHT leg is emitted apex → tip (last Wire returned for the tag is the
 *             tail-end at the tip; its `.end` is the tip).
 */

/**
 * How far back along its own leg each sloping-V leg end is set from the
 * geometric apex, leaving the feed gap between the two ends.
 *
 * The two legs diverge at vAngle, so to leave a gap of FEED_BRIDGE_LENGTH_M
 * between their ends each must be cut back by (bridge/2)/sin(vAngle/2). That
 * is what the real antenna looks like: a narrow V has to be trimmed a long
 * way back to open a hand-sized gap at the apex, an opposed one (vAngle 180,
 * where this *is* an inverted V) only half a bridge.
 *
 * Holding the gap constant rather than the setback measurably beats the
 * simpler alternative. Against the solver's average-gain test over perfect
 * ground, by vAngle:
 *
 *     vAngle          10°     30°     45°     60°    >=90°
 *     constant gap  -0.170  -0.117  -0.088  -0.063   ~0.02
 *     fixed setback -0.313  -0.154  -0.103  -0.070   ~0.02
 *
 * The setback is capped at 5 % of the leg so it cannot eat a short antenna,
 * and floored at half a bridge so it never drops below the opposed-leg case.
 * At the 10° minimum vAngle on a normal HF V the cap is not reached.
 */
export function slopingVFeedSetback(vAngleDeg: number, legLen: number): number {
  const halfV = ((vAngleDeg / 2) * Math.PI) / 180;
  const sinV = Math.sin(halfV);
  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;
  const ideal = sinV > 1e-6 ? bridgeHalf / sinV : Infinity;
  return Math.min(ideal, Math.max(bridgeHalf, legLen * 0.05));
}

/** Resulting gap between the two leg ends — the feed bridge wire's length. */
export function slopingVBridgeLength(vAngleDeg: number, legLen: number): number {
  const halfV = ((vAngleDeg / 2) * Math.PI) / 180;
  return 2 * slopingVFeedSetback(vAngleDeg, legLen) * Math.sin(halfV);
}

/** Leg length implied by a sloping V's total conductor length. */
export function slopingVLegLength(totalLength: number): number {
  return Math.max(0.1, (totalLength - FEED_BRIDGE_LENGTH_M) / 2);
}

function createSlopingVLegPointCalculator(params: SlopingVWiresParams, effectiveSlopeRad: number) {
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);
  const [px, py] = [-dy, dx];

  const halfV = ((params.vAngle / 2) * Math.PI) / 180;
  const setback = slopingVFeedSetback(params.vAngle, slopingVLegLength(params.length));
  const cosS = Math.cos(effectiveSlopeRad);
  const sinS = Math.sin(effectiveSlopeRad);
  const cosV = Math.cos(halfV);
  const sinV = Math.sin(halfV);

  return function legPointAt(axis: number, side: number): [number, number, number] {
    const horizontalDistFromApex = axis * cosS;
    const lz = -axis * sinS;

    const la = horizontalDistFromApex * cosV;
    const lp = horizontalDistFromApex * sinV * side;

    // Set each leg end back along ITS OWN leg, so the feed bridge spans the
    // two ends. The old behaviour offset both ends along the orientation axis
    // instead, which left the bridge at halfV degrees to each leg — fully
    // perpendicular at vAngle = 180, where the two legs became a pair of
    // parallel lines FEED_BRIDGE_LENGTH_M apart rather than one straight
    // wire. At that angle the sloping V *is* an inverted V (same wires, same
    // droop), so the two must agree; they did not. Isolated at matched graded
    // segmentation the perpendicular bridge cost a steady 0.17-0.20 dB of
    // gain and ~160 Ω of reactance at every refinement level, and left the
    // deck failing NEC's average-gain test at ~96 %.
    const legDirX = dx * cosV + px * sinV * side;
    const legDirY = dy * cosV + py * sinV * side;
    const bridgeOffsetX = setback * legDirX;
    const bridgeOffsetY = setback * legDirY;

    const wx = dx * la + px * lp + bridgeOffsetX;
    const wy = dy * la + py * lp + bridgeOffsetY;
    const wz = h + lz;

    return [cleanZero(wx), cleanZero(wy), cleanZero(wz)];
  };
}

function resolveGradedSegmentBreakpoints(plan: GradedSegmentPlan, legLen: number) {
  const breakpoints: number[] = [0];
  let pos = 0;
  const prefixLens = plan.prefixLens;
  const len = prefixLens.length;
  for (let i = 0; i < len; i++) {
    pos += prefixLens[i];
    breakpoints.push(pos);
  }
  const prefixEnd = pos;

  let tailCount = plan.tailCount;
  const naturalTotal = len + tailCount;
  if (naturalTotal < MIN_SEGS_PER_LEG && legLen > prefixEnd + 1e-9) {
    tailCount = Math.max(1, MIN_SEGS_PER_LEG - len);
  }

  return { breakpoints, prefixEnd, tailCount };
}

interface BuildGradedLegWiresOptions {
  legLen: number;
  prefixEnd: number;
  breakpoints: number[];
  prefixLens: number[];
  tailCount: number;
  wireRadius: number;
  tag: number;
  side: number;
  legPointAt: (axis: number, side: number) => [number, number, number];
  reverse: boolean;
}

function buildGradedLegWires({
  legLen,
  prefixEnd,
  breakpoints,
  prefixLens,
  tailCount,
  wireRadius,
  tag,
  side,
  legPointAt,
  reverse,
}: BuildGradedLegWiresOptions): Wire[] {
  const wires: Wire[] = [];

  if (reverse) {
    if (tailCount > 0) {
      wires.push({
        start: legPointAt(legLen, side),
        end: legPointAt(prefixEnd, side),
        radius: wireRadius,
        segments: tailCount,
        tag,
      });
    }
    for (let i = prefixLens.length - 1; i >= 0; i--) {
      wires.push({
        start: legPointAt(breakpoints[i + 1]!, side),
        end: legPointAt(breakpoints[i]!, side),
        radius: wireRadius,
        segments: 1,
        tag,
      });
    }
  } else {
    for (let i = 0; i < prefixLens.length; i++) {
      wires.push({
        start: legPointAt(breakpoints[i]!, side),
        end: legPointAt(breakpoints[i + 1]!, side),
        radius: wireRadius,
        segments: 1,
        tag,
      });
    }
    if (tailCount > 0) {
      wires.push({
        start: legPointAt(prefixEnd, side),
        end: legPointAt(legLen, side),
        radius: wireRadius,
        segments: tailCount,
        tag,
      });
    }
  }

  return wires;
}

interface GradedStraightWireParams {
  bridgeEnd: [number, number, number];
  farEnd: [number, number, number];
  wireRadius: number;
  tag: number;
  maxSegLen: number;
  emitFromFarEnd: boolean;
}

/**
 * Graded segmentation for a straight wire running away from a feed bridge.
 *
 * Same rule as the sloping V's legs, generalised: the segment touching the
 * 1-segment feed bridge must be about the bridge's own length, growing
 * geometrically out to `maxSegLen`. NEC-2's thin-wire kernel assumes adjacent
 * segments are comparable in length — the usual guidance is to stay inside
 * about 2:1 — and a uniform leg butted against the 0.1 m bridge breaks that
 * badly (20:1 at λ/20 on 40 m).
 *
 * The consequence is not a small local error. The solved current at the
 * source segment is wrong, and since NEC normalises the whole radiation
 * pattern by the source's input power, every gain figure in the deck shifts
 * with it. Measured on a split half-wave dipole over perfect ground, where
 * the answer must equal the unsplit 8.43 dBi and the average-gain test must
 * return 1.000:
 *
 *     ratio at bridge   9.7:1   5.1:1   2.6:1   1.3:1   1.0:1
 *     gain error       +1.05   +0.68   +0.35   +0.09   0.00 dB
 *     <G>               127 %   117 %   108 %   102 %    100 %
 *
 * A deck radiating 127 % of the power put into it is not a rounding error,
 * and nothing downstream — gain, efficiency, the gain/directivity split —
 * means anything while it does.
 *
 * `emitFromFarEnd` picks the emission order so callers keep their existing
 * convention for which end of the tag is `.start`.
 */
function buildGradedStraightWires(params: GradedStraightWireParams): Wire[] {
  const { bridgeEnd, farEnd, wireRadius, tag, maxSegLen, emitFromFarEnd } = params;
  const vx = farEnd[0] - bridgeEnd[0];
  const vy = farEnd[1] - bridgeEnd[1];
  const vz = farEnd[2] - bridgeEnd[2];
  const legLen = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (legLen < 1e-9) return [];

  const ux = vx / legLen, uy = vy / legLen, uz = vz / legLen;
  const pointAt = (axis: number): [number, number, number] => [
    cleanZero(bridgeEnd[0] + ux * axis),
    cleanZero(bridgeEnd[1] + uy * axis),
    cleanZero(bridgeEnd[2] + uz * axis),
  ];

  const plan = gradedSegmentPlan(legLen, FEED_BRIDGE_LENGTH_M, Math.max(maxSegLen, FEED_BRIDGE_LENGTH_M));
  const { breakpoints, prefixEnd, tailCount } = resolveGradedSegmentBreakpoints(plan, legLen);

  return buildGradedLegWires({
    legLen,
    prefixEnd,
    breakpoints,
    prefixLens: plan.prefixLens,
    tailCount,
    wireRadius,
    tag,
    side: 1,
    legPointAt: (axis) => pointAt(axis),
    reverse: emitFromFarEnd,
  });
}

export function buildSlopingVWires(params: SlopingVWiresParams): Wire[] {
  const h = params.height;

  // Tips always at the ground floor: slope = arcsin((h − tipMinZ) / legLen).
  // Total radiating length is params.length. Each leg is (params.length - bridge) / 2.
  const legLen = slopingVLegLength(params.length);
  const sinSlope = legLen > 0 ? Math.max(0, h - SLOPING_V_MIN_TIP_Z_M) / legLen : 0;
  const effectiveSlopeRad = Math.asin(Math.min(1, sinSlope));

  const legPointAt = createSlopingVLegPointCalculator(params, effectiveSlopeRad);

  const lambda = wavelengthMeters(params.frequency);
  const maxSegLen = lambda / SEGS_PER_WAVELENGTH;
  // With both ends set back along their own legs, the gap between them —
  // and so the bridge wire — is FEED_BRIDGE_LENGTH_M·sin(halfV): the full
  // 0.1 m at vAngle 180, narrowing as the legs close up. Grade from that
  // actual length, not the constant, or the graded prefix would start an
  // order of magnitude longer than the bridge segment it abuts on a narrow
  // V and reintroduce the adjacent-segment-ratio error (§14.1).
  const bridgeLen = slopingVBridgeLength(params.vAngle, legLen);
  const plan = gradedSegmentPlan(legLen, bridgeLen, maxSegLen);

  const { breakpoints, prefixEnd, tailCount } = resolveGradedSegmentBreakpoints(plan, legLen);

  const apexLeft = legPointAt(0, -1);
  const apexRight = legPointAt(0, 1);

  const wires: Wire[] = [];

  // LEFT leg: emit tip → apex.
  wires.push(...buildGradedLegWires({
    legLen,
    prefixEnd,
    breakpoints,
    prefixLens: plan.prefixLens,
    tailCount,
    wireRadius: params.wireRadius,
    tag: LEFT_LEG_TAG,
    side: -1,
    legPointAt,
    reverse: true,
  }));

  // RIGHT leg: emit apex → tip.
  wires.push(...buildGradedLegWires({
    legLen,
    prefixEnd,
    breakpoints,
    prefixLens: plan.prefixLens,
    tailCount,
    wireRadius: params.wireRadius,
    tag: RIGHT_LEG_TAG,
    side: 1,
    legPointAt,
    reverse: false,
  }));

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

interface FeedlineShield {
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

function calcSegs(length: number, lambda: number, userSegments: number, overrideMinSegs?: number): number {
  const minLegSegs = Math.ceil((SEGS_PER_WAVELENGTH * length) / lambda);
  return Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minLegSegs, overrideMinSegs ?? Math.round(userSegments)),
  );
}

function calcApexSplit(
  feedlineShield: FeedlineShield | null | undefined,
  bridgeHalf: number,
  dx: number,
  dy: number,
  h: number
): { apexLeft: [number, number, number]; apexRight: [number, number, number] } {
  const apex: [number, number, number] = [0, 0, h];
  const apexLeft: [number, number, number] = feedlineShield
    ? [-bridgeHalf * dx, -bridgeHalf * dy, h]
    : apex;
  const apexRight: [number, number, number] = feedlineShield
    ? [bridgeHalf * dx, bridgeHalf * dy, h]
    : apex;
  return { apexLeft, apexRight };
}

interface FeedlineShieldWireOptions {
  wires: Wire[];
  feedlineShield: FeedlineShield | null | undefined;
  apexLeft: [number, number, number];
  apexRight: [number, number, number];
  wireRadius: number;
  bottomZ: number;
}

function appendFeedlineShieldWires(options: FeedlineShieldWireOptions) {
  const { wires, feedlineShield, apexLeft, apexRight, wireRadius, bottomZ } = options;
  if (feedlineShield) {
    wires.push({
      start: apexLeft,
      end: apexRight,
      radius: wireRadius,
      segments: 1,
      tag: FEED_BRIDGE_TAG,
    });
    // Clamp the shield bottom to be at or above the base wire (z = bottomZ) so
    // the shield never crosses the base wire plane. When it does cross, the NEC
    // impedance matrix becomes ill-conditioned: the excitation segment midpoint
    // ends up on the opposite side of the nearby base wire, corrupting mutual-
    // coupling integrals and producing -999.99 sentinel gains / negative R.
    const shieldEndZ = Math.max(feedlineShield.bottomZ, bottomZ);
    wires.push({
      start: apexRight,
      end: [apexRight[0], apexRight[1], shieldEndZ],
      radius: feedlineShield.radius,
      segments: feedlineShield.segments,
      tag: FEEDLINE_SHIELD_TAG,
    });
  }
}

function calcDeltaLoopGeometry(perimeter: number, h: number) {
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

  return { triHeight, bottomZ, legLength, halfBase };
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
 *   LEFT_LEG_TAG  (1) — left leg:  leftCorner → apex
 *   RIGHT_LEG_TAG (2) — right leg: apex → rightCorner
 *   DELTA_BASE_TAG   (6) — base wire: leftCorner → rightCorner
 *
 * Excitation is placed on the last segment of LEFT_LEG_TAG (the apex end).
 */
export function buildDeltaLoopWires(params: DeltaLoopWiresParams): Wire[] {
  const perimeter = params.length;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);

  const { bottomZ, legLength, halfBase } = calcDeltaLoopGeometry(perimeter, h);

  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;

  // When a feedline is active we split the apex with a source bridge so the
  // TL card can connect to it, just like the dipole topology.
  const { apexLeft, apexRight } = calcApexSplit(params.feedlineShield, bridgeHalf, dx, dy, h);

  const leftCorner: [number, number, number] = [-halfBase * dx, -halfBase * dy, bottomZ];
  const rightCorner: [number, number, number] = [halfBase * dx, halfBase * dy, bottomZ];

  const lambda = wavelengthMeters(params.frequency);

  const segmentsPerLeg = calcSegs(legLength, lambda, params.segments / 3);

  const baseLength = halfBase * 2;
  const rawBaseSegs = calcSegs(baseLength, lambda, params.segments / 3);
  const baseSegments = rawBaseSegs % 2 === 0 ? rawBaseSegs + 1 : rawBaseSegs;

  // With a feedline the apex is split by a 1-segment bridge carrying the
  // source, so the legs must be graded down to it (see
  // buildGradedStraightWires). Without one the source sits on the last
  // ordinary leg segment and there is no discontinuity to correct.
  const legMaxSegLen = legLength / segmentsPerLeg;
  const legWires: Wire[] = params.feedlineShield
    ? [
        ...buildGradedStraightWires({
          bridgeEnd: apexLeft,
          farEnd: leftCorner,
          wireRadius: params.wireRadius,
          tag: LEFT_LEG_TAG,
          maxSegLen: legMaxSegLen,
          emitFromFarEnd: true,
        }),
        ...buildGradedStraightWires({
          bridgeEnd: apexRight,
          farEnd: rightCorner,
          wireRadius: params.wireRadius,
          tag: RIGHT_LEG_TAG,
          maxSegLen: legMaxSegLen,
          emitFromFarEnd: false,
        }),
      ]
    : [
        {
          start: leftCorner,
          end: apexLeft,
          radius: params.wireRadius,
          segments: segmentsPerLeg,
          tag: LEFT_LEG_TAG,
        },
        {
          start: apexRight,
          end: rightCorner,
          radius: params.wireRadius,
          segments: segmentsPerLeg,
          tag: RIGHT_LEG_TAG,
        },
      ];

  const wires: Wire[] = [
    ...legWires,
    {
      start: leftCorner,
      end: rightCorner,
      radius: params.wireRadius,
      segments: baseSegments,
      tag: DELTA_BASE_TAG,
    },
  ];

  appendFeedlineShieldWires({
    wires,
    feedlineShield: params.feedlineShield,
    apexLeft,
    apexRight,
    wireRadius: params.wireRadius,
    bottomZ,
  });

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

function calcTerminatedDeltaPoints(halfBase: number, dx: number, dy: number, bottomZ: number) {
  const leftCorner: [number, number, number] = [-halfBase * dx, -halfBase * dy, bottomZ];
  const rightCorner: [number, number, number] = [halfBase * dx, halfBase * dy, bottomZ];

  // Inner ends of the two half-base wires. They sit slightly to the left
  // and right of the geometric centre with a gap of FEED_BRIDGE_LENGTH_M
  // between them — the gap is electrically open in the unterminated case
  // and is closed by the terminating resistor's bridge wire when terminated.
  const innerOffset = Math.max(0, FEED_BRIDGE_LENGTH_M / 2);
  const innerHalfBase = Math.max(0.01, halfBase - innerOffset);
  const centreLeft: [number, number, number] = [-innerOffset * dx, -innerOffset * dy, bottomZ];
  const centreRight: [number, number, number] = [innerOffset * dx, innerOffset * dy, bottomZ];

  return { leftCorner, rightCorner, centreLeft, centreRight, innerHalfBase };
}

interface TerminatedDeltaLegWiresOptions {
  feedlineShield: FeedlineShield | null | undefined;
  wireRadius: number;
  apexLeft: [number, number, number];
  apexRight: [number, number, number];
  leftCorner: [number, number, number];
  rightCorner: [number, number, number];
  legLength: number;
  segmentsPerLeg: number;
}

function buildTerminatedDeltaLegWires(opts: TerminatedDeltaLegWiresOptions): Wire[] {
  // As for the delta loop: grade the legs into the apex bridge when a
  // feedline splits the apex (see buildGradedStraightWires).
  const legMaxSegLen = opts.legLength / opts.segmentsPerLeg;
  if (opts.feedlineShield) {
    return [
      ...buildGradedStraightWires({
        bridgeEnd: opts.apexLeft,
        farEnd: opts.leftCorner,
        wireRadius: opts.wireRadius,
        tag: LEFT_LEG_TAG,
        maxSegLen: legMaxSegLen,
        emitFromFarEnd: true,
      }),
      ...buildGradedStraightWires({
        bridgeEnd: opts.apexRight,
        farEnd: opts.rightCorner,
        wireRadius: opts.wireRadius,
        tag: RIGHT_LEG_TAG,
        maxSegLen: legMaxSegLen,
        emitFromFarEnd: false,
      }),
    ];
  }

  return [
    {
      start: opts.leftCorner,
      end: opts.apexLeft,
      radius: opts.wireRadius,
      segments: opts.segmentsPerLeg,
      tag: LEFT_LEG_TAG,
    },
    {
      start: opts.apexRight,
      end: opts.rightCorner,
      radius: opts.wireRadius,
      segments: opts.segmentsPerLeg,
      tag: RIGHT_LEG_TAG,
    },
  ];
}

/**
 * Builds the wires for a Terminated Delta antenna (apex-up, apex-fed).
 *
 * Geometry is identical to the Delta Loop's isosceles triangle: same
 * perimeter-preserving leg/base math, same equilateral-when-possible
 * shape, same apex feed convention. The only structural difference is
 * that the base is **split in the middle** into two independent
 * half-base wires separated by `FEED_BRIDGE_LENGTH_M`. Each half-base ends
 * near the centre, and when the user specifies a non-zero terminating
 * resistance selectSimulationInput bridges that gap with a single short
 * wire carrying one LD-4 resistor.
 *
 * The resistor is a link in the loop conductor, not a path to earth: it is
 * the only thing joining the two half-bases, so the loop current has to pass
 * through it. That point is half a wavelength from the apex feed, i.e. the
 * loop's current maximum and voltage null, which is precisely where a series
 * resistor absorbs the travelling wave and a shunt to ground would not.
 * Nothing in this antenna connects to earth — deliberately, and unlike the
 * sloping V, whose legs work against ground as a transmission line. See
 * §3.2 and §10.3 of `docs/antenna-spec.md`.
 *
 * Tags:
 *   LEFT_LEG_TAG               (1)  — top-left leg:  leftCorner → apex
 *   RIGHT_LEG_TAG              (2)  — top-right leg: apex → rightCorner
 *   TERMINATED_DELTA_LEFT_BASE_TAG  (9)  — left half-base:  leftCorner → centreLeft
 *   TERMINATED_DELTA_RIGHT_BASE_TAG (10) — right half-base: centreRight → rightCorner
 *
 * Excitation is placed on the last segment of LEFT_LEG_TAG (the apex
 * end), or on the feed bridge / shield when a feedline is active —
 * exactly as for the delta loop.
 */

export function buildTerminatedDeltaWires(params: TerminatedDeltaWiresParams): Wire[] {
  const perimeter = params.length;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);

  const { bottomZ, legLength, halfBase } = calcDeltaLoopGeometry(perimeter, h);

  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;

  // When a feedline is active we split the apex with a source bridge so
  // the TL card can connect to it, just like the delta loop topology.
  const { apexLeft, apexRight } = calcApexSplit(params.feedlineShield, bridgeHalf, dx, dy, h);

  const { leftCorner, rightCorner, centreLeft, centreRight, innerHalfBase } = calcTerminatedDeltaPoints(
    halfBase, dx, dy, bottomZ
  );

  const lambda = wavelengthMeters(params.frequency);

  const segmentsPerLeg = calcSegs(legLength, lambda, params.segments / 3);
  const halfBaseSegments = calcSegs(innerHalfBase, lambda, params.segments / 6);

  // Half-base wires are oriented so that the segment adjacent to the
  // termination is the LAST segment of the wire — analogous to the way
  // the delta loop's left leg is oriented so its last segment is at the
  // apex feed. This gives the termination diagnostics a consistent
  // "current at the loaded end" interpretation.
  //   LEFT  half-base:  leftCorner  → centreLeft   (last seg = inner end)
  //   RIGHT half-base:  centreRight → rightCorner  (first seg = inner end)
  // We keep the right-leg ordering "outward" for symmetry with the
  // delta-loop's right-leg convention (apex → rightCorner).
  const legWires = buildTerminatedDeltaLegWires({
    feedlineShield: params.feedlineShield,
    wireRadius: params.wireRadius,
    apexLeft,
    apexRight,
    leftCorner,
    rightCorner,
    legLength,
    segmentsPerLeg,
  });

  // The half-bases need the same treatment at the *other* end. They stop
  // FEED_BRIDGE_LENGTH_M apart at the centre, and when terminated that gap
  // holds the resistor on a 1-segment bridge. Uniform half-bases put ~0.8 m
  // segments either side of a 0.1 m gap — an 8:1 ratio across the very
  // segments whose current the termination diagnostics read. Unterminated it
  // is the open gap that is mismodelled instead: the deck radiated 107.6 % of
  // its input power before this was graded.
  const halfBaseMaxSegLen = innerHalfBase / halfBaseSegments;

  const wires: Wire[] = [
    ...legWires,
    // Emitted leftCorner -> centreLeft, so the inner end is the LAST
    // sub-wire's `.end` (buildTerminatedDeltaTermination relies on this).
    ...buildGradedStraightWires({
      bridgeEnd: centreLeft,
      farEnd: leftCorner,
      wireRadius: params.wireRadius,
      tag: TERMINATED_DELTA_LEFT_BASE_TAG,
      maxSegLen: halfBaseMaxSegLen,
      emitFromFarEnd: true,
    }),
    // Emitted centreRight -> rightCorner, so the inner end is the FIRST
    // sub-wire's `.start`.
    ...buildGradedStraightWires({
      bridgeEnd: centreRight,
      farEnd: rightCorner,
      wireRadius: params.wireRadius,
      tag: TERMINATED_DELTA_RIGHT_BASE_TAG,
      maxSegLen: halfBaseMaxSegLen,
      emitFromFarEnd: false,
    }),
  ];

  appendFeedlineShieldWires({
    wires,
    feedlineShield: params.feedlineShield,
    apexLeft,
    apexRight,
    wireRadius: params.wireRadius,
    bottomZ,
  });

  return wires;
}

export interface VerticalWhipWiresParams {
  /** Whip length, metres (the radiating wire length). */
  length: number;
  /** Base height above ground, metres. 0 means "sitting on the ground". */
  height: number;
  wireRadius: number;
  segments: number;
  frequency: number;
  /**
   * When true, deploy `VERTICAL_WHIP_RADIAL_COUNT` ¼λ horizontal radials
   * meeting at the whip base, giving the source a proper low-loss return
   * path. When false (default), the whip is freestanding — it has no
   * counterpoise and NEC will report the near-open feedpoint behaviour
   * that an ungrounded radial-less whip actually exhibits.
   */
  counterpoise: boolean;
}

/**
 * Builds the wires for a vertical whip (monopole) antenna.
 *
 * Geometry is a single vertical wire from (0, 0, baseZ) up to
 * (0, 0, baseZ + length), fed on segment 1 at the base. When height = 0
 * the base is lifted by VERTICAL_WHIP_BASE_GAP_M (1 cm) so the wire is
 * electrically isolated from ground — NEC would otherwise auto-bond the
 * endpoint to its image and model a properly-grounded monopole, which is
 * not the "whip sitting on a mount on the ground" picture the user has.
 *
 * When `counterpoise` is true, VERTICAL_WHIP_RADIAL_COUNT horizontal
 * radials of ¼λ length fan out from the base at z = baseZ in
 * equally-spaced azimuths. They share the base junction with the whip,
 * so the source on segment 1 of the whip drives the whip against the
 * radials (the canonical ground-plane vertical model). Without the
 * counterpoise the source has no proper return path and the feedpoint
 * impedance goes deeply capacitive — physically correct for a radial-
 * less whip.
 *
 * Segment count is sized to give at least SEGS_PER_WAVELENGTH segments
 * per wavelength of conductor (both for the whip and for each radial),
 * with the same MIN/MAX bounds used by the other builders.
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

  const wires: Wire[] = [
    {
      start: [0, 0, baseZ],
      end: [0, 0, topZ],
      radius: params.wireRadius,
      segments,
      tag: VERTICAL_WHIP_TAG,
    },
  ];

  if (params.counterpoise) {
    const radialLen = lambda * 0.25 * 0.95;
    const minRadialSegs = Math.ceil((SEGS_PER_WAVELENGTH * radialLen) / lambda);
    const radialSegs = Math.min(
      MAX_SEGS_PER_LEG,
      Math.max(MIN_SEGS_PER_LEG, minRadialSegs),
    );
    for (let i = 0; i < VERTICAL_WHIP_RADIAL_COUNT; i++) {
      const theta = (2 * Math.PI * i) / VERTICAL_WHIP_RADIAL_COUNT;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      wires.push({
        start: [0, 0, baseZ],
        end: [dx * radialLen, dy * radialLen, baseZ],
        radius: params.wireRadius,
        segments: radialSegs,
        tag: VERTICAL_WHIP_RADIAL_TAG,
      });
    }
  }

  return wires;
}

export interface InvertedLWiresParams {
  /**
   * Total wire length (vertical section + horizontal section), metres.
   * The horizontal section length is derived as `length − verticalLength`.
   */
  length: number;
  /**
   * Bend-point height above ground (metres).
   * This is the height of the top of the vertical section and therefore
   * the height of the entire horizontal section.
   */
  height: number;
  /** Direction the horizontal top-loading section runs (azimuth). */
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  /**
   * When true, deploy `VERTICAL_WHIP_RADIAL_COUNT` ¼λ horizontal radials
   * at the base, providing a low-loss return path for the monopole source.
   * Without them the feedpoint impedance will be highly reactive.
   */
  counterpoise: boolean;
}

/**
 * Ensures segment length is at least ~4x the wire radius for NEC-2 stability.
 */
const safeSegs = (len: number, requested: number, wireRadius: number): number => {
  const maxSafe = Math.max(1, Math.floor(len / (4 * wireRadius)));
  return Math.min(requested, maxSafe);
};

/**
 * Builds the wires for an Inverted-L antenna.
 *
 * The Inverted-L consists of:
 *   1. A vertical section from the base (VERTICAL_WHIP_BASE_GAP_M above
 *      ground) up to the bend height.
 *   2. A horizontal top-loading section extending from the bend point
 *      outward along the orientation azimuth.
 *   3. Optional counterpoise radials at the base (¼λ each, same pattern
 *      as the vertical whip).
 *
 * The total radiating wire length is `params.length`; the horizontal
 * section absorbs any length beyond the vertical section, allowing a
 * shorter mast to achieve the same electrical length as a taller whip.
 *
 * Tags:
 *   INVERTED_L_VERTICAL_TAG   (14) — vertical section, base-fed at seg 1
 *   INVERTED_L_HORIZONTAL_TAG (15) — horizontal top-loading section
 *   INVERTED_L_RADIAL_TAG     (16) — optional counterpoise radials
 *
 * Excitation is placed on segment 1 of INVERTED_L_VERTICAL_TAG (the
 * lowest segment at the base), exactly as for the vertical whip.
 */
export function buildInvertedLWires(params: InvertedLWiresParams): Wire[] {
  const totalLen = Math.max(0.1, params.length);
  const baseZ = VERTICAL_WHIP_BASE_GAP_M;

  // Vertical section is either the total length (if shorter than the mast)
  // or the mast height itself.
  const maxVertLen = Math.max(0.1, params.height - baseZ);
  const vertLen = Math.min(totalLen, maxVertLen);
  const bendZ = baseZ + vertLen;

  // Horizontal section is whatever total length remains after the vertical.
  const horizLen = Math.max(0, totalLen - vertLen);

  const [dx, dy] = orientationVector(params.orientation);
  const lambda = wavelengthMeters(params.frequency);

  // Segments for the vertical section.
  const minVertSegs = Math.ceil((SEGS_PER_WAVELENGTH * vertLen) / lambda);
  const vertSegs = safeSegs(
    vertLen,
    Math.min(
      MAX_SEGS_PER_LEG,
      Math.max(MIN_SEGS_PER_LEG, minVertSegs, Math.round(params.segments / 2)),
    ),
    params.wireRadius,
  );

  const wires: Wire[] = [
    {
      start: [0, 0, baseZ],
      end: [0, 0, bendZ],
      radius: params.wireRadius,
      segments: vertSegs,
      tag: INVERTED_L_VERTICAL_TAG,
    },
  ];

  if (horizLen > 0.01) {
    const minHorizSegs = Math.ceil((SEGS_PER_WAVELENGTH * horizLen) / lambda);
    const horizSegs = safeSegs(
      horizLen,
      Math.min(
        MAX_SEGS_PER_LEG,
        Math.max(MIN_SEGS_PER_LEG, minHorizSegs, Math.round(params.segments / 2)),
      ),
      params.wireRadius,
    );
    wires.push({
      start: [0, 0, bendZ],
      end: [dx * horizLen, dy * horizLen, bendZ],
      radius: params.wireRadius,
      segments: horizSegs,
      tag: INVERTED_L_HORIZONTAL_TAG,
    });
  }

  if (params.counterpoise) {
    const radialLen = lambda * 0.25 * 0.95;
    const minRadialSegs = Math.ceil((SEGS_PER_WAVELENGTH * radialLen) / lambda);
    const radialSegs = Math.min(
      MAX_SEGS_PER_LEG,
      Math.max(MIN_SEGS_PER_LEG, minRadialSegs),
    );
    for (let i = 0; i < VERTICAL_WHIP_RADIAL_COUNT; i++) {
      const theta = (2 * Math.PI * i) / VERTICAL_WHIP_RADIAL_COUNT;
      const rdx = Math.cos(theta);
      const rdy = Math.sin(theta);
      wires.push({
        start: [0, 0, baseZ],
        end: [rdx * radialLen, rdy * radialLen, baseZ],
        radius: params.wireRadius,
        segments: radialSegs,
        tag: INVERTED_L_RADIAL_TAG,
      });
    }
  }

  return wires;
}

function calcFoldedAntennaPoints(
  orientation: Orientation,
  h: number,
  half: number,
  aperture: number,
  bridgeHalf: number,
  gapHalf: number
) {
  const [dx, dy] = orientationVector(orientation);

  // Bottom (fed) conductor at z = h; top (opposite) conductor at z = h + aperture.
  const zBottom = h;
  const zTop = h + aperture;

  // axis = signed distance along the orientation direction from the antenna centre.
  const pt = (axis: number, z: number): [number, number, number] => [
    cleanZero(axis * dx),
    cleanZero(axis * dy),
    z,
  ];

  // Inner ends of the top-conductor halves. When gapHalf = 0 these coincide.
  return {
    leftFed: pt(-half, zBottom),
    rightFed: pt(half, zBottom),
    bridgeLeft: pt(-bridgeHalf, zBottom),
    bridgeRight: pt(bridgeHalf, zBottom),
    leftOpp: pt(-half, zTop),
    rightOpp: pt(half, zTop),
    topCenterLeft: pt(-gapHalf, zTop),
    topCenterRight: pt(gapHalf, zTop),
  };
}

// Target segment length. NEC's thin-wire kernel loses accuracy for closely
// spaced parallel wires once the segment length grows much larger than the
// wire separation, so the folded dipole must segment finely enough that each
// segment is no longer than ~half the aperture (empirically the point where
// the free-space gain converges to the dipole value). We take the smaller of
// the usual density target (λ / SEGS_PER_WAVELENGTH) and half the aperture,
// then derive all segment counts from that single target length. This also
// keeps the corner junction segments (conductor vs. connector) close in
// length. The aperture is capped (see the store) so this stays within
// MAX_SEGS_PER_LEG across the HF range.
function calcFoldedTargetSegLen(frequency: number, aperture: number): number {
  const lambda = wavelengthMeters(frequency);
  return Math.max(1e-3, Math.min(lambda / SEGS_PER_WAVELENGTH, aperture / 2));
}

function calcFoldedLegSegs(
  len: number,
  targetSegLen: number,
  minAllowed: number,
  userFloor: number,
  wireRadius: number
): number {
  return safeSegs(
    len,
    Math.min(
      MAX_SEGS_PER_LEG,
      Math.max(minAllowed, Math.ceil(len / targetSegLen), userFloor)
    ),
    wireRadius
  );
}

function calcFoldedAntennaSegments(
  frequency: number,
  aperture: number,
  wireRadius: number,
  segments: number,
  half: number,
  bridgeHalf: number,
  gapHalf: number
) {
  const targetSegLen = calcFoldedTargetSegLen(frequency, aperture);
  const userFloor = Math.round(segments / 2);

  // Each half of the fed conductor (corner → feed bridge edge).
  const halfCondLen = Math.max(0.01, half - bridgeHalf);
  const halfSegs = calcFoldedLegSegs(halfCondLen, targetSegLen, MIN_SEGS_PER_LEG, userFloor, wireRadius);

  // Each half of the top conductor runs from its outer end to the gap edge.
  // When gapHalf = 0 both halves terminate at the same point (topCenter),
  // making a continuous wire electrically.
  // Both halves are symmetric: same length and same segment count.
  const halfOppLen = Math.max(0.01, half - gapHalf);
  const leftOppSegs = calcFoldedLegSegs(halfOppLen, targetSegLen, MIN_SEGS_PER_LEG, userFloor, wireRadius);
  const rightOppSegs = leftOppSegs;

  // End connectors span the aperture vertically, segmented at the same target
  // length so their segments match the adjacent conductor segments at the corners.
  const connSegs = calcFoldedLegSegs(aperture, targetSegLen, 1, 1, wireRadius);

  return { halfSegs, leftOppSegs, rightOppSegs, connSegs };
}

export interface FoldedAntennaWiresParams {
  /** Each conductor's length, metres (≈½λ resonant). */
  length: number;
  /** Height of the (planar, horizontal) antenna above ground, metres. */
  height: number;
  /** Spacing between the two parallel conductors, metres. */
  aperture: number;
  /** Azimuth the conductor axis runs. */
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  /**
   * When > 0, the top (un-fed) conductor is split at its centre with a gap
   * of FEED_BRIDGE_LENGTH_M so that buildTerminationElements can
   * add a resistive bridge across the gap (TFD topology). When 0 (unterminated),
   * both halves share a common junction at the top centre — electrically
   * equivalent to a single continuous wire.
   */
  terminatingResistor?: number;
}

/**
 * Builds the wires for a Folded Dipole antenna.
 *
 * Two parallel conductors of length `length` run along the orientation axis,
 * separated vertically by `aperture`: the fed (bottom) conductor sits at
 * z = height and the un-fed (top) conductor sits at z = height + aperture.
 * Short vertical connector wires join both ends, completing the folded loop.
 * The structure is fully buildable at a modest height — the top conductor only
 * rises `aperture` (≤ 0.5 m) above the feedpoint height, unlike a vertical loop.
 *
 * The bottom (fed) conductor is split at its centre around a FEED_BRIDGE_TAG
 * source bridge — the same split-fed convention as the standard dipole, so
 * the existing buildExcitation `hasBridge` path drives it automatically.
 *
 * The top (un-fed) conductor is always split into two halves at the centre:
 *   • Unterminated: both halves share the same junction point at topCenter
 *     (0, 0, height + aperture), forming a continuous wire. No gap, no bridge.
 *   • Terminated (terminatingResistor > 0): a gap of FEED_BRIDGE_LENGTH_M
 *     separates the two inner ends. buildTerminationElements adds a horizontal
 *     bridge wire (FOLDED_DIPOLE_TERM_BRIDGE_TAG) with an LD-4 load across the
 *     gap. Current must flow through R to pass between the halves — exactly the
 *     traveling-wave termination of a T2FD / TFD, analogous to the
 *     terminated-delta's centre-gap bridge.
 *
 * Tags:
 *   LEFT_LEG_TAG              (1)  — fed (bottom) conductor, left half (left → bridge)
 *   RIGHT_LEG_TAG             (2)  — fed (bottom) conductor, right half (bridge → right)
 *   FEED_BRIDGE_TAG              (3)  — 1-segment source bridge at the centre
 *   FOLDED_DIPOLE_OPPOSITE_TAG   (17) — un-fed (top) conductor, 2 halves (always split)
 *   FOLDED_DIPOLE_CONNECTOR_TAG  (18) — both end connectors (vertical, bottom → top)
 */
export function buildFoldedAntennaWires(params: FoldedAntennaWiresParams): Wire[] {
  const h = params.height;
  const half = Math.max(0.1, params.length) / 2;
  const aperture = Math.max(0.02, params.aperture);
  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;
  const hasTermination = (params.terminatingResistor ?? 0) > 0;
  const gapHalf = hasTermination ? FEED_BRIDGE_LENGTH_M / 2 : 0;

  const pts = calcFoldedAntennaPoints(params.orientation, h, half, aperture, bridgeHalf, gapHalf);
  const segs = calcFoldedAntennaSegments(
    params.frequency,
    aperture,
    params.wireRadius,
    params.segments,
    half,
    bridgeHalf,
    gapHalf
  );

  const createWire = (
    start: [number, number, number],
    end: [number, number, number],
    segments: number,
    tag: number,
  ): Wire => ({
    start,
    end,
    radius: params.wireRadius,
    segments,
    tag,
  });

  return [
    // Fed conductor — left half (left end → bridge).
    createWire(pts.leftFed, pts.bridgeLeft, segs.halfSegs, LEFT_LEG_TAG),
    // Feed bridge at the centre of the fed conductor.
    createWire(pts.bridgeLeft, pts.bridgeRight, 1, FEED_BRIDGE_TAG),
    // Fed conductor — right half (bridge → right end).
    createWire(pts.bridgeRight, pts.rightFed, segs.halfSegs, RIGHT_LEG_TAG),
    // Un-fed (top) conductor — left half.
    // Unterminated: ends at topCenter (same as right half's start) → continuous.
    // Terminated:   ends at topCenterLeft, separated from topCenterRight by the gap.
    createWire(pts.leftOpp, pts.topCenterLeft, segs.leftOppSegs, FOLDED_DIPOLE_OPPOSITE_TAG),
    // Un-fed (top) conductor — right half.
    createWire(pts.topCenterRight, pts.rightOpp, segs.rightOppSegs, FOLDED_DIPOLE_OPPOSITE_TAG),
    // Left end connector across the aperture.
    createWire(pts.leftFed, pts.leftOpp, segs.connSegs, FOLDED_DIPOLE_CONNECTOR_TAG),
    // Right end connector across the aperture.
    createWire(pts.rightFed, pts.rightOpp, segs.connSegs, FOLDED_DIPOLE_CONNECTOR_TAG),
  ];
}

export interface DipoleWiresParams {
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  layout: { offset: number; shield: { bottomZ: number; radius: number } | null } | null;
}

export function buildDipoleWires(params: DipoleWiresParams): Wire[] {
  const { length, height: h, orientation, wireRadius, segments, layout } = params;
  const half = length / 2;
  const [dx, dy] = orientationVector(orientation);

  if (!layout) {
    return [{
      start: [cleanZero(-half * dx), cleanZero(-half * dy), h],
      end: [cleanZero(half * dx), cleanZero(half * dy), h],
      radius: wireRadius,
      segments: segments,
      tag: MAIN_WIRE_TAG,
    }];
  }

  const offset = layout.offset;
  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;

  const bridgeStart: [number, number, number] = [
    cleanZero((offset - bridgeHalf) * dx),
    cleanZero((offset - bridgeHalf) * dy),
    h,
  ];
  const bridgeEnd: [number, number, number] = [
    cleanZero((offset + bridgeHalf) * dx),
    cleanZero((offset + bridgeHalf) * dy),
    h,
  ];

  const leftTip: [number, number, number] = [cleanZero(-half * dx), cleanZero(-half * dy), h];
  const rightTip: [number, number, number] = [cleanZero(half * dx), cleanZero(half * dy), h];

  // ⚡ Bolt: Performance Optimization
  // Explicit multiplication (x * x) avoids the overhead of Math.pow and ** operators in V8,
  // making this distance calculation slightly faster when computing dense geometries.
  const dist = (p1: [number, number, number], p2: [number, number, number]) => {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    const dz = p1[2] - p2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const leftLen = dist(leftTip, bridgeStart);
  const rightLen = dist(rightTip, bridgeEnd);

  const totalSeg = segments;
  const segDensity = totalSeg / length;
  const leftSeg = Math.max(3, oddRound(leftLen * segDensity));
  const rightSeg = Math.max(3, oddRound(rightLen * segDensity));

  // Grade both halves down to the bridge length at the feed (see
  // buildGradedStraightWires). `segDensity` still sets the density over the
  // bulk of each half, so the segment-count control is unaffected.
  const maxSegLen = 1 / segDensity;

  return [
    ...buildGradedStraightWires({
      bridgeEnd: bridgeStart,
      farEnd: leftTip,
      wireRadius,
      tag: LEFT_LEG_TAG,
      maxSegLen: Math.min(maxSegLen, leftLen / Math.max(1, leftSeg)),
      emitFromFarEnd: true,
    }),
    ...buildGradedStraightWires({
      bridgeEnd,
      farEnd: rightTip,
      wireRadius,
      tag: RIGHT_LEG_TAG,
      maxSegLen: Math.min(maxSegLen, rightLen / Math.max(1, rightSeg)),
      emitFromFarEnd: false,
    }),
    {
      start: bridgeStart, end: bridgeEnd,
      radius: wireRadius,
      segments: 1,
      tag: FEED_BRIDGE_TAG,
    },
  ];
}

function oddRound(v: number): number {
  const n = Math.max(1, Math.round(v));
  return n % 2 === 0 ? n + 1 : n;
}


// --------------- Feedline & Wire Assembly ---------------

const FEEDLINE_SUPPORTED_TYPES = new Set<string>(['dipole', 'inverted-v', 'delta-loop', 'sloping-v', 'terminated-delta', 'folded-dipole']);

export const FEEDLINE_SHIELD_SEGMENTS = 11;
const FEEDLINE_GROUND_GAP_M = 0.1;

export interface BuildWiresState {
  antennaType: AntennaType;
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  vAngle: number;
  legSlope: number;
  feedlineId?: string;
  feedlineLength?: number;
  feedlineOffset?: number;
  whipCounterpoise?: boolean;
  foldedDipoleAperture?: number;
  terminatingResistor?: number;
}

export function buildWires(state: BuildWiresState): Wire[] {
  const wires = buildWiresInternal(state);
  const layout = computeFeedlineLayout(state);
  if (layout?.shield && state.antennaType !== 'delta-loop' && state.antennaType !== 'terminated-delta') {
    let bridge: Wire | undefined;
    for (let i = 0; i < wires.length; i++) {
      if (wires[i].tag === FEED_BRIDGE_TAG) {
        bridge = wires[i];
        break;
      }
    }
    if (bridge) {
      wires.push({
        start: bridge.end,
        end: [bridge.end[0], bridge.end[1], layout.shield.bottomZ],
        radius: layout.shield.radius,
        segments: FEEDLINE_SHIELD_SEGMENTS,
        tag: FEEDLINE_SHIELD_TAG,
      });
    }
  }
  return wires;
}

function computeFeedlineShield(
  state: Pick<{ length: number; height: number }, 'length' | 'height'> &
    Partial<Pick<{ antennaType: AntennaType; feedlineId: string; feedlineLength: number; feedlineOffset: number }, 'antennaType' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
) {
  const layout = computeFeedlineLayout(state);
  return layout?.shield
    ? { ...layout.shield, segments: FEEDLINE_SHIELD_SEGMENTS }
    : null;
}

function buildWiresInternal(state: BuildWiresState): Wire[] {
  const h = state.height;

  switch (state.antennaType) {
    case 'inverted-v':
      return buildInvertedVWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        vAngle: state.vAngle,
      });

    case 'sloping-v':
      return buildSlopingVWires(state);

    case 'delta-loop':
      return buildDeltaLoopWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        feedlineShield: computeFeedlineShield(state),
      });

    case 'terminated-delta':
      return buildTerminatedDeltaWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        feedlineShield: computeFeedlineShield(state),
      });

    case 'vertical-whip':
      return buildVerticalWhipWires({
        length: state.length,
        height: h,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        counterpoise: state.whipCounterpoise ?? false,
      });

    case 'inverted-l':
      return buildInvertedLWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        counterpoise: state.whipCounterpoise ?? false,
      });

    case 'folded-dipole':
      return buildFoldedAntennaWires({
        length: state.length,
        height: h,
        aperture: state.foldedDipoleAperture ?? FOLDED_DIPOLE_DEFAULT_APERTURE_M,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        terminatingResistor: state.terminatingResistor ?? 0,
      });

    case 'dipole':
    default:
      return buildDipoleWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        layout: computeFeedlineLayout(state),
      });
  }
}

export interface FeedlineLayout {
  readonly offset: number;
  readonly shield: { readonly bottomZ: number; readonly radius: number } | null;
}

export function computeFeedlineLayout(
  state: Pick<{ length: number; height: number }, 'length' | 'height'> &
    Partial<Pick<{ antennaType: AntennaType; feedlineId: string; feedlineLength: number; feedlineOffset: number }, 'antennaType' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
): FeedlineLayout | null {
  if (!FEEDLINE_SUPPORTED_TYPES.has(state.antennaType ?? '')) return null;

  const id = state.feedlineId;
  if (!id || id === 'none') return null;
  const preset = findFeedlinePreset(id);
  if (preset.id === 'none' || preset.shieldOuterRadiusM <= 0) return null;

  const len = state.feedlineLength;
  if (typeof len !== 'number' || !Number.isFinite(len) || len <= 0) return null;

  // Inverted-V and delta-loop are apex-fed: offset is meaningless, always 0.
  const limit = state.antennaType === 'dipole'
    ? Math.max(0, state.length / 2 - FEED_BRIDGE_LENGTH_M)
    : 0;
  const rawOffset = state.antennaType === 'dipole' ? (state.feedlineOffset ?? 0) : 0;
  const offset = Math.max(-limit, Math.min(limit, rawOffset));

  const topZ = state.height;
  const minBottomZ = state.height > 0 ? FEEDLINE_GROUND_GAP_M : -len;
  const desiredBottomZ = topZ - len;
  const bottomZ = Math.max(minBottomZ, desiredBottomZ);
  const drop = topZ - bottomZ;
  if (drop < 0.05) {
    return { offset, shield: null };
  }

  return {
    offset,
    shield: {
      bottomZ,
      radius: preset.shieldOuterRadiusM,
    },
  };
}


function findSlopingVLegTips(wires: Wire[]): {
  leftTip: Wire['start'];
  rightTip: Wire['end'];
} {
  // With graded segmentation each leg may be emitted as multiple sub-wires
  // sharing the leg's tag. By convention `buildSlopingVWires` emits the
  // LEFT leg tip→apex (so the first sub-wire's `.start` is the tip) and
  // the RIGHT leg apex→tip (so the last sub-wire's `.end` is the tip).
  let firstLeft: Wire | undefined;
  let lastRight: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i]!;
    if (w.tag === LEFT_LEG_TAG && !firstLeft) firstLeft = w;
    if (w.tag === RIGHT_LEG_TAG) lastRight = w;
  }
  return {
    leftTip: firstLeft!.start,
    rightTip: lastRight!.end,
  };
}

function createSlopingVStubsAndLoads(
  leftTip: Wire['start'],
  rightTip: Wire['end'],
  hubZ: number,
  radius: number,
  R: number,
) {
  const stubWires: Wire[] = [
    {
      start: leftTip,
      end: [leftTip[0], leftTip[1], hubZ],
      radius,
      segments: 1,
      tag: SLOPING_V_LEFT_STUB_TAG,
    },
    {
      start: rightTip,
      end: [rightTip[0], rightTip[1], hubZ],
      radius,
      segments: 1,
      tag: SLOPING_V_RIGHT_STUB_TAG,
    },
  ];

  const stubLoads: SegmentLoad[] = [
    { type: 4, wireTag: SLOPING_V_LEFT_STUB_TAG,  segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
    { type: 4, wireTag: SLOPING_V_RIGHT_STUB_TAG, segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
  ];

  return { stubWires, stubLoads };
}

function createSlopingVCounterpoises(
  leftTip: Wire['start'],
  rightTip: Wire['end'],
  hubZ: number,
  radius: number,
  frequency: number,
): Wire[] {
  const counterpoiseWires: Wire[] = [];

  // Radial length is capped at 40 % of the tip separation so the two screens
  // can never grow into one another: opposing radials then reach at most
  // 80 % of the gap between the hubs, leaving them disjoint. Overlapping or
  // coincident wires are a NEC geometry error, and a narrow V at a low
  // frequency is exactly the case that would produce them.
  const lambda = wavelengthMeters(frequency);
  const dx = leftTip[0] - rightTip[0];
  const dy = leftTip[1] - rightTip[1];
  const tipSeparation = Math.sqrt(dx * dx + dy * dy);
  const radialLength = Math.min(
    lambda * SLOPING_V_COUNTERPOISE_LENGTH_WL,
    Math.max(0.1, tipSeparation * 0.4),
  );
  const radialSegments = Math.max(1, Math.ceil(radialLength / (lambda / SEGS_PER_WAVELENGTH)));

  const hubs: Array<[[number, number, number], number]> = [
    [[leftTip[0], leftTip[1], hubZ], SLOPING_V_LEFT_COUNTERPOISE_TAG],
    [[rightTip[0], rightTip[1], hubZ], SLOPING_V_RIGHT_COUNTERPOISE_TAG],
  ];

  for (let h = 0; h < hubs.length; h++) {
    const hub = hubs[h]![0];
    const tag = hubs[h]![1];
    for (let i = 0; i < SLOPING_V_COUNTERPOISE_RADIALS; i++) {
      // Offset by half a step so no radial lies along the tip-to-tip axis,
      // which is where the two screens come closest to each other.
      const angle = (2 * Math.PI * i) / SLOPING_V_COUNTERPOISE_RADIALS + Math.PI / SLOPING_V_COUNTERPOISE_RADIALS;
      counterpoiseWires.push({
        start: hub,
        end: [
          hub[0] + radialLength * Math.cos(angle),
          hub[1] + radialLength * Math.sin(angle),
          hubZ,
        ],
        radius,
        segments: radialSegments,
        tag,
      });
    }
  }

  return counterpoiseWires;
}

function buildSlopingVTermination(R: number, radius: number, frequency: number, wires: Wire[]) {
  // Model the physical tip-to-earth terminating resistor: a short vertical
  // stub from each leg tip down to a hub just above ground, the resistance
  // in that stub, and a small radial screen at the hub standing in for the
  // earth stake the real resistor is bonded to.
  //
  // The radial screen is not decoration and not hardware — it is what makes
  // the resistor conduct at all. NEC-2 cannot bond a wire to a
  // Sommerfeld-Norton ground, so a stub that merely ends near the earth is
  // an open circuit: the resistor sits in series with a sub-picofarad end
  // capacitance, passes almost no current, and terminates nothing. Measured
  // against the solver, the stub-only model dissipated 0.9 % of input power
  // and left 18 dB of leg current ripple — a full standing wave, i.e. an
  // unterminated antenna wearing a resistor. Removing the resistor entirely
  // changed the answer by less than the ripple's own rounding. With the
  // screen fitted the same resistor takes ~68 % of the power, ripple falls
  // to ~2.4 dB, and the ripple minimum lands at R ≈ 500 Ω — the leg's
  // characteristic impedance against ground, which is where the optimum
  // belongs.
  //
  // The screen is simulation-only: `buildWires` does not emit it, so the 3D
  // scene shows the stub and resistor a builder actually installs and not
  // the solver's stand-in for the dirt underneath it.
  const { leftTip, rightTip } = findSlopingVLegTips(wires);

  // Hub height is frequency-scaled (0.001 λ, the lowest the S-N ground model
  // is documented to represent faithfully) and clamped so it always stays
  // below the tip it hangs from.
  const hubZ = slopingVTerminationHubZ(frequency, Math.min(leftTip[2], rightTip[2]));

  const { stubWires, stubLoads } = createSlopingVStubsAndLoads(leftTip, rightTip, hubZ, radius, R);
  const counterpoiseWires = createSlopingVCounterpoises(leftTip, rightTip, hubZ, radius, frequency);

  return {
    extraWires: [...stubWires, ...counterpoiseWires],
    loads: stubLoads,
  };
}

function buildTerminatedDeltaTermination(R: number, radius: number, wires: Wire[]) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];
  // T2FD / aperiodic-loop termination: a single horizontal bridge wire
  // spans the gap between the two half-base inner ends, and one LD-4
  // card places R Ω on its single segment. The wave that propagates
  // around the loop from the apex feed arrives at the bridge with
  // ~equal-and-opposite drive from each side; matching R to the loop's
  // characteristic impedance (~500–700 Ω over HF heights) flattens
  // the feedpoint impedance across an octave or more, at the cost of
  // efficiency on the fundamental.
  //
  // The LEFT half-base is emitted leftCorner → centreLeft so the
  // inner end is the wire's `.end`. The RIGHT half-base is emitted
  // centreRight → rightCorner so the inner end is the wire's `.start`.
  // The bridge runs leftInner → rightInner, joining the two halves
  // electrically through the resistor.
  // Each half-base is graded into the centre gap, so it is emitted as several
  // sub-wires sharing one tag. The LEFT half runs leftCorner -> centreLeft, so
  // its inner end is the LAST sub-wire's `.end`; the RIGHT half runs
  // centreRight -> rightCorner, so its inner end is the FIRST sub-wire's
  // `.start`. Taking the first of both would put the bridge partway along the
  // left half-base instead of across the gap.
  let leftHalfBase: Wire | undefined;
  let rightHalfBase: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (w.tag === TERMINATED_DELTA_LEFT_BASE_TAG) leftHalfBase = w;
    else if (w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG && !rightHalfBase) rightHalfBase = w;
  }
  const leftInner  = leftHalfBase!.end;
  const rightInner = rightHalfBase!.start;

  extraWires.push({
    start: leftInner,
    end: rightInner,
    radius: radius,
    segments: 1,
    tag: TERMINATED_DELTA_BRIDGE_TAG,
  });
  loads.push(
    { type: 4, wireTag: TERMINATED_DELTA_BRIDGE_TAG, segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
  );

  return { extraWires, loads };
}

function buildFoldedDipoleTermination(R: number, radius: number, wires: Wire[]) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];
  // Terminated Folded Dipole (TFD) — correct travelling-wave gap-bridge topology.
  //
  // buildFoldedAntennaWires splits the top (un-fed) conductor into two halves
  // with a gap of FEED_BRIDGE_LENGTH_M at the centre when a
  // terminating resistor is non-zero. The gap inner ends are:
  //   left-half  .end = topCenterLeft
  //   right-half .start = topCenterRight
  // We add a short horizontal bridge wire spanning that gap and place the
  // LD-4 load on its single segment. Current flowing in the top conductor
  // MUST pass through R to cross from one half to the other — exactly the
  // series-in-the-top-wire termination of a T2FD.
  //
  // This is identical in pattern to the terminated-delta bridge: the base is
  // split, the resistive bridge closes the gap, and wave energy is dissipated
  // rather than reflected. The gap is electrically small (≈ 0.1 m ≪ λ) so
  // it does not perturb the radiation pattern or the fundamental resonance.
  let leftHalfOpp: Wire | undefined;
  let rightHalfOpp: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (w.tag === FOLDED_DIPOLE_OPPOSITE_TAG) {
      if (!leftHalfOpp) {
        leftHalfOpp = w;
      } else if (!rightHalfOpp) {
        rightHalfOpp = w;
      }
    }
    if (leftHalfOpp && rightHalfOpp) break;
  }
  const topCenterLeft  = leftHalfOpp!.end;   // inner end of left half
  const topCenterRight = rightHalfOpp!.start; // inner end of right half

  extraWires.push({
    start: topCenterLeft,
    end: topCenterRight,
    radius: radius,
    segments: 1,
    tag: FOLDED_DIPOLE_TERM_BRIDGE_TAG,
  });
  loads.push({
    type: 4,
    wireTag: FOLDED_DIPOLE_TERM_BRIDGE_TAG,
    segmentStart: 1,
    segmentEnd: 1,
    param1: R,
    param2: 0,
  });

  return { extraWires, loads };
}

export function buildTerminationElements(
  state: { terminatingResistor: number; wireRadius: number; frequency: number; antennaType: AntennaType },
  wires: Wire[],
) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];

  if (state.terminatingResistor > 0) {
    switch (state.antennaType) {
      case 'sloping-v': {
        const { extraWires: ew, loads: l } = buildSlopingVTermination(state.terminatingResistor, state.wireRadius, state.frequency, wires);
        extraWires.push(...ew);
        loads.push(...l);
        break;
      }
      case 'terminated-delta': {
        const { extraWires: ew, loads: l } = buildTerminatedDeltaTermination(state.terminatingResistor, state.wireRadius, wires);
        extraWires.push(...ew);
        loads.push(...l);
        break;
      }
      case 'folded-dipole': {
        const { extraWires: ew, loads: l } = buildFoldedDipoleTermination(state.terminatingResistor, state.wireRadius, wires);
        extraWires.push(...ew);
        loads.push(...l);
        break;
      }
    }
  }

  return { extraWires, loads };
}
