import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useAdaptiveLOD } from '../../hooks/useAdaptiveLOD';
import type { SimulationResult } from '../../physics/types';
import type { Colormap } from '../../store/antennaStore';
import { pickTable, sampleColormapFast } from '../../utils/colormap';

interface Props {
  originY?: number;
  readonly result: SimulationResult | null;
  readonly patternScale: number;
  readonly dbRange: number;
  readonly colorMaxDb: number;
  readonly colormap: Colormap;
  /**
   * Constant dB offset applied to every direction to turn the intrinsic gain
   * pattern into the realized-gain pattern (= realizedGain − gain). Mismatch
   * and insertion losses are direction-independent, so a single offset shrinks
   * the whole bubble uniformly to what actually reaches the air. Defaults to 0
   * (raw gain) when realized gain is unavailable.
   */
  readonly realizedGainOffsetDb?: number;
}

export function RadiationPattern({
  originY = 0,
  result,
  patternScale,
  dbRange,
  colorMaxDb,
  colormap,
  realizedGainOffsetDb = 0,
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
      const r = Math.sqrt(necX * necX + necY * necY + necZ * necZ);
      const thetaDeg = (Math.acos(necZ / r) * 180) / Math.PI;
      let phiDeg = (Math.atan2(necY, necX) * 180) / Math.PI;
      if (phiDeg < 0) phiDeg += 360;

      angles[i * 2] = thetaDeg;
      angles[i * 2 + 1] = phiDeg;
    }

    source.dispose();
    return { basePositions, angles, count };
  }, [lod.phiSegments, lod.thetaSegments]);

  // Stable mutable geometry — allocated once per LOD level, updated in-place.
  // This avoids two geometry clones per result update (previously positionedGeo
  // and geometry each called .clone(), triggering GC churn on every solve).
  const renderGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const { count } = cachedGeo;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4));
    return geo;
  }, [cachedGeo]);

  // Track whether the geometry has been populated at least once so we don't
  // render a zero-vertex mesh before the first effect fires.
  const [initialized, setInitialized] = useState(false);

  // Update geometry in-place whenever result or display parameters change.
  useEffect(() => {
    if (!result) return;
    const { count, basePositions, angles } = cachedGeo;
    const { data, dTheta, dPhi, thetaSteps, phiSteps } = result.pattern;

    const posAttr = renderGeo.attributes.position as THREE.Float32BufferAttribute;
    const colorAttr = renderGeo.attributes.color as THREE.Float32BufferAttribute;
    const posArray = posAttr.array as Float32Array;
    const colorArray = colorAttr.array as Float32Array;

    const invDTheta = 1 / dTheta;
    const invDPhi = 1 / dPhi;
    const linearRangeFactor = patternScale * 2.5;
    const scaleFactor = Math.LN10 / 20;

    const minDb = colorMaxDb - dbRange;
    const invRange = 1 / dbRange;
    const table = pickTable(colormap);

    for (let i = 0; i < count; i++) {
      const thetaDeg = angles[i * 2]!;
      const phiDeg = angles[i * 2 + 1]!;

      // Bilinear interpolation into the NEC pattern grid.
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
      const gainDb = v0 * (1 - ft) + v1 * ft + realizedGainOffsetDb;

      // Position
      const radius = Math.exp(gainDb * scaleFactor) * linearRangeFactor;
      const idx = i * 3;
      posArray[idx] = basePositions[idx]! * radius;
      posArray[idx + 1] = basePositions[idx + 1]! * radius;
      posArray[idx + 2] = basePositions[idx + 2]! * radius;

      // Color
      const t = gainDb >= colorMaxDb ? 1 : (gainDb <= minDb ? 0 : (gainDb - minDb) * invRange);
      const cidx = i * 4;
      sampleColormapFast(table, t, colorArray, cidx);
      colorArray[cidx + 3] = 1;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    renderGeo.computeVertexNormals();
    renderGeo.computeBoundingSphere();
    setInitialized(true);
  }, [result, patternScale, dbRange, colorMaxDb, colormap, realizedGainOffsetDb, cachedGeo, renderGeo]);

  // Dispose geometry on unmount.
  useEffect(() => () => renderGeo.dispose(), [renderGeo]);

  if (!result || !initialized) return null;

  return (
    <mesh position={[0, originY, 0]} geometry={renderGeo}>
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
