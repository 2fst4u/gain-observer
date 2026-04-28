// Ground plane visualisation. Hidden in free-space mode.
//
// The color hints at ground material (sea = blue, pastoral = brown, etc.).
// We draw a large grid on top for scale reference.

import { Grid } from '@react-three/drei';
const GROUND_COLORS: Record<string, string> = {
  sea: '#1d5980',
  fresh: '#2f7ca0',
  pastoral: '#3a3022',
  'dry-rocky': '#6a5a44',
  city: '#3f3f44',
  perfect: '#888888',
};

interface GroundPlaneProps {
  readonly groundId: string;
  readonly height: number;
  readonly showGrid: boolean;
}

export function GroundPlane({ groundId, height, showGrid }: GroundPlaneProps) {
  if (height <= 0 || groundId === 'free') return null;

  const color = GROUND_COLORS[groundId] ?? '#3a3022';

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {showGrid && (
        <Grid
          args={[400, 400]}
          cellSize={5}
          cellThickness={0.6}
          cellColor="#555"
          sectionSize={25}
          sectionThickness={1.2}
          sectionColor="#888"
          fadeDistance={120}
          fadeStrength={1}
          infiniteGrid
        />
      )}
    </group>
  );
}
