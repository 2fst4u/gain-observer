// The physical antenna wires (dipole + optional coax-shield feedline),
// rendered as thin cylinders between endpoints with a feed-point sphere at
// the antenna terminals. Converts from the NEC-style coordinate system
// (Z-up) used in the store to the R3F Y-up scene:
//   scene.x = nec.x
//   scene.y = nec.z
//   scene.z = -nec.y
//
// See RadiationPattern.tsx for the matching remap.
//
// Note: we subscribe to *individual* primitive fields from the store rather
// than calling buildWires(), because buildWires returns a fresh array on
// every store change. Using primitives keeps Zustand's default Object.is
// equality happy and avoids unnecessary re-renders.

import { useMemo } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import {
  useAntennaStore,
  buildWires,
  DIPOLE_TAG,
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  VERTICAL_WHIP_TAG,
  type Orientation,
} from '../../store/antennaStore';
import type { AntennaType } from '../../physics/types';
import { THEME_COLORS } from '../../utils/themeColors';

interface DipoleWireProps {
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

export function DipoleWire({
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
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    theme,
    transformerEnabled,
    vAngle,
    legSlope,
    frequency,
    terminatingResistor,
  } = useAntennaStore(useShallow((s) => ({
    theme: s.theme,
    transformerEnabled: s.transformerEnabled,
    vAngle: s.vAngle,
    legSlope: s.legSlope,
    frequency: s.frequency,
    terminatingResistor: s.terminatingResistor,
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
      const isDipoleHalf = tag === DIPOLE_LEFT_TAG || tag === DIPOLE_RIGHT_TAG || tag === DIPOLE_TAG;
      // Visual radius: keep the bridge nearly invisible (it's a 5cm
      // electrical token), the shield slightly slimmer than the dipole,
      // and the dipole at the original visibility scale.
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
        feedMid: [mid.x, mid.y, mid.z] as [number, number, number],
        isShield,
        isBridge,
        isDipoleHalf,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [type, length, height, orientation, wireRadius, segments, feedlineId, feedlineLength, feedlineOffset, vAngle, legSlope, frequency, whipCounterpoise]);

  // Locate elements we want to decorate.
  let bridge: typeof rendered[0] | undefined;
  let dipoleSingle: typeof rendered[0] | undefined;
  let shield: typeof rendered[0] | undefined;
  let apexFedLeft: typeof rendered[0] | undefined;
  let verticalWhip: typeof rendered[0] | undefined;
  let leftHalfBase: typeof rendered[0] | undefined;
  let rightHalfBase: typeof rendered[0] | undefined;

  const isDelta = type === 'delta-loop' || type === 'terminated-delta';
  const isTerminatedDelta = type === 'terminated-delta';
  const isWhip = type === 'vertical-whip';

  // Single pass to locate all special elements
  for (let i = 0; i < rendered.length; i++) {
    const s = rendered[i];
    if (s.isBridge && !bridge) {
      bridge = s;
    } else if (s.isShield && !shield) {
      shield = s;
    } else {
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
        case TERMINATED_DELTA_LEFT_BASE_TAG:
          if (isTerminatedDelta && !leftHalfBase) leftHalfBase = s;
          break;
        case TERMINATED_DELTA_RIGHT_BASE_TAG:
          if (isTerminatedDelta && !rightHalfBase) rightHalfBase = s;
          break;
      }
    }
  }

  // If we have a bridge, the legacy dipole wire isn't the primary feed.
  if (bridge) {
    dipoleSingle = undefined;
  }

  // Feedpoint: bridge midpoint (split-fed) > apex-fed left-leg end >
  // vertical-whip base > dipole wire midpoint (single-wire legacy).
  const feedpoint = bridge?.feedMid
    ?? apexFedLeft?.sceneEnd
    ?? verticalWhip?.sceneStart
    ?? dipoleSingle?.feedMid
    ?? null;

  // Terminated Delta: locate the two half-base inner ends so we can render
  // visible "split" markers (always) and the bridge-resistor decoration
  // (only when termination is active). The half-base wires are oriented:
  //   LEFT  half-base:  leftCorner  → centreLeft   → .sceneEnd is the inner end
  //   RIGHT half-base:  centreRight → rightCorner  → .sceneStart is the inner end
  // The bridge runs horizontally across the gap between the two inner ends;
  // the resistor sits on it.
  const terminatedDeltaSplit = useMemo(() => {
    if (type !== 'terminated-delta') return null;
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
  }, [type, leftHalfBase, rightHalfBase, wireRadius]);

  return (
    <group>
      {rendered.map((s) => (
        <mesh key={s.key} position={s.position} quaternion={s.quaternion}>
          <cylinderGeometry args={[s.radius, s.radius, s.length, 16]} />
          <meshStandardMaterial
            color={THEME_COLORS[theme].wire}
            emissive={THEME_COLORS[theme].wire}
            emissiveIntensity={s.isShield ? 0.08 : s.isBridge ? 0.05 : 0.15}
            metalness={0.85}
            roughness={s.isShield ? 0.55 : s.isBridge ? 0.7 : 0.35}
          />
        </mesh>
      ))}
      {feedpoint && (
        <mesh position={feedpoint}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color={THEME_COLORS[theme].feedpoint}
            emissive={THEME_COLORS[theme].feedpoint}
            emissiveIntensity={0.4}
          />
        </mesh>
      )}
      {shield && transformerEnabled && (
        // Transformer/choke marker: a small torus near the top of the
        // shield wire (immediately below the antenna feedpoint). Any
        // transformer ratio — including 1:1 — engages the choke.
        <mesh
          position={[
            shield.sceneStart[0],
            shield.sceneStart[1] - Math.min(0.4, Math.max(0.15, shield.length * 0.05)),
            shield.sceneStart[2],
          ]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.18, 0.07, 12, 24]} />
          <meshStandardMaterial color="#cc8844" emissive="#cc8844" emissiveIntensity={0.3} />
        </mesh>
      )}
      {shield && (
        // Rig marker at the bottom of the feedline (small box).
        <mesh position={shield.sceneEnd}>
          <boxGeometry args={[0.4, 0.25, 0.5]} />
          <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.15} metalness={0.6} roughness={0.5} />
        </mesh>
      )}
      {terminatedDeltaSplit && (
        <>
          {/* Always show small marker spheres at each half-base inner end —
              makes the split-base topology unambiguously visible (without
              these the 0.1 m gap reads as a continuous base from a distance,
              which is the user-visible difference vs. a Delta Loop). */}
          <mesh position={terminatedDeltaSplit.leftInner}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial
              color={THEME_COLORS[theme].wire}
              emissive={THEME_COLORS[theme].wire}
              emissiveIntensity={0.2}
              metalness={0.8}
              roughness={0.4}
            />
          </mesh>
          <mesh position={terminatedDeltaSplit.rightInner}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial
              color={THEME_COLORS[theme].wire}
              emissive={THEME_COLORS[theme].wire}
              emissiveIntensity={0.2}
              metalness={0.8}
              roughness={0.4}
            />
          </mesh>

          {/* When terminated (R > 0): render a horizontal resistor body
              bridging the gap between the two half-base inner ends. This
              matches the NEC deck (one LD card on TERMINATED_DELTA_BRIDGE_TAG)
              and gives the user a clear visual of "where the resistor sits"
              — across the gap, not to ground. */}
          {terminatingResistor > 0 && terminatedDeltaSplit.bridgeLen > 1e-3 && (
            <mesh
              position={terminatedDeltaSplit.bridgeMid}
              quaternion={terminatedDeltaSplit.bridgeQuat}
            >
              <cylinderGeometry args={[
                terminatedDeltaSplit.resistorRadius,
                terminatedDeltaSplit.resistorRadius,
                terminatedDeltaSplit.bridgeLen,
                12,
              ]} />
              <meshStandardMaterial
                color="#c93434"
                emissive="#c93434"
                emissiveIntensity={0.35}
                metalness={0.2}
                roughness={0.6}
              />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
