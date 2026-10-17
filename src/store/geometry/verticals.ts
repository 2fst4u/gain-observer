import { wavelengthMeters, VERTICAL_WHIP_BASE_GAP_M, VERTICAL_WHIP_RADIAL_COUNT } from '../../physics/constants';
import type { Wire } from '../../physics/types';
import {
  VERTICAL_WHIP_TAG,
  VERTICAL_WHIP_RADIAL_TAG,
  INVERTED_L_VERTICAL_TAG,
  INVERTED_L_HORIZONTAL_TAG,
  INVERTED_L_RADIAL_TAG,
} from '../../physics/tags';
import {
  SEGS_PER_WAVELENGTH,
  MIN_SEGS_PER_LEG,
  MAX_SEGS_PER_LEG,
  type Orientation,
  orientationVector,
  safeSegs,
} from './common';

export interface VerticalWhipWiresParams {
  length: number;
  height: number;
  wireRadius: number;
  segments: number;
  frequency: number;
  counterpoise: boolean;
}

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
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  frequency: number;
  counterpoise: boolean;
}

export function buildInvertedLWires(params: InvertedLWiresParams): Wire[] {
  const totalLen = Math.max(0.1, params.length);
  const baseZ = VERTICAL_WHIP_BASE_GAP_M;

  const maxVertLen = Math.max(0.1, params.height - baseZ);
  const vertLen = Math.min(totalLen, maxVertLen);
  const bendZ = baseZ + vertLen;

  const horizLen = Math.max(0, totalLen - vertLen);

  const [dx, dy] = orientationVector(params.orientation);
  const lambda = wavelengthMeters(params.frequency);

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
