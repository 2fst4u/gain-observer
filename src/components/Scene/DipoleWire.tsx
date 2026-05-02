// The physical dipole wire, rendered as a thin cylinder between endpoints
// with a feed-point sphere at the centre. Converts from the NEC-style
// coordinate system (Z-up) used in the store to the R3F Y-up scene:
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
import { useAntennaStore, buildWires, type Orientation } from '../../store/antennaStore';
import { THEME_COLORS } from '../../utils/themeColors';

interface DipoleWireProps {
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
}

function necToScene(p: readonly [number, number, number]): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

export function DipoleWire({ length, height, orientation, wireRadius, segments }: DipoleWireProps) {
  const theme = useAntennaStore((s) => s.theme);
  const rendered = useMemo(() => {
    // Build synthetic state just for the wire geometry. We reuse buildWires()
    // to keep the coordinate convention in one place.
    const wires = buildWires({
      length,
      height,
      orientation,
      wireRadius,
      segments,
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
      return {
        key: idx,
        position: [mid.x, mid.y, mid.z] as [number, number, number],
        quaternion: q,
        length: lengthScene,
        radius: Math.max(w.radius * 8, 0.03), // cosmetic scale-up for visibility
        feed: [mid.x, mid.y, mid.z] as [number, number, number],
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [length, height, orientation, wireRadius, segments]);

  return (
    <group>
      {rendered.map((s) => (
        <group key={s.key}>
          <mesh position={s.position} quaternion={s.quaternion}>
            <cylinderGeometry args={[s.radius, s.radius, s.length, 16]} />
            <meshStandardMaterial
              color={THEME_COLORS[theme].wire}
              emissive={THEME_COLORS[theme].wire}
              emissiveIntensity={0.15}
              metalness={0.85}
              roughness={0.35}
            />
          </mesh>
          <mesh position={s.feed}>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial
              color={THEME_COLORS[theme].feedpoint}
              emissive={THEME_COLORS[theme].feedpoint}
              emissiveIntensity={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
