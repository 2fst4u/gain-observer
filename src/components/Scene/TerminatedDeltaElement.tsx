import { THEME_COLORS, type Theme } from '../../utils/themeColors';
import type { TerminatedDeltaSplitResult } from './useAntennaGeometry';

export interface TerminatedDeltaElementProps {
  split: TerminatedDeltaSplitResult;
  theme: Theme;
  terminatingResistor: number;
}

export function TerminatedDeltaElement({ split, theme, terminatingResistor }: TerminatedDeltaElementProps) {
  return (
    <>
      {/* Always show small marker spheres at each half-base inner end —
          makes the split-base topology unambiguously visible (without
          these the 0.1 m gap reads as a continuous base from a distance,
          which is the user-visible difference vs. a Delta Loop). */}
      <mesh position={split.leftInner}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial
          color={THEME_COLORS[theme].wire}
          emissive={THEME_COLORS[theme].wire}
          emissiveIntensity={0.2}
          metalness={0.8}
          roughness={0.4}
        />
      </mesh>
      <mesh position={split.rightInner}>
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
      {terminatingResistor > 0 && split.bridgeLen > 1e-3 && (
        <mesh
          position={split.bridgeMid}
          quaternion={split.bridgeQuat}
        >
          <cylinderGeometry args={[
            split.resistorRadius,
            split.resistorRadius,
            split.bridgeLen,
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
  );
}
