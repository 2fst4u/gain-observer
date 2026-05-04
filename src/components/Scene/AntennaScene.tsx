// The 3D canvas: camera + controls + lights + antenna + ground + pattern.
//
// Scene convention (Y-up):
//   +X = east along dipole EW axis
//   +Y = up (altitude)
//   +Z = south (we remap from NEC's +Y north)

import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Suspense } from 'react';
import { DipoleWire } from './DipoleWire';
import { GroundPlane } from './GroundPlane';
import { RadiationPattern } from './RadiationPattern';
import { useAntennaStore, type ComparisonSnapshot } from '../../store/antennaStore';
import { THEME_COLORS } from '../../utils/themeColors';

interface AntennaSceneProps {
  readonly snapshot?: ComparisonSnapshot | null;
}

export function AntennaScene({ snapshot = null }: AntennaSceneProps) {
  const liveLength = useAntennaStore((s) => s.length);
  const liveHeight = useAntennaStore((s) => s.height);
  const liveOrientation = useAntennaStore((s) => s.orientation);
  const liveWireRadius = useAntennaStore((s) => s.wireRadius);
  const liveSegments = useAntennaStore((s) => s.segments);
  const liveGroundId = useAntennaStore((s) => s.groundId);
  const liveResult = useAntennaStore((s) => s.result);
  const liveFeedlineId = useAntennaStore((s) => s.feedlineId);
  const liveFeedlineLength = useAntennaStore((s) => s.feedlineLength);
  const showGrid = useAntennaStore((s) => s.showGrid);
  const showAxes = useAntennaStore((s) => s.showAxes);
  const patternScale = useAntennaStore((s) => s.patternScale);
  const dbRange = useAntennaStore((s) => s.dbRange);
  const colormap = useAntennaStore((s) => s.colormap);
  const mode = useAntennaStore((s) => s.mode);
  const theme = useAntennaStore((s) => s.theme);

  const length = snapshot?.length ?? liveLength;
  const height = snapshot?.height ?? liveHeight;
  const orientation = snapshot?.orientation ?? liveOrientation;
  const wireRadius = snapshot?.wireRadius ?? liveWireRadius;
  const segments = snapshot?.segments ?? liveSegments;
  const groundId = snapshot?.groundId ?? liveGroundId;
  const result = snapshot?.result ?? liveResult;
  const feedlineId = snapshot?.feedlineId ?? liveFeedlineId;
  const feedlineLength = snapshot?.feedlineLength ?? liveFeedlineLength;

  return (
    <Canvas
      camera={{ position: [18, 12, 22], fov: 45, near: 0.1, far: 1000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'var(--bg-canvas)' }}
    >
      <color attach="background" args={[THEME_COLORS[theme].background]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[15, 25, 10]} intensity={1.15} castShadow />
      <directionalLight position={[-10, 8, -8]} intensity={0.45} />

      <Suspense fallback={null}>
        <GroundPlane groundId={groundId} height={height} showGrid={showGrid} />
        <DipoleWire
          length={length}
          height={height}
          orientation={orientation}
          wireRadius={wireRadius}
          segments={segments}
          feedlineId={feedlineId}
          feedlineLength={feedlineLength}
        />
        <RadiationPattern
          result={result}
          originY={height}
          patternScale={patternScale}
          dbRange={dbRange}
          colormap={colormap}
          mode={mode}
        />
      </Suspense>

      {showAxes && <axesHelper args={[6]} />}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, height, 0]}
      />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ff4466', '#44cc66', '#4488ff']} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
