import { useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import {
  useAntennaStore,
  buildWires,
  DIPOLE_TAG,
  DIPOLE_LEFT_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  VERTICAL_WHIP_TAG,
  type Orientation,
} from '../../store/antennaStore';
import type { AntennaType } from '../../physics/types';

export interface DipoleWireProps {
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
}

function necToScene(p: readonly [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

export function useDipoleGeometry({
  type,
  length,
  height,
  orientation,
  wireRadius,
  segments,
  feedlineId,
  feedlineLength,
  feedlineOffset,
  whipCounterpoise,
}: DipoleWireProps) {
  const {
    vAngle,
    legSlope,
    frequency,
    foldedDipoleAperture,
  } = useAntennaStore(useShallow((s) => ({
    vAngle: s.vAngle,
    legSlope: s.legSlope,
    frequency: s.frequency,
    foldedDipoleAperture: s.foldedDipoleAperture,
  })));

  const rendered = useMemo(() => {
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

    return wires.map((w, idx) => {
      const a = new THREE.Vector3(...necToScene(w.start));
      const b = new THREE.Vector3(...necToScene(w.end));
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const lengthScene = dir.length();
      if (lengthScene < 1e-6) return null;
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const tag = w.tag ?? DIPOLE_TAG;
      const isShield = tag === FEEDLINE_SHIELD_TAG;
      const isBridge = tag === FEED_BRIDGE_TAG;
      let radius: number;
      if (isShield) radius = Math.max(w.radius * 6, 0.025);
      else if (isBridge) radius = Math.max(w.radius * 4, 0.018);
      else radius = Math.max(w.radius * 8, 0.03);
      return {
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
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [type, length, height, orientation, wireRadius, segments, feedlineId, feedlineLength, feedlineOffset, vAngle, legSlope, frequency, whipCounterpoise, foldedDipoleAperture]);

  const { shield, feedpoint } = useMemo(() => {
    const isDelta = type === 'delta-loop' || type === 'terminated-delta';
    const isWhip = type === 'vertical-whip';

    let bridge: typeof rendered[0] | undefined;
    let dipoleSingle: typeof rendered[0] | undefined;
    let shieldWire: typeof rendered[0] | undefined;
    let apexFedLeft: typeof rendered[0] | undefined;
    let verticalWhip: typeof rendered[0] | undefined;

    // Single pass to locate all special elements.
    for (let i = 0; i < rendered.length; i++) {
      const s = rendered[i];
      if (s.isBridge && !bridge) bridge = s;
      if (s.isShield && !shieldWire) shieldWire = s;

      switch (s.tag) {
        case DIPOLE_TAG:
          if (!dipoleSingle) dipoleSingle = s;
          break;
        case DIPOLE_LEFT_TAG:
          if (isDelta && !apexFedLeft) apexFedLeft = s;
          break;
        case VERTICAL_WHIP_TAG:
          if (isWhip && !verticalWhip) verticalWhip = s;
          break;
      }

      if (
        bridge &&
        shieldWire &&
        dipoleSingle &&
        (!isDelta || apexFedLeft) &&
        (!isWhip || verticalWhip)
      ) {
        break;
      }
    }

    // If we have a bridge, the legacy dipole wire isn't the primary feed.
    const feedSingle = bridge ? undefined : dipoleSingle;

    // Feedpoint: bridge midpoint (split-fed) > apex-fed left-leg end >
    // vertical-whip base > dipole wire midpoint (single-wire legacy).
    const feedpointObj = bridge?.position
      ?? apexFedLeft?.sceneEnd
      ?? verticalWhip?.sceneStart
      ?? feedSingle?.position
      ?? null;

    return { shield: shieldWire, feedpoint: feedpointObj };
  }, [rendered, type]);

  const terminatedDeltaSplit = useMemo(() => {
    if (type !== 'terminated-delta') return null;
    let leftHalfBase: typeof rendered[0] | undefined;
    let rightHalfBase: typeof rendered[0] | undefined;

    // Single pass to locate the two half-base wires.
    for (let i = 0; i < rendered.length; i++) {
      const s = rendered[i];
      if (s.tag === TERMINATED_DELTA_LEFT_BASE_TAG && !leftHalfBase) leftHalfBase = s;
      if (s.tag === TERMINATED_DELTA_RIGHT_BASE_TAG && !rightHalfBase) rightHalfBase = s;
      if (leftHalfBase && rightHalfBase) break;
    }

    if (!leftHalfBase || !rightHalfBase) return null;
    const leftInner = leftHalfBase.sceneEnd;
    const rightInner = rightHalfBase.sceneStart;
    const bridgeMid: [number, number, number] = [
      (leftInner[0] + rightInner[0]) / 2,
      (leftInner[1] + rightInner[1]) / 2,
      (leftInner[2] + rightInner[2]) / 2,
    ];
    const bridgeLen = Math.hypot(
      rightInner[0] - leftInner[0],
      rightInner[1] - leftInner[1],
      rightInner[2] - leftInner[2],
    );
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
  }, [type, rendered, wireRadius]);

  return { rendered, shield, feedpoint, terminatedDeltaSplit };
}
