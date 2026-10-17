import { cleanZero } from "../../utils/math";
import { SLOPING_V_MIN_TIP_Z_M, wavelengthMeters, FEED_BRIDGE_LENGTH_M } from '../../physics/constants';
import type { Wire } from '../../physics/types';
import { LEFT_LEG_TAG, RIGHT_LEG_TAG, FEED_BRIDGE_TAG } from '../../physics/tags';
import {
  SEGS_PER_WAVELENGTH,
  MIN_SEGS_PER_LEG,
  MAX_SEGS_PER_LEG,
  type Orientation,
  orientationVector,
  gradedSegmentPlan,
  resolveGradedSegmentBreakpoints,
  buildGradedLegWires,
} from './common';

export interface InvertedVWiresParams {
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  vAngle: number;
}

export function calcInvertedVPoints(
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

export function slopingVFeedSetback(vAngleDeg: number, legLen: number): number {
  const halfV = ((vAngleDeg / 2) * Math.PI) / 180;
  const sinV = Math.sin(halfV);
  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;
  const ideal = sinV > 1e-6 ? bridgeHalf / sinV : Infinity;
  return Math.min(ideal, Math.max(bridgeHalf, legLen * 0.05));
}

export function slopingVBridgeLength(vAngleDeg: number, legLen: number): number {
  const halfV = ((vAngleDeg / 2) * Math.PI) / 180;
  return 2 * slopingVFeedSetback(vAngleDeg, legLen) * Math.sin(halfV);
}

export function slopingVLegLength(totalLength: number): number {
  return Math.max(0.1, (totalLength - FEED_BRIDGE_LENGTH_M) / 2);
}

export function createSlopingVLegPointCalculator(params: SlopingVWiresParams, effectiveSlopeRad: number) {
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

export function buildSlopingVWires(params: SlopingVWiresParams): Wire[] {
  const h = params.height;

  const legLen = slopingVLegLength(params.length);
  const sinSlope = legLen > 0 ? Math.max(0, h - SLOPING_V_MIN_TIP_Z_M) / legLen : 0;
  const effectiveSlopeRad = Math.asin(Math.min(1, sinSlope));

  const legPointAt = createSlopingVLegPointCalculator(params, effectiveSlopeRad);

  const lambda = wavelengthMeters(params.frequency);
  const maxSegLen = lambda / SEGS_PER_WAVELENGTH;

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
