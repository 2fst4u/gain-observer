import { useMemo } from 'react';
import * as THREE from 'three';
import { buildPhysicalWires, type Orientation } from '../../store/antennaStore';
import type { DeltaFeed } from '../../store/antennaGeometry';
import type { AntennaType } from '../../physics/types';
import { MAIN_WIRE_TAG, LEFT_LEG_TAG, FEED_BRIDGE_TAG, FEEDLINE_SHIELD_TAG, TERMINATED_DELTA_LEFT_BASE_TAG, TERMINATED_DELTA_RIGHT_BASE_TAG, VERTICAL_WHIP_TAG, INVERTED_L_VERTICAL_TAG } from '../../physics/tags';

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
  readonly designFrequency: number;
  readonly groundId: string;
  readonly terminatingResistor: number;
  readonly transformerEnabled: boolean;
  readonly foldedDipoleAperture: number;
  readonly yagiReflectorRatio?: number;
  readonly yagiDirectorRatio?: number;
  readonly deltaFeed?: DeltaFeed;
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
    designFrequency,
    groundId,
    terminatingResistor,
    whipCounterpoise,
    foldedDipoleAperture,
    yagiReflectorRatio,
    yagiDirectorRatio,
    deltaFeed,
  } = props;

  return useMemo(() => {
    let wires;
    try {
      wires = buildPhysicalWires({
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
      designFrequency,
      groundId,
      terminatingResistor,
      whipCounterpoise,
      foldedDipoleAperture,
      yagiReflectorRatio,
      yagiDirectorRatio,
      deltaFeed,
      });
    } catch {
      // The scheduler runs the same builder and reports its validation message.
      // Keep controls usable so correcting the geometry can recover the scene.
      return { rendered: [], byTag: new Map<number, RenderedWire>() };
    }

    const out: RenderedWire[] = [];
    const byTag = new Map<number, RenderedWire>();
    const vUp = new THREE.Vector3(0, 1, 0);
    const vDir = new THREE.Vector3();
    for (let idx = 0; idx < wires.length; idx++) {
      const w = wires[idx]!;
      const ax = w.start[0];
      const ay = w.start[2];
      const az = -w.start[1];
      const bx = w.end[0];
      const by = w.end[2];
      const bz = -w.end[1];
      const midx = (ax + bx) * 0.5;
      const midy = (ay + by) * 0.5;
      const midz = (az + bz) * 0.5;
      const dx = bx - ax;
      const dy = by - ay;
      const dz = bz - az;
      const lengthScene = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (lengthScene < 1e-6) continue;
      vDir.set(dx, dy, dz).normalize();
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(vUp, vDir);
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
        position: [midx, midy, midz] as [number, number, number],
        quaternion: q,
        length: lengthScene,
        radius,
        sceneStart: [ax, ay, az] as [number, number, number],
        sceneEnd: [bx, by, bz] as [number, number, number],
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
    designFrequency,
    groundId,
    terminatingResistor,
    whipCounterpoise,
    foldedDipoleAperture,
    yagiReflectorRatio,
    yagiDirectorRatio,
    deltaFeed,
  ]);
}

function useFeedpointAndShield(rendered: RenderedWire[], byTag: Map<number, RenderedWire>, type: AntennaType, deltaFeed: DeltaFeed | undefined) {
  return useMemo(() => {
    const isDelta = type === 'delta-loop' || type === 'terminated-delta';
    const isWhip = type === 'vertical-whip';
    const isInvertedL = type === 'inverted-l';

    const bridge = byTag.get(FEED_BRIDGE_TAG);
    const shieldWire = byTag.get(FEEDLINE_SHIELD_TAG);
    const mainWireSingle = byTag.get(MAIN_WIRE_TAG);
    const apexFedLeft = isDelta ? byTag.get(LEFT_LEG_TAG) : undefined;
    const verticalWhip = isWhip ? byTag.get(VERTICAL_WHIP_TAG) : undefined;
    const invertedLVertical = isInvertedL ? byTag.get(INVERTED_L_VERTICAL_TAG) : undefined;

    // If we have a bridge, the legacy dipole wire isn't the primary feed.
    const feedSingle = bridge ? undefined : mainWireSingle;

    // Feedpoint: bridge midpoint (split-fed) > apex-fed left-leg end >
    // vertical-whip base > inverted-l base > dipole wire midpoint (single-wire legacy).
    const feedpointObj =
      bridge?.position ??
      (type === 'delta-loop' && deltaFeed === 'corner' ? apexFedLeft?.sceneStart : apexFedLeft?.sceneEnd) ??
      verticalWhip?.sceneStart ??
      invertedLVertical?.sceneStart ??
      feedSingle?.position ??
      null;

    // A cable longer than the drop turns along the ground, so the rig sits at
    // the far end of the last shield wire rather than the bottom of the first.
    let shieldEnd = shieldWire?.sceneEnd;
    for (let i = rendered.length - 1; shieldWire && i >= 0; i--) {
      if (rendered[i]!.isShield) {
        shieldEnd = rendered[i]!.sceneEnd;
        break;
      }
    }

    return { shield: shieldWire, shieldEnd, feedpoint: feedpointObj };
  }, [rendered, byTag, type, deltaFeed]);
}

export interface TerminatedDeltaSplitResult {
  leftInner: [number, number, number];
  rightInner: [number, number, number];
  bridgeMid: [number, number, number];
  bridgeLen: number;
  bridgeQuat: THREE.Quaternion;
  resistorRadius: number;
}

/**
 * The two inner ends of the half-bases: the closest pair of endpoints, one
 * from each half-base. Each half-base is graded into several sub-wires
 * sharing a tag, emitted corner-first on the left and centre-first on the
 * right, so neither "first wire" nor "last wire" is safe to assume.
 */
function innerEnds(rendered: RenderedWire[]): [[number, number, number], [number, number, number]] | null {
  const ends = (tag: number) => rendered
    .filter((wire) => wire.tag === tag)
    .flatMap((wire) => [wire.sceneStart, wire.sceneEnd]);
  const left = ends(TERMINATED_DELTA_LEFT_BASE_TAG);
  const right = ends(TERMINATED_DELTA_RIGHT_BASE_TAG);
  let best: [[number, number, number], [number, number, number]] | null = null;
  let bestDistance = Infinity;
  for (const a of left) {
    for (const b of right) {
      const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = [a, b];
      }
    }
  }
  return best;
}

function useTerminatedDeltaSplit(
  rendered: RenderedWire[],
  type: AntennaType,
  wireRadius: number
): TerminatedDeltaSplitResult | null {
  return useMemo(() => {
    if (type !== 'terminated-delta') return null;
    const inner = innerEnds(rendered);
    if (!inner) return null;
    const [leftInner, rightInner] = inner;
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
  }, [type, rendered, wireRadius]);
}

export function useAntennaGeometry(props: AntennaWireProps) {
  const { rendered, byTag } = useRenderedWires(props);
  const { shield, shieldEnd, feedpoint } = useFeedpointAndShield(rendered, byTag, props.type, props.deltaFeed);
  const terminatedDeltaSplit = useTerminatedDeltaSplit(rendered, props.type, props.wireRadius);

  return { rendered, shield, shieldEnd, feedpoint, terminatedDeltaSplit };
}
