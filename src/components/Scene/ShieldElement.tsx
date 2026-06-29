import type { RenderedWire } from './useAntennaGeometry';

export interface ShieldElementProps {
  shield: RenderedWire;
  transformerEnabled: boolean;
}

export function ShieldElement({ shield, transformerEnabled }: ShieldElementProps) {
  return (
    <>
      {transformerEnabled && (
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
      {/* Rig marker at the bottom of the feedline (small box). */}
      <mesh position={shield.sceneEnd}>
        <boxGeometry args={[0.4, 0.25, 0.5]} />
        <meshStandardMaterial color="#444" emissive="#222" emissiveIntensity={0.15} metalness={0.6} roughness={0.5} />
      </mesh>
    </>
  );
}
