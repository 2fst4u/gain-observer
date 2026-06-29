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


function useSceneConfiguration(snapshot: ComparisonSnapshot | null) {
  const store = useAntennaStore(useShallow((s) => ({
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
    liveVAngle: s.vAngle,
    liveLegSlope: s.legSlope,
    liveFoldedDipoleAperture: s.foldedDipoleAperture,
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

  const type = snapshot?.antennaType ?? store.liveType;
  const length = snapshot?.length ?? store.liveLength;
  const height = snapshot?.height ?? store.liveHeight;
  const orientation = snapshot?.orientation ?? store.liveOrientation;
  const wireRadius = snapshot?.wireRadius ?? store.liveWireRadius;
  const segments = snapshot?.segments ?? store.liveSegments;
  const groundId = snapshot?.groundId ?? store.liveGroundId;
  const result = snapshot?.result ?? store.liveResult;
  const feedlineId = snapshot?.feedlineId ?? store.liveFeedlineId;
  const feedlineLength = snapshot?.feedlineLength ?? store.liveFeedlineLength;
  const feedlineOffset = snapshot?.feedlineOffset ?? store.liveFeedlineOffset;
  const whipCounterpoise = snapshot?.whipCounterpoise ?? store.liveWhipCounterpoise;
  const vAngle = snapshot?.vAngle ?? store.liveVAngle;
  const legSlope = snapshot?.legSlope ?? store.liveLegSlope;
  const foldedDipoleAperture = snapshot?.foldedDipoleAperture ?? store.liveFoldedDipoleAperture;
  const frequency = snapshot?.frequency ?? store.liveFrequency;

  // Scale the pattern bubble to realized gain: the gain actually delivered after
  // feedpoint mismatch (and any transformer/ATU) loss. The offset is realizedGain
  // − gain, the same constant the stats readout applies. Comparison snapshots
  // don't capture transformer/ATU settings, so they fall back to plain realized
  // gain.
  const realizedGainOffsetDb = useMemo(() => {
    if (!result || result.maxRealizedGainDbi == null) return 0;
    const { displayedRealizedGainDbi } = displayedFeedMetrics(result, {
      transformerEnabled: snapshot ? false : store.liveTransformerEnabled,
      transformerRatio: snapshot ? 1 : store.liveTransformerRatio,
      feedlineActive: feedlineId !== 'none',
      atu: snapshot ? undefined : selectAtuConfig({
        atuEnabled: store.liveAtuEnabled,
        frequency,
        feedlineId,
        feedlineLength,
        atuMainFeedlineLength: store.liveAtuMainFeedlineLength,
      }),
    });
    return displayedRealizedGainDbi != null ? displayedRealizedGainDbi - result.maxGainDbi : 0;
  }, [
    result,
    snapshot,
    store.liveTransformerEnabled,
    store.liveTransformerRatio,
    feedlineId,
    feedlineLength,
    store.liveAtuEnabled,
    frequency,
    store.liveAtuMainFeedlineLength,
  ]);

  return {
    type,
    length,
    height,
    orientation,
    wireRadius,
    segments,
    groundId,
    result,
    feedlineId,
    feedlineLength,
    feedlineOffset,
    whipCounterpoise,
    vAngle,
    legSlope,
    foldedDipoleAperture,
    frequency,
    realizedGainOffsetDb,
    showGrid: store.showGrid,
    showAxes: store.showAxes,
    patternScale: store.patternScale,
    dbRange: store.dbRange,
    colorMaxDb: store.colorMaxDb,
    colormap: store.colormap,
    theme: store.theme,
  };
}

function SceneContents({ snapshot = null }: AntennaSceneProps) {
  const config = useSceneConfiguration(snapshot);

  return (
    <>
      <color attach="background" args={[THEME_COLORS[config.theme].background]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[15, 25, 10]} intensity={1.15} castShadow />
      <directionalLight position={[-10, 8, -8]} intensity={0.45} />

      <Suspense fallback={null}>
        <GroundPlane groundId={config.groundId} height={config.height} showGrid={config.showGrid} antennaType={config.type} />
        <AntennaWire
          type={config.type}
          length={config.length}
          height={config.height}
          orientation={config.orientation}
          wireRadius={config.wireRadius}
          segments={config.segments}
          feedlineId={config.feedlineId}
          feedlineLength={config.feedlineLength}
          feedlineOffset={config.feedlineOffset}
          whipCounterpoise={config.whipCounterpoise}
          vAngle={config.vAngle}
          legSlope={config.legSlope}
          frequency={config.frequency}
          foldedDipoleAperture={config.foldedDipoleAperture}
        />
        <RadiationPattern
          result={config.result}
          originY={config.type === 'inverted-l' ? 0 : config.height}
          patternScale={config.patternScale}
          dbRange={config.dbRange}
          colorMaxDb={config.colorMaxDb}
          colormap={config.colormap}
          realizedGainOffsetDb={config.realizedGainOffsetDb}
        />
      </Suspense>

      {config.showAxes && <axesHelper args={[6]} />}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, config.height, 0]}
      />
      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewport axisColors={['#ff4466', '#44cc66', '#4488ff']} labelColor="white" />
      </GizmoHelper>
    </>
  );
}

export function AntennaScene({ snapshot = null }: AntennaSceneProps) {
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
      <SceneContents snapshot={snapshot} />
    </Canvas>
  );
}
