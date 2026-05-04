// The physical antenna wires (dipole + optional coax-shield feedline),
// rendered as thin cylinders between endpoints with a feed-point sphere at
// the centre of the dipole. Converts from the NEC-style coordinate system
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
  FEEDLINE_SHIELD_TAG,
  type Orientation,
} from '../../store/antennaStore';
import { THEME_COLORS } from '../../utils/themeColors';

interface DipoleWireProps {
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly feedlineId: string;
  readonly feedlineLength: number;
}

function necToScene(p: readonly [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

export function DipoleWire({
  length,
  height,
  orientation,
  wireRadius,
  segments,
  feedlineId,
  feedlineLength,
}: DipoleWireProps) {
  const theme = useAntennaStore((s) => s.theme);
  const balunEnabled = useAntennaStore((s) => s.balunEnabled);

  const rendered = useMemo(() => {
    // Build synthetic state just for the wire geometry. We reuse buildWires()
    // to keep the coordinate convention in one place.
    const wires = buildWires({
      length,
      height,
      orientation,
      wireRadius,
      segments,
      feedlineId,
      feedlineLength,
    });

    return wires.map((w, idx) => {
      const a = new THREE.Vector3(...necToScene(w.start));
      const b = new THREE.Vector3(...necToScene(w.end));
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const lengthScene = dir.length();
      // Guard against zero-length wires that would produce NaN quaternions.
      if (lengthScene < 1e-6) return null;
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const isFeedlineShield = w.tag === FEEDLINE_SHIELD_TAG;
      return {
        key: idx,
        tag: w.tag ?? DIPOLE_TAG,
        position: [mid.x, mid.y, mid.z] as [number, number, number],
        quaternion: q,
        length: lengthScene,
        // The shield is rendered slightly slimmer than the dipole so the
        // user can visually distinguish them. Both still get the cosmetic
        // scale-up that keeps them visible at any zoom level.
        radius: Math.max(w.radius * (isFeedlineShield ? 6 : 8), isFeedlineShield ? 0.025 : 0.03),
        // Endpoints in scene coordinates, used for the rig marker.
        sceneStart: [a.x, a.y, a.z] as [number, number, number],
        sceneEnd: [b.x, b.y, b.z] as [number, number, number],
        feedMid: [mid.x, mid.y, mid.z] as [number, number, number],
        isFeedlineShield,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [length, height, orientation, wireRadius, segments, feedlineId, feedlineLength]);

  const dipole = rendered.find((s) => s.tag === DIPOLE_TAG);
  const shield = rendered.find((s) => s.tag === FEEDLINE_SHIELD_TAG);

  return (
    <group>
      {rendered.map((s) => (
        <mesh key={s.key} position={s.position} quaternion={s.quaternion}>
          <cylinderGeometry args={[s.radius, s.radius, s.length, 16]} />
          <meshStandardMaterial
            color={THEME_COLORS[theme].wire}
            emissive={THEME_COLORS[theme].wire}
            emissiveIntensity={s.isFeedlineShield ? 0.08 : 0.15}
            metalness={0.85}
            roughness={s.isFeedlineShield ? 0.55 : 0.35}
          />
        </mesh>
      ))}
      {dipole && (
        <mesh position={dipole.feedMid}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color={THEME_COLORS[theme].feedpoint}
            emissive={THEME_COLORS[theme].feedpoint}
            emissiveIntensity={0.4}
          />
        </mesh>
      )}
      {shield && balunEnabled && (
        // Choke balun marker: a small torus near the top of the shield wire
        // (immediately below the antenna feedpoint).
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
    </group>
  );
}
