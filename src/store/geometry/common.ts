import { cleanZero } from "../../utils/math";
import { FEED_BRIDGE_LENGTH_M } from '../../physics/constants';
import type { Wire } from '../../physics/types';

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
 * Ensures segment length is at least ~4x the wire radius for NEC-2 stability.
 */
export const safeSegs = (len: number, requested: number, wireRadius: number): number => {
  const maxSafe = Math.max(1, Math.floor(len / (4 * wireRadius)));
  return Math.min(requested, maxSafe);
};

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

export function resolveGradedSegmentBreakpoints(plan: GradedSegmentPlan, legLen: number) {
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

export interface BuildGradedLegWiresOptions {
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

export function buildGradedLegWires({
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

export interface GradedStraightWireParams {
  bridgeEnd: [number, number, number];
  farEnd: [number, number, number];
  wireRadius: number;
  tag: number;
  maxSegLen: number;
  emitFromFarEnd: boolean;
}

export function buildGradedStraightWires(params: GradedStraightWireParams): Wire[] {
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
