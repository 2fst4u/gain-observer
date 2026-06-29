import { THEME_COLORS, type Theme } from '../../utils/themeColors';
import type { RenderedWire } from './useAntennaGeometry';

export interface AntennaElementProps {
  wire: RenderedWire;
  theme: Theme;
}

export function AntennaElement({ wire, theme }: AntennaElementProps) {
  return (
    <mesh position={wire.position} quaternion={wire.quaternion}>
      <cylinderGeometry args={[wire.radius, wire.radius, wire.length, 16]} />
      <meshStandardMaterial
        color={THEME_COLORS[theme].wire}
        emissive={THEME_COLORS[theme].wire}
        emissiveIntensity={wire.isShield ? 0.08 : wire.isBridge ? 0.05 : 0.15}
        metalness={0.85}
        roughness={wire.isShield ? 0.55 : wire.isBridge ? 0.7 : 0.35}
      />
    </mesh>
  );
}
