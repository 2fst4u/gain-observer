import {
  SLOPING_V_MIN_TIP_Z_M,
  wavelengthMeters,
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  FEED_BRIDGE_TAG,
  FEED_BRIDGE_LENGTH_M,
  DELTA_BASE_TAG,
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
 */
export const MAX_SEGS_PER_LEG = 100;

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

export function buildVBeamWires(params: SlopingVWiresParams): Wire[] {
  const h = params.height;
  const legLen = Math.max(0.1, params.length / 2);

  const [dx, dy] = orientationVector(params.orientation);
  const [px, py] = [-dy, dx];

  const halfV = ((params.vAngle / 2) * Math.PI) / 180;
  const cosV = Math.cos(halfV);
  const sinV = Math.sin(halfV);

  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  const leftTip: [number, number, number] = [
    cleanZero(dx * legLen * cosV - px * legLen * sinV),
    cleanZero(dy * legLen * cosV - py * legLen * sinV),
    h,
  ];
  const rightTip: [number, number, number] = [
    cleanZero(dx * legLen * cosV + px * legLen * sinV),
    cleanZero(dy * legLen * cosV + py * legLen * sinV),
    h,
  ];

  const lambda = wavelengthMeters(params.frequency);
  const minSegPerLeg = Math.ceil((SEGS_PER_WAVELENGTH * legLen) / lambda);
  const segmentsPerLeg = Math.min(
    MAX_SEGS_PER_LEG,
    Math.max(MIN_SEGS_PER_LEG, minSegPerLeg, Math.round(params.segments / 2)),
  );

  const bridgeHalf = FEED_BRIDGE_LENGTH_M / 2;

  const apexLeft: [number, number, number] = [
    cleanZero(-bridgeHalf * dx),
    cleanZero(-bridgeHalf * dy),
    h,
  ];
  const apexRight: [number, number, number] = [
    cleanZero(bridgeHalf * dx),
    cleanZero(bridgeHalf * dy),
    h,
  ];

  return [
    {
      start: leftTip,
      end: apexLeft,
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: apexRight,
      end: rightTip,
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

export interface DeltaLoopWiresParams {
  length: number; // perimeter
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
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

  const apex: [number, number, number] = [0, 0, h];
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

  return [
    {
      start: leftCorner,
      end: apex,
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: apex,
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
}
