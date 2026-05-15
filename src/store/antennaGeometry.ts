import { DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG } from './antennaStore';
import type { Wire } from '../physics/types';
import { SLOPING_V_MIN_TIP_Z_M } from '../physics/constants';

export type OrientationPreset = 'EW' | 'NS' | 'NE-SW' | 'NW-SE';
export type Orientation = OrientationPreset | number;

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

export function buildInvertedVWires(params: InvertedVWiresParams): Wire[] {
  const half = params.length / 2;
  const h = params.height;
  const [dx, dy] = orientationVector(params.orientation);
  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  const requestedSlopeDeg = (180 - params.vAngle) / 2;
  const maxSin = half > 0 ? (h - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const requestedSlopeRad = (requestedSlopeDeg * Math.PI) / 180;
  const effectiveSlopeRad = Math.min(requestedSlopeRad, maxSlopeRad);

  const cosS = Math.cos(effectiveSlopeRad);
  const sinS = Math.sin(effectiveSlopeRad);

  function legPointAt(axis: number, side: number): [number, number, number] {
    const lx = axis * cosS * side;
    const lz = -axis * sinS;
    return [cleanZero(dx * lx), cleanZero(dy * lx), cleanZero(h + lz)];
  }

  const lambda = 299.792458 / params.frequency;
  const minSegPerLeg = Math.ceil(20 * half / lambda);
  const segmentsPerLeg = Math.max(9, minSegPerLeg, Math.round(params.segments / 2));

  return [
    {
      start: legPointAt(half, -1),
      end: legPointAt(0, 0),
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: legPointAt(0, 0),
      end: legPointAt(half, 1),
      radius: params.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_RIGHT_TAG,
    },
  ];
}
