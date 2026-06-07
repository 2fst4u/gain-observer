// The physical antenna wires (dipole + optional coax-shield feedline),
// rendered as thin cylinders between endpoints with a feed-point sphere at
// the antenna terminals. Converts from the NEC-style coordinate system
// (Z-up) used in the store to the R3F Y-up scene:
//   scene.x = nec.x
//   scene.y = nec.z
//   scene.z = -nec.y
//
// See RadiationPattern.tsx for the matching remap.

import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../../store/antennaStore';
import { THEME_COLORS } from '../../utils/themeColors';
import { useAntennaGeometry, type AntennaWireProps } from './useAntennaGeometry';

export function AntennaWire(props: AntennaWireProps) {
  const { theme, transformerEnabled, terminatingResistor } = useAntennaStore(useShallow((s) => ({
    theme: s.theme,
    transformerEnabled: s.transformerEnabled,
    terminatingResistor: s.terminatingResistor,
  })));

  const { rendered, shield, feedpoint, terminatedDeltaSplit } = useAntennaGeometry(props);
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
