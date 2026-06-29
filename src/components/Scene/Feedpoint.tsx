import { THEME_COLORS, type Theme } from '../../utils/themeColors';

export interface FeedpointProps {
  position: [number, number, number];
  theme: Theme;
}

export function Feedpoint({ position, theme }: FeedpointProps) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshStandardMaterial
        color={THEME_COLORS[theme].feedpoint}
        emissive={THEME_COLORS[theme].feedpoint}
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}
