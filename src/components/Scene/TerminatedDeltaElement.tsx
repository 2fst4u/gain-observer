import type { TerminatedDeltaSplitResult } from './useAntennaGeometry';

interface TerminatedDeltaElementProps {
  split: TerminatedDeltaSplitResult;
  color: string;
  terminatingResistor: number;
}

/**
 * The modelled gap is only FEED_BRIDGE_LENGTH_M (0.1 m), smaller than the
 * marker spheres, so the resistor is drawn at least this long, centred on the
 * gap, in the same spirit as its exaggerated thickness. Display only.
 */
export const RESISTOR_MIN_VISUAL_LENGTH_M = 0.6;

export function TerminatedDeltaElement({ split, color, terminatingResistor }: TerminatedDeltaElementProps) {
  const showResistor = terminatingResistor > 0 && split.bridgeLen > 1e-3;
  return (
    <>
      {/* Unterminated: small marker spheres at each half-base inner end make
          the open split visible (without them the 0.1 m gap reads as a
          continuous base from a distance, which is the user-visible
          difference vs. a Delta Loop). Terminated, the resistor marks it. */}
      {!showResistor && (<>
      <mesh position={split.leftInner}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.8}
          roughness={0.4}
        />
      </mesh>
      <mesh position={split.rightInner}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.2}
          metalness={0.8}
          roughness={0.4}
        />
      </mesh>
      </>)}

      {/* When terminated (R > 0): a resistor body across the gap between the
          two half-base inner ends, centred where they meet. This matches the
          NEC deck (one LD card on TERMINATED_DELTA_BRIDGE_TAG) and shows
          where the resistor sits: in series across the gap, not to ground. */}
      {showResistor && (
        <mesh
          position={split.bridgeMid}
          quaternion={split.bridgeQuat}
        >
          <cylinderGeometry args={[
            split.resistorRadius,
            split.resistorRadius,
            Math.max(split.bridgeLen, RESISTOR_MIN_VISUAL_LENGTH_M),
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
