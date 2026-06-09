// Ground plane visualisation. Hidden in free-space mode.
//
// The color hints at ground material (sea = blue, pastoral = brown, etc.).
// We draw a large grid on top for scale reference.

import { Grid } from '@react-three/drei';
import { useAntennaStore } from '../../store/antennaStore';
import { THEME_COLORS } from '../../utils/themeColors';

interface GroundPlaneProps {
  readonly groundId: string;
  readonly height: number;
  readonly showGrid: boolean;
  readonly antennaType: string;
}

export function GroundPlane({ groundId, height, showGrid, antennaType }: GroundPlaneProps) {
  const theme = useAntennaStore((s) => s.theme);
  // Vertical antennas extend upward from their base, so a height of 0 still
  // means a real, ground-mounted antenna and we keep the ground visible.
  // Horizontal antennas at height=0 are treated as free-space (no ground).
  const isVertical = antennaType === 'vertical-whip' || antennaType === 'inverted-l';
  const groundlessHeight = height <= 0 && !isVertical;
  if (groundlessHeight || groundId === 'free') return null;

  const colors = THEME_COLORS[theme].ground;
  const color = (colors as Record<string, string>)[groundId] ?? colors.pastoral;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial
          color={color}
          roughness={0.95}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      {showGrid && (
        <Grid
          args={[400, 400]}
          cellSize={5}
          cellThickness={1.0}
          cellColor={theme === 'dark' ? '#555' : '#aaa'}
          sectionSize={25}
          sectionThickness={2.0}
          sectionColor={theme === 'dark' ? '#888' : '#777'}
          fadeDistance={150}
          fadeStrength={5}
          infiniteGrid
        />
      )}
    </group>
  );
}
