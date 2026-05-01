import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useAdaptiveLOD } from '../../hooks/useAdaptiveLOD';
import type { SimulationResult } from '../../physics/types';
import type { Colormap, Mode } from '../../store/antennaStore';
import { gainToColorT, sampleColormap } from '../../utils/colormap';

interface Props {
  originY?: number;
  readonly result: SimulationResult | null;
  readonly patternScale: number;
  readonly dbRange: number;
  readonly colormap: Colormap;
  readonly mode: Mode;
}

function samplePatternDb(
  pattern: SimulationResult['pattern'],
  thetaDeg: number,
  phiDeg: number,
): number {
  const phi = ((phiDeg % 360) + 360) % 360;
  const theta = Math.max(0, Math.min(180, thetaDeg));

  const ti = theta / pattern.dTheta;
  const pi = phi / pattern.dPhi;

  const ti0 = Math.floor(ti);
  const ti1 = Math.min(ti0 + 1, pattern.thetaSteps - 1);
  const piFloor = Math.floor(pi);
  const pi0 = piFloor % pattern.phiSteps;
  const pi1 = (pi0 + 1) % pattern.phiSteps;

  const ft = ti - ti0;
  const fp = pi - piFloor;

  const row0 = ti0 * pattern.phiSteps;
  const row1 = ti1 * pattern.phiSteps;
  const v00 = pattern.data[row0 + pi0]!;
  const v01 = pattern.data[row0 + pi1]!;
  const v10 = pattern.data[row1 + pi0]!;
  const v11 = pattern.data[row1 + pi1]!;

  const v0 = v00 * (1 - fp) + v01 * fp;
  const v1 = v10 * (1 - fp) + v11 * fp;
  return v0 * (1 - ft) + v1 * ft;
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

  const geometry = useMemo(() => {
    if (!result) return null;

    const source = cachedGeo.source.clone();
    const positions = source.attributes.position as THREE.BufferAttribute;
    const positionArray = positions.array as Float32Array;
    const basePositions = cachedGeo.basePositions;
    const angles = cachedGeo.angles;
    const colorArray = new Float32Array(cachedGeo.count * 4);

    const linearRangeFactor = patternScale * 5;
    const maxDb = result.maxGainDbi;

    for (let i = 0; i < cachedGeo.count; i++) {
      const x = basePositions[i * 3]!;
      const y = basePositions[i * 3 + 1]!;
      const z = basePositions[i * 3 + 2]!;

      const thetaDeg = angles[i * 2]!;
      const phiDeg = angles[i * 2 + 1]!;

      const gainDb = samplePatternDb(result.pattern, thetaDeg, phiDeg);
      const linear = Math.pow(10, (gainDb - maxDb) / 20);
      const radius = linear * linearRangeFactor;

      let t = gainToColorT(gainDb, maxDb, dbRange);
      if (mode === 'nvis' && thetaDeg < 30) {
        t = Math.min(1, t + 0.1);
      }
      const [cr, cg, cb] = sampleColormap(colormap, t);

      positionArray[i * 3] = x * radius;
      positionArray[i * 3 + 1] = y * radius;
      positionArray[i * 3 + 2] = z * radius;
      colorArray[i * 4] = cr;
      colorArray[i * 4 + 1] = cg;
      colorArray[i * 4 + 2] = cb;
      // Firefox is correctly handling color attributes again when we provide
      // explicit RGBA vertex colors, while still letting us keep smooth per-
      // vertex interpolation across triangles.
      colorArray[i * 4 + 3] = 1;
    }

    source.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 4));
    positions.needsUpdate = true;
    source.attributes.color.needsUpdate = true;
    source.computeVertexNormals();
    source.computeBoundingSphere();
    return source;
  }, [result, cachedGeo, patternScale, dbRange, colormap, mode]);

  // Clean up cached geometry when unmounting
  useEffect(() => () => cachedGeo.source.dispose(), [cachedGeo]);
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
