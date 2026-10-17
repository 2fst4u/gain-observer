import { cleanZero } from "../../utils/math";
import { FEED_BRIDGE_LENGTH_M } from '../../physics/constants';
import type { Wire } from '../../physics/types';
import { MAIN_WIRE_TAG, LEFT_LEG_TAG, RIGHT_LEG_TAG, FEED_BRIDGE_TAG } from '../../physics/tags';
import { type Orientation, orientationVector, buildGradedStraightWires } from './common';

export interface DipoleWiresParams {
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  layout: { offset: number; shield: { bottomZ: number; radius: number } | null } | null;
}

export function oddRound(v: number): number {
  const n = Math.max(1, Math.round(v));
  return n % 2 === 0 ? n + 1 : n;
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
