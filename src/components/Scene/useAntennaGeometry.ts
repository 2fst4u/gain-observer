import { useMemo } from 'react';
import * as THREE from 'three';
import {
  buildWires,
  MAIN_WIRE_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  VERTICAL_WHIP_TAG,
  INVERTED_L_VERTICAL_TAG,
  type Orientation,
} from '../../store/antennaStore';
import type { AntennaType } from '../../physics/types';

export interface AntennaWireProps {
  readonly type: AntennaType;
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly feedlineId: string;
  readonly feedlineLength: number;
  readonly feedlineOffset: number;
  readonly whipCounterpoise: boolean;
  readonly vAngle: number;
  readonly legSlope: number;
  readonly frequency: number;
  readonly foldedDipoleAperture: number;
}

export interface RenderedWire {
  readonly key: number;
  readonly tag: number;
  readonly position: [number, number, number];
  readonly quaternion: THREE.Quaternion;
  readonly length: number;
  readonly radius: number;
  readonly sceneStart: [number, number, number];
  readonly sceneEnd: [number, number, number];
  readonly isShield: boolean;
  readonly isBridge: boolean;
}

function necToScene(p: readonly [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

function useRenderedWires(props: AntennaWireProps): { rendered: RenderedWire[]; byTag: Map<number, RenderedWire> } {
  const {
    type,
    length,
    height,
    orientation,
    wireRadius,
    segments,
    feedlineId,
    feedlineLength,
    feedlineOffset,
    vAngle,
    legSlope,
    frequency,
    whipCounterpoise,
    foldedDipoleAperture,
  } = props;

  return useMemo(() => {
    const wires = buildWires({
      antennaType: type,
      length,
      height,
      orientation,
      wireRadius,
      segments,
      feedlineId,
      feedlineLength,
      feedlineOffset,
      vAngle,
      legSlope,
      frequency,
      whipCounterpoise,
      foldedDipoleAperture,
    });

    const out: RenderedWire[] = [];
    const byTag = new Map<number, RenderedWire>();
    for (let idx = 0; idx < wires.length; idx++) {
      const w = wires[idx]!;
      const a = new THREE.Vector3(...necToScene(w.start));
      const b = new THREE.Vector3(...necToScene(w.end));
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const lengthScene = dir.length();
      if (lengthScene < 1e-6) continue;
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const tag = w.tag ?? MAIN_WIRE_TAG;
      const isShield = tag === FEEDLINE_SHIELD_TAG;
      const isBridge = tag === FEED_BRIDGE_TAG;
      let radius: number;
      if (isShield) radius = Math.max(w.radius * 6, 0.025);
      else if (isBridge) radius = Math.max(w.radius * 4, 0.018);
      else radius = Math.max(w.radius * 8, 0.03);
      const wireObj = {
        key: idx,
        tag,
        position: [mid.x, mid.y, mid.z] as [number, number, number],
        quaternion: q,
        length: lengthScene,
        radius,
        sceneStart: [a.x, a.y, a.z] as [number, number, number],
        sceneEnd: [b.x, b.y, b.z] as [number, number, number],
        isShield,
        isBridge,
      };
      out.push(wireObj);
      if (!byTag.has(tag)) byTag.set(tag, wireObj);
    }
    return { rendered: out, byTag };
  }, [
    type,
    length,
    height,
    orientation,
    wireRadius,
    segments,
    feedlineId,
    feedlineLength,
    feedlineOffset,
    vAngle,
    legSlope,
    frequency,
    whipCounterpoise,
    foldedDipoleAperture,
  ]);
}

function useFeedpointAndShield(byTag: Map<number, RenderedWire>, type: AntennaType) {
  return useMemo(() => {
    const isDelta = type === 'delta-loop' || type === 'terminated-delta';
    const isWhip = type === 'vertical-whip';
    const isInvertedL = type === 'inverted-l';

    const bridge = byTag.get(FEED_BRIDGE_TAG);
    const shieldWire = byTag.get(FEEDLINE_SHIELD_TAG);
    const mainWireSingle = byTag.get(MAIN_WIRE_TAG);
    const apexFedLeft = isDelta ? byTag.get(MAIN_WIRE_TAG) : undefined;
    const verticalWhip = isWhip ? byTag.get(VERTICAL_WHIP_TAG) : undefined;
    const invertedLVertical = isInvertedL ? byTag.get(INVERTED_L_VERTICAL_TAG) : undefined;

    // If we have a bridge, the legacy dipole wire isn't the primary feed.
    const feedSingle = bridge ? undefined : mainWireSingle;

    // Feedpoint: bridge midpoint (split-fed) > apex-fed left-leg end >
    // vertical-whip base > inverted-l base > dipole wire midpoint (single-wire legacy).
    const feedpointObj =
      bridge?.position ??
      apexFedLeft?.sceneEnd ??
      verticalWhip?.sceneStart ??
      invertedLVertical?.sceneStart ??
      feedSingle?.position ??
      null;

    return { shield: shieldWire, feedpoint: feedpointObj };
  }, [byTag, type]);
}

export interface TerminatedDeltaSplitResult {
  leftInner: [number, number, number];
  rightInner: [number, number, number];
  bridgeMid: [number, number, number];
  bridgeLen: number;
  bridgeQuat: THREE.Quaternion;
  resistorRadius: number;
}

function useTerminatedDeltaSplit(
  byTag: Map<number, RenderedWire>,
  type: AntennaType,
  wireRadius: number
): TerminatedDeltaSplitResult | null {
  return useMemo(() => {
    if (type !== 'terminated-delta') return null;
    const leftHalfBase = byTag.get(TERMINATED_DELTA_LEFT_BASE_TAG);
    const rightHalfBase = byTag.get(TERMINATED_DELTA_RIGHT_BASE_TAG);

    if (!leftHalfBase || !rightHalfBase) return null;
    const leftInner = leftHalfBase.sceneEnd;
    const rightInner = rightHalfBase.sceneStart;
    const bridgeMid: [number, number, number] = [
      (leftInner[0] + rightInner[0]) / 2,
      (leftInner[1] + rightInner[1]) / 2,
      (leftInner[2] + rightInner[2]) / 2,
    ];
    const dx = rightInner[0] - leftInner[0];
    const dy = rightInner[1] - leftInner[1];
    const dz = rightInner[2] - leftInner[2];
    // ⚡ Bolt: Math.hypot is notoriously slow in V8 due to overflow/underflow checks.
    // We use Math.sqrt directly since these values are safe from float limits.
    const bridgeLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // Quaternion that points a +Y cylinder along the bridge direction.
    const bridgeQuat = new THREE.Quaternion();
    if (bridgeLen > 1e-9) {
      const dir = new THREE.Vector3(
        rightInner[0] - leftInner[0],
        rightInner[1] - leftInner[1],
        rightInner[2] - leftInner[2],
      ).normalize();
      bridgeQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    return {
      leftInner,
      rightInner,
      bridgeMid,
      bridgeLen,
      bridgeQuat,
      resistorRadius: Math.max(wireRadius * 8, 0.04),
    };
  }, [type, byTag, wireRadius]);
}

export function useAntennaGeometry(props: AntennaWireProps) {
  const { rendered, byTag } = useRenderedWires(props);
  const { shield, feedpoint } = useFeedpointAndShield(byTag, props.type);
  const terminatedDeltaSplit = useTerminatedDeltaSplit(byTag, props.type, props.wireRadius);

  return { rendered, shield, feedpoint, terminatedDeltaSplit };
}
