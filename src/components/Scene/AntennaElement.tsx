import type { RenderedWire } from './useAntennaGeometry';

export interface AntennaElementProps {
  wire: RenderedWire;
  color: string;
}

export function AntennaElement({ wire, color }: AntennaElementProps) {
  return (
    <mesh position={wire.position} quaternion={wire.quaternion}>
      <cylinderGeometry args={[wire.radius, wire.radius, wire.length, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={wire.isShield ? 0.08 : wire.isBridge ? 0.05 : 0.15}
        metalness={0.85}
        roughness={wire.isShield ? 0.55 : wire.isBridge ? 0.7 : 0.35}
      />
    </mesh>
  );
}
