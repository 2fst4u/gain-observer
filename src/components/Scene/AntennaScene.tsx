// The 3D canvas: camera + controls + lights + antenna + ground + pattern.
//
// Scene convention (Y-up):
//   +X = east along dipole EW axis
//   +Y = up (altitude)
//   +Z = south (we remap from NEC's +Y north)

import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { AntennaWire } from './AntennaWire';
import { GroundPlane } from './GroundPlane';
import { RadiationPattern } from './RadiationPattern';
import { useAntennaStore, selectAtuConfig, type ComparisonSnapshot } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { displayedFeedMetrics } from '../../physics/impedance';
import { THEME_COLORS } from '../../utils/themeColors';

interface AntennaSceneProps {
  readonly snapshot?: ComparisonSnapshot | null;
}

export function AntennaScene({ snapshot = null }: AntennaSceneProps) {
  const {
    liveType,
    liveLength,
    liveHeight,
    liveOrientation,
    liveWireRadius,
    liveSegments,
    liveGroundId,
    liveResult,
    liveFeedlineId,
    liveFeedlineLength,
    liveFeedlineOffset,
    liveWhipCounterpoise,
    liveTransformerEnabled,
    liveTransformerRatio,
    liveFrequency,
    liveAtuEnabled,
    liveAtuMainFeedlineLength,
    showGrid,
    showAxes,
    patternScale,
    dbRange,
    colorMaxDb,
    colormap,
    theme,
  } = useAntennaStore(useShallow((s) => ({
    liveType: s.antennaType,
    liveLength: s.length,
    liveHeight: s.height,
    liveOrientation: s.orientation,
    liveWireRadius: s.wireRadius,
    liveSegments: s.segments,
    liveGroundId: s.groundId,
    liveResult: s.result,
    liveFeedlineId: s.feedlineId,
    liveFeedlineLength: s.feedlineLength,
    liveFeedlineOffset: s.feedlineOffset,
    liveWhipCounterpoise: s.whipCounterpoise,
    liveTransformerEnabled: s.transformerEnabled,
    liveTransformerRatio: s.transformerRatio,
    liveFrequency: s.frequency,
    liveAtuEnabled: s.atuEnabled,
    liveAtuMainFeedlineLength: s.atuMainFeedlineLength,
    showGrid: s.showGrid,
    showAxes: s.showAxes,
    patternScale: s.patternScale,
    dbRange: s.dbRange,
    colorMaxDb: s.colorMaxDb,
    colormap: s.colormap,
    theme: s.theme,
  })));

  const type = snapshot?.antennaType ?? liveType;
  const length = snapshot?.length ?? liveLength;
  const height = snapshot?.height ?? liveHeight;
  const orientation = snapshot?.orientation ?? liveOrientation;
  const wireRadius = snapshot?.wireRadius ?? liveWireRadius;
  const segments = snapshot?.segments ?? liveSegments;
  const groundId = snapshot?.groundId ?? liveGroundId;
  const result = snapshot?.result ?? liveResult;
  const feedlineId = snapshot?.feedlineId ?? liveFeedlineId;
  const feedlineLength = snapshot?.feedlineLength ?? liveFeedlineLength;
  const feedlineOffset = snapshot?.feedlineOffset ?? liveFeedlineOffset;
  const whipCounterpoise = snapshot?.whipCounterpoise ?? liveWhipCounterpoise;

  // Scale the pattern bubble to realized gain: the gain actually delivered after
  // feedpoint mismatch (and any transformer/ATU) loss. The offset is realizedGain
  // − gain, the same constant the stats readout applies. Comparison snapshots
  // don't capture transformer/ATU settings, so they fall back to plain realized
  // gain.
  const realizedGainOffsetDb = useMemo(() => {
    if (!result || result.maxRealizedGainDbi == null) return 0;
    const { displayedRealizedGainDbi } = displayedFeedMetrics(result, {
      transformerEnabled: snapshot ? false : liveTransformerEnabled,
      transformerRatio: snapshot ? 1 : liveTransformerRatio,
      feedlineActive: feedlineId !== 'none',
      atu: snapshot ? undefined : selectAtuConfig({
        atuEnabled: liveAtuEnabled,
        frequency: liveFrequency,
        feedlineId,
        feedlineLength,
        atuMainFeedlineLength: liveAtuMainFeedlineLength,
      }),
    });
    return displayedRealizedGainDbi != null ? displayedRealizedGainDbi - result.maxGainDbi : 0;
  }, [result, snapshot, liveTransformerEnabled, liveTransformerRatio, feedlineId, feedlineLength, liveAtuEnabled, liveFrequency, liveAtuMainFeedlineLength]);

  return (
    <Canvas
      role="img"
      aria-label="Interactive 3D visualization of the HF antenna radiation pattern"
      camera={{ position: [18, 12, 22], fov: 45, near: 0.1, far: 1000 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      style={{ background: 'var(--bg-canvas)' }}
    >
      {/* SEO: R3F Canvas renders a WebGL node which is invisible to search engines.
          Adding role="img" and an aria-label provides critical context. */}
      <color attach="background" args={[THEME_COLORS[theme].background]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[15, 25, 10]} intensity={1.15} castShadow />
      <directionalLight position={[-10, 8, -8]} intensity={0.45} />

      <Suspense fallback={null}>
        <GroundPlane groundId={groundId} height={height} showGrid={showGrid} />
        <AntennaWire
          type={type}
          length={length}
          height={height}
          orientation={orientation}
          wireRadius={wireRadius}
          segments={segments}
          feedlineId={feedlineId}
          feedlineLength={feedlineLength}
          feedlineOffset={feedlineOffset}
          whipCounterpoise={whipCounterpoise}
        />
        <RadiationPattern
          result={result}
          originY={height}
          patternScale={patternScale}
          dbRange={dbRange}
          colorMaxDb={colorMaxDb}
          colormap={colormap}
          realizedGainOffsetDb={realizedGainOffsetDb}
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
