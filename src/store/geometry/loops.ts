import { cleanZero } from "../../utils/math";
import { SLOPING_V_MIN_TIP_Z_M, wavelengthMeters, FEED_BRIDGE_LENGTH_M } from '../../physics/constants';
import type { Wire } from '../../physics/types';
import {
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  FEED_BRIDGE_TAG,
  DELTA_BASE_TAG,
  FEEDLINE_SHIELD_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  FOLDED_DIPOLE_OPPOSITE_TAG,
  FOLDED_DIPOLE_CONNECTOR_TAG,
} from '../../physics/tags';
import {
  SEGS_PER_WAVELENGTH,
  MIN_SEGS_PER_LEG,
  MAX_SEGS_PER_LEG,
  type Orientation,
  orientationVector,
  buildGradedStraightWires,
  safeSegs,
} from './common';

export interface FeedlineShield {
  readonly bottomZ: number;
  readonly radius: number;
  readonly segments: number;
}

export interface DeltaLoopWiresParams {
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  feedlineShield?: FeedlineShield | null;
}

export function calcSegs(length: number, lambda: number, userSegments: number, overrideMinSegs?: number): number {
  const minLegSegs = Math.ceil((SEGS_PER_WAVELENGTH * length) / lambda);
  return Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minLegSegs, overrideMinSegs ?? Math.round(userSegments)),
  );
}

export function calcApexSplit(
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

export interface FeedlineShieldWireOptions {
  wires: Wire[];
  feedlineShield: FeedlineShield | null | undefined;
  apexLeft: [number, number, number];
  apexRight: [number, number, number];
  wireRadius: number;
  bottomZ: number;
}

export function appendFeedlineShieldWires(options: FeedlineShieldWireOptions) {
  const { wires, feedlineShield, apexLeft, apexRight, wireRadius, bottomZ } = options;
  if (feedlineShield) {
    wires.push({
      start: apexLeft,
      end: apexRight,
      radius: wireRadius,
      segments: 1,
      tag: FEED_BRIDGE_TAG,
    });
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

export function calcDeltaLoopGeometry(perimeter: number, h: number) {
  const equilateralHeight = (perimeter * Math.sqrt(3)) / 6;
  const maxAvailable = Math.max(0, h - SLOPING_V_MIN_TIP_Z_M);
  const triHeight = Math.min(equilateralHeight, maxAvailable);

  const bottomZ = h - triHeight;

  const legLength = (triHeight * triHeight) / perimeter + perimeter / 4;
  const halfBase = perimeter / 4 - (triHeight * triHeight) / perimeter;

  return { triHeight, bottomZ, legLength, halfBase };
}

export function buildDeltaLoopWires(params: DeltaLoopWiresParams): Wire[] {
  const perimeter = params.length;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);

  const { bottomZ, legLength, halfBase } = calcDeltaLoopGeometry(perimeter, h);

  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;

  const { apexLeft, apexRight } = calcApexSplit(params.feedlineShield, bridgeHalf, dx, dy, h);

  const leftCorner: [number, number, number] = [-halfBase * dx, -halfBase * dy, bottomZ];
  const rightCorner: [number, number, number] = [halfBase * dx, halfBase * dy, bottomZ];

  const lambda = wavelengthMeters(params.frequency);

  const segmentsPerLeg = calcSegs(legLength, lambda, params.segments / 3);

  const baseLength = halfBase * 2;
  const rawBaseSegs = calcSegs(baseLength, lambda, params.segments / 3);
  const baseSegments = rawBaseSegs % 2 === 0 ? rawBaseSegs + 1 : rawBaseSegs;

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
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  feedlineShield?: FeedlineShield | null;
}

export function calcTerminatedDeltaPoints(halfBase: number, dx: number, dy: number, bottomZ: number) {
  const leftCorner: [number, number, number] = [-halfBase * dx, -halfBase * dy, bottomZ];
  const rightCorner: [number, number, number] = [halfBase * dx, halfBase * dy, bottomZ];

  const innerOffset = Math.max(0, FEED_BRIDGE_LENGTH_M / 2);
  const innerHalfBase = Math.max(0.01, halfBase - innerOffset);
  const centreLeft: [number, number, number] = [-innerOffset * dx, -innerOffset * dy, bottomZ];
  const centreRight: [number, number, number] = [innerOffset * dx, innerOffset * dy, bottomZ];

  return { leftCorner, rightCorner, centreLeft, centreRight, innerHalfBase };
}

export interface TerminatedDeltaLegWiresOptions {
  feedlineShield: FeedlineShield | null | undefined;
  wireRadius: number;
  apexLeft: [number, number, number];
  apexRight: [number, number, number];
  leftCorner: [number, number, number];
  rightCorner: [number, number, number];
  legLength: number;
  segmentsPerLeg: number;
}

export function buildTerminatedDeltaLegWires(opts: TerminatedDeltaLegWiresOptions): Wire[] {
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

export function buildTerminatedDeltaWires(params: TerminatedDeltaWiresParams): Wire[] {
  const perimeter = params.length;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);

  const { bottomZ, legLength, halfBase } = calcDeltaLoopGeometry(perimeter, h);

  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;

  const { apexLeft, apexRight } = calcApexSplit(params.feedlineShield, bridgeHalf, dx, dy, h);

  const { leftCorner, rightCorner, centreLeft, centreRight, innerHalfBase } = calcTerminatedDeltaPoints(
    halfBase, dx, dy, bottomZ
  );

  const lambda = wavelengthMeters(params.frequency);

  const segmentsPerLeg = calcSegs(legLength, lambda, params.segments / 3);
  const halfBaseSegments = calcSegs(innerHalfBase, lambda, params.segments / 6);

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

  const halfBaseMaxSegLen = innerHalfBase / halfBaseSegments;

  const wires: Wire[] = [
    ...legWires,
    ...buildGradedStraightWires({
      bridgeEnd: centreLeft,
      farEnd: leftCorner,
      wireRadius: params.wireRadius,
      tag: TERMINATED_DELTA_LEFT_BASE_TAG,
      maxSegLen: halfBaseMaxSegLen,
      emitFromFarEnd: true,
    }),
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

export function calcFoldedAntennaPoints(
  orientation: Orientation,
  h: number,
  half: number,
  aperture: number,
  bridgeHalf: number,
  gapHalf: number
) {
  const [dx, dy] = orientationVector(orientation);

  const zBottom = h;
  const zTop = h + aperture;

  const pt = (axis: number, z: number): [number, number, number] => [
    cleanZero(axis * dx),
    cleanZero(axis * dy),
    z,
  ];

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

export function calcFoldedTargetSegLen(frequency: number, aperture: number): number {
  const lambda = wavelengthMeters(frequency);
  return Math.max(1e-3, Math.min(lambda / SEGS_PER_WAVELENGTH, aperture / 2));
}

export function calcFoldedLegSegs(
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

export function calcFoldedAntennaSegments(
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

  const halfCondLen = Math.max(0.01, half - bridgeHalf);
  const halfSegs = calcFoldedLegSegs(halfCondLen, targetSegLen, MIN_SEGS_PER_LEG, userFloor, wireRadius);

  const halfOppLen = Math.max(0.01, half - gapHalf);
  const leftOppSegs = calcFoldedLegSegs(halfOppLen, targetSegLen, MIN_SEGS_PER_LEG, userFloor, wireRadius);
  const rightOppSegs = leftOppSegs;

  const connSegs = calcFoldedLegSegs(aperture, targetSegLen, 1, 1, wireRadius);

  return { halfSegs, leftOppSegs, rightOppSegs, connSegs };
}

export interface FoldedAntennaWiresParams {
  length: number;
  height: number;
  aperture: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  terminatingResistor?: number;
}

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
    createWire(pts.leftFed, pts.bridgeLeft, segs.halfSegs, LEFT_LEG_TAG),
    createWire(pts.bridgeLeft, pts.bridgeRight, 1, FEED_BRIDGE_TAG),
    createWire(pts.bridgeRight, pts.rightFed, segs.halfSegs, RIGHT_LEG_TAG),
    createWire(pts.leftOpp, pts.topCenterLeft, segs.leftOppSegs, FOLDED_DIPOLE_OPPOSITE_TAG),
    createWire(pts.topCenterRight, pts.rightOpp, segs.rightOppSegs, FOLDED_DIPOLE_OPPOSITE_TAG),
    createWire(pts.leftFed, pts.leftOpp, segs.connSegs, FOLDED_DIPOLE_CONNECTOR_TAG),
    createWire(pts.rightFed, pts.rightOpp, segs.connSegs, FOLDED_DIPOLE_CONNECTOR_TAG),
  ];
}
