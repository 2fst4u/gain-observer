import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useAdaptiveLOD } from '../../hooks/useAdaptiveLOD';
import type { SimulationResult } from '../../physics/types';
import type { Colormap } from '../../store/antennaStore';
import { pickTable, sampleColormapFast } from '../../utils/colormap';
import { DB_TO_LINEAR_POWER, radiusScaleForPattern } from './patternRadius';

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

interface CachedGeometry {
  basePositions: Float32Array;
  angles: Float32Array;
  count: number;
}

function createBaseGeometry(phiSegments: number, thetaSegments: number): CachedGeometry {
  const source = new THREE.SphereGeometry(1, phiSegments, thetaSegments).toNonIndexed();
  const positions = source.attributes.position as THREE.BufferAttribute;
  const basePositions = Float32Array.from(positions.array as Float32Array);
  const count = positions.count;
  const angles = new Float32Array(count * 2);
  const radToDeg = 180 / Math.PI;

  for (let i = 0; i < count; i++) {
    const x = basePositions[i * 3]!;
    const y = basePositions[i * 3 + 1]!;
    const z = basePositions[i * 3 + 2]!;

    // ⚡ Bolt: Performance Optimization
    // We avoid computing Math.sqrt because the base geometry is a unit sphere (r = 1).

    // Clamp y to [-1, 1] to prevent Math.acos from returning NaN due to float precision
    const acosArg = y > 1 ? 1 : y < -1 ? -1 : y;
    const thetaDeg = Math.acos(acosArg) * radToDeg;

    let phiDeg = Math.atan2(-z, x) * radToDeg;
    if (phiDeg < 0) phiDeg += 360;

    angles[i * 2] = thetaDeg;
    angles[i * 2 + 1] = phiDeg;
  }

  source.dispose();
  return { basePositions, angles, count };
}

function buildRenderGeometry(
  cachedGeo: CachedGeometry,
  result: SimulationResult,
  patternScale: number,
  dbRange: number,
  colorMaxDb: number,
  colormap: Colormap,
  realizedGainOffsetDb: number
): THREE.BufferGeometry {
  const { count, basePositions, angles } = cachedGeo;
  const { data, dTheta, dPhi, thetaSteps, phiSteps } = result.pattern;

  const posBuffer = new Float32Array(count * 3);
  const colorBuffer = new Float32Array(count * 4);

  const invDTheta = 1 / dTheta;
  const invDPhi = 1 / dPhi;
  const scaleFactor = DB_TO_LINEAR_POWER;

  // Peak of the pattern actually being drawn (realized-gain offset included).
  let peakDb = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    if (v > peakDb) peakDb = v;
  }
  peakDb += realizedGainOffsetDb;

  const { floorDb: radiusFloorDb, factor: linearRangeFactor } = radiusScaleForPattern(
    peakDb,
    dbRange,
    patternScale,
  );

  const minDb = colorMaxDb - dbRange;
  const invRange = 1 / dbRange;
  const table = pickTable(colormap);

  for (let i = 0; i < count; i++) {
    const thetaDeg = angles[i * 2]!;
    const phiDeg = angles[i * 2 + 1]!;

    // Inline bilinear interpolation into the NEC pattern grid.
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

    // ⚡ Bolt: Performance Optimization
    // Inline bilinear interpolation math optimized: changed v0 * (1 - t) + v1 * t to
    // v0 + (v1 - v0) * t. This saves one multiplication operation per interpolation per vertex.
    const v0 = v00 + (v01 - v00) * fp;
    const v1 = v10 + (v11 - v10) * fp;
    const gainDb = v0 + (v1 - v0) * ft + realizedGainOffsetDb;

    // Position
    const radius = Math.exp(Math.max(gainDb, radiusFloorDb) * scaleFactor) * linearRangeFactor;
    const idx = i * 3;
    posBuffer[idx] = basePositions[idx]! * radius;
    posBuffer[idx + 1] = basePositions[idx + 1]! * radius;
    posBuffer[idx + 2] = basePositions[idx + 2]! * radius;

    // Color
    const t = gainDb >= colorMaxDb ? 1 : gainDb <= minDb ? 0 : (gainDb - minDb) * invRange;
    const cidx = i * 4;
    sampleColormapFast(table, t, colorBuffer, cidx);
    colorBuffer[cidx + 3] = 1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posBuffer, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colorBuffer, 4));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
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
  const cachedGeo = useMemo(
    () => createBaseGeometry(lod.phiSegments, lod.thetaSegments),
    [lod.phiSegments, lod.thetaSegments]
  );

  // Build the complete render geometry in one pass.
  //
  // Previously this was split across five memos (vertexGains → vertexPositions
  // → vertexColors → positionedGeo → geometry) with the final two steps each
  // calling .clone() to attach new attributes to a copied geometry. That meant
  // two full geometry objects allocated and GC'd per result update.
  //
  // Now we allocate fresh typed arrays directly and attach them to a new
  // BufferGeometry — one allocation per update, no cloning. The combined loop
  // is negligible (<1 ms for ≤2k vertices); the partial-recompute benefit of
  // splitting positions and colors was outweighed by clone+GC overhead.
  const geometry = useMemo(() => {
    if (!result) return null;
    return buildRenderGeometry(
      cachedGeo,
      result,
      patternScale,
      dbRange,
      colorMaxDb,
      colormap,
      realizedGainOffsetDb
    );
  }, [result, patternScale, dbRange, colorMaxDb, colormap, realizedGainOffsetDb, cachedGeo]);

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
