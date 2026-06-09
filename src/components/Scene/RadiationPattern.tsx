import { useEffect, useMemo } from 'react';
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
    const { count, basePositions, angles } = cachedGeo;
    const { data, dTheta, dPhi, thetaSteps, phiSteps } = result.pattern;

    const posBuffer = new Float32Array(count * 3);
    const colorBuffer = new Float32Array(count * 4);

    const invDTheta = 1 / dTheta;
    const invDPhi = 1 / dPhi;
    const linearRangeFactor = patternScale * 2.5;
    // 10^(x/20) = exp(x * ln(10)/20)
    const scaleFactor = Math.LN10 / 20;
    // Floor the gain used for radius calculation to ensure the pattern remains
    // visible even for extremely lossy antennas (e.g. verticals without a
    // counterpoise). At -25 dBi the bubble is ~0.15m radius, large enough to
    // peek out from the feedpoint marker.
    const RADIUS_GAIN_FLOOR_DBI = -25;
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

      const v0 = v00 * (1 - fp) + v01 * fp;
      const v1 = v10 * (1 - fp) + v11 * fp;
      const gainDb = v0 * (1 - ft) + v1 * ft + realizedGainOffsetDb;

      // Position
      const radius = Math.exp(Math.max(gainDb, RADIUS_GAIN_FLOOR_DBI) * scaleFactor) * linearRangeFactor;
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
