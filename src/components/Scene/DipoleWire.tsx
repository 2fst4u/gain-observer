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
import {
  useAntennaStore,
  buildWires,
  DIPOLE_TAG,
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  type Orientation,
  type AntennaType,
} from '../../store/antennaStore';
import { THEME_COLORS } from '../../utils/themeColors';

interface DipoleWireProps {
  readonly type: string;
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly feedlineId: string;
  readonly feedlineLength: number;
  readonly feedlineOffset: number;
  readonly vAngle?: number;
  readonly legSlope?: number;
  readonly terminatedEnabled?: boolean;
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
  vAngle,
  legSlope,
  terminatedEnabled,
}: DipoleWireProps) {
  const theme = useAntennaStore((s) => s.theme);

  const rendered = useMemo(() => {
    const wires = buildWires({
      type: type as AntennaType,
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
      terminatedEnabled: terminatedEnabled ?? false,
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
  }, [type, length, height, orientation, wireRadius, segments, feedlineId, feedlineLength, feedlineOffset, vAngle, legSlope, terminatedEnabled]);

  // Locate elements we want to decorate.
  const bridge = rendered.find((s) => s.isBridge);
  const dipoleSingle = rendered.find((s) => s.tag === DIPOLE_TAG && !bridge);
  const shield = rendered.find((s) => s.isShield);

  const apexWire = rendered.find((s) => s.tag === DIPOLE_LEFT_TAG);

  // The feedpoint is at the bridge midpoint when split, else at the dipole
  // wire's midpoint (legacy single-wire layout).
  let feedpoint = bridge?.feedMid ?? dipoleSingle?.feedMid ?? null;

  if (type !== 'dipole') {
    // V-shapes and delta loops are apex-fed. If a bridge exists, its midpoint
    // is the exact solver source; otherwise the left-leg endpoint is the apex.
    feedpoint = bridge?.feedMid ?? apexWire?.sceneEnd ?? feedpoint;
  }

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
      {shield && (
        // Rig marker at the bottom of the feedline (small box).
        <mesh position={shield.sceneEnd}>
          <boxGeometry args={[0.4, 0.25, 0.5]} />
          <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.15} metalness={0.6} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}
