import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useAdaptiveLOD } from '../../hooks/useAdaptiveLOD';
import type { SimulationResult } from '../../physics/types';
import type { Colormap, Mode } from '../../store/antennaStore';
import { gainToColorT, pickTable, sampleColormapFast } from '../../utils/colormap';

interface Props {
  originY?: number;
  readonly result: SimulationResult | null;
  readonly patternScale: number;
  readonly dbRange: number;
  readonly colormap: Colormap;
  readonly mode: Mode;
}

export function RadiationPattern({
  originY = 0,
  result,
  patternScale,
  dbRange,
  colormap,
  mode,
}: Props) {
  const lod = useAdaptiveLOD();

  // Cache base geometry and expensive angle calculations per vertex,
  // which only depend on the LOD segments.
  const cachedGeo = useMemo(() => {
    const source = new THREE.SphereGeometry(1, lod.phiSegments, lod.thetaSegments).toNonIndexed();
    const positions = source.attributes.position as THREE.BufferAttribute;
    const basePositions = Float32Array.from(positions.array as Float32Array);
    const count = positions.count;
    const angles = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const x = basePositions[i * 3]!;
      const y = basePositions[i * 3 + 1]!;
      const z = basePositions[i * 3 + 2]!;
      const necZ = y;
      const necX = x;
      const necY = -z;
      const r = Math.hypot(necX, necY, necZ);
      const thetaDeg = (Math.acos(necZ / r) * 180) / Math.PI;
      let phiDeg = (Math.atan2(necY, necX) * 180) / Math.PI;
      if (phiDeg < 0) phiDeg += 360;

      angles[i * 2] = thetaDeg;
      angles[i * 2 + 1] = phiDeg;
    }

    return { source, basePositions, angles, count };
  }, [lod.phiSegments, lod.thetaSegments]);

  // 1. Cache the gain for each vertex. Only re-run if the simulation result
  //    or the LOD geometry (vertex count/angles) changes.
  const vertexGains = useMemo(() => {
    if (!result) return null;
    const { count, angles } = cachedGeo;
    const gains = new Float32Array(count);
    const { data, dTheta, dPhi, thetaSteps, phiSteps } = result.pattern;

    // Local optimization: avoid property lookups in the hot loop
    const invDTheta = 1 / dTheta;
    const invDPhi = 1 / dPhi;

    for (let i = 0; i < count; i++) {
      const thetaDeg = angles[i * 2]!;
      const phiDeg = angles[i * 2 + 1]!;

      // Inline and optimize samplePatternDb for the hot loop
      const phi = ((phiDeg % 360) + 360) % 360;
      const theta = thetaDeg < 0 ? 0 : thetaDeg > 180 ? 180 : thetaDeg;

      const ti = theta * invDTheta;
      const pi = phi * invDPhi;

      const ti0 = ti | 0;
      const ti1 = ti0 + 1 >= thetaSteps ? thetaSteps - 1 : ti0 + 1;
      const piFloor = pi | 0;
      const pi0 = piFloor % phiSteps;
      const pi1 = (pi0 + 1) % phiSteps;

      const ft = ti - ti0;
      const fp = pi - piFloor;

      const row0 = ti0 * phiSteps;
      const row1 = ti1 * phiSteps;
      const v00 = data[row0 + pi0]!;
      const v01 = data[row0 + pi1]!;
      const v10 = data[row1 + pi0]!;
      const v11 = data[row1 + pi1]!;

      const v0 = v00 * (1 - fp) + v01 * fp;
      const v1 = v10 * (1 - fp) + v11 * fp;
      gains[i] = v0 * (1 - ft) + v1 * ft;
    }
    return gains;
  }, [result, cachedGeo]);

  // 2. Compute vertex positions. Re-run if gains or pattern scale change.
  const vertexPositions = useMemo(() => {
    if (!result || !vertexGains) return null;
    const { count, basePositions } = cachedGeo;
    const positions = new Float32Array(count * 3);
    const linearRangeFactor = patternScale * 2.5;

    for (let i = 0; i < count; i++) {
      const gainDb = vertexGains[i]!;
      const linear = Math.pow(10, gainDb / 20);
      const radius = linear * linearRangeFactor;
      const idx = i * 3;
      positions[idx] = basePositions[idx]! * radius;
      positions[idx + 1] = basePositions[idx + 1]! * radius;
      positions[idx + 2] = basePositions[idx + 2]! * radius;
    }
    return positions;
  }, [vertexGains, patternScale, cachedGeo, result]);

  // 3. Compute vertex colors. Re-run if gains, colormap, or mode change.
  const vertexColors = useMemo(() => {
    if (!result || !vertexGains) return null;
    const { count, angles } = cachedGeo;
    const colors = new Float32Array(count * 4);
    const maxDb = result.maxGainDbi;

    // Fetch the colormap table outside the hot loop
    const table = pickTable(colormap);

    for (let i = 0; i < count; i++) {
      const gainDb = vertexGains[i]!;
      let t = gainToColorT(gainDb, maxDb, dbRange);
      if (mode === 'nvis' && angles[i * 2]! < 30) {
        t = Math.min(1, t + 0.1);
      }

      const idx = i * 4;
      sampleColormapFast(table, t, colors, idx);
      colors[idx + 3] = 1;
    }
    return colors;
  }, [vertexGains, colormap, dbRange, mode, cachedGeo, result]);

  // 4. Cache the geometry with positions and normals.
  // This avoids recomputing normals when only colors change.
  const positionedGeo = useMemo(() => {
    if (!vertexPositions) return null;
    const geo = cachedGeo.source.clone();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [cachedGeo, vertexPositions]);

  // 5. Final geometry with colors applied. Re-runs if colors change.
  const geometry = useMemo(() => {
    if (!positionedGeo || !vertexColors) return null;
    const geo = positionedGeo.clone();
    geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 4));
    return geo;
  }, [positionedGeo, vertexColors]);

  // Clean up cached geometry when unmounting
  useEffect(() => () => cachedGeo.source.dispose(), [cachedGeo]);
  useEffect(() => () => positionedGeo?.dispose(), [positionedGeo]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <mesh position={[0, originY, 0]} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        transparent
        opacity={0.9}
        metalness={0.02}
        roughness={0.7}
      />
    </mesh>
  );
}
