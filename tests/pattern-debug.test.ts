// Reproduce the RadiationPattern geometry build outside of React, run NEC,
// then inspect the resulting color/position buffers.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { selectSimulationInput, useAntennaStore } from '../src/store/antennaStore';
import { gainToColorT, sampleColormap } from '../src/utils/colormap';
import type { GainPattern } from '../src/physics/types';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

function samplePatternDb(p: GainPattern, thetaDeg: number, phiDeg: number): number {
  const phi = ((phiDeg % 360) + 360) % 360;
  const theta = Math.max(0, Math.min(180, thetaDeg));
  const ti = theta / p.dTheta;
  const pi = phi / p.dPhi;
  const ti0 = Math.floor(ti);
  const ti1 = Math.min(ti0 + 1, p.thetaSteps - 1);
  const pi0 = Math.floor(pi) % p.phiSteps;
  const pi1 = (pi0 + 1) % p.phiSteps;
  const fT = ti - ti0;
  const fP = pi - Math.floor(pi);
  const v00 = p.data[ti0 * p.phiSteps + pi0]!;
  const v01 = p.data[ti0 * p.phiSteps + pi1]!;
  const v10 = p.data[ti1 * p.phiSteps + pi0]!;
  const v11 = p.data[ti1 * p.phiSteps + pi1]!;
  const v0 = v00 * (1 - fP) + v01 * fP;
  const v1 = v10 * (1 - fP) + v11 * fP;
  return v0 * (1 - fT) + v1 * fT;
}

describe('color buffer histogram', () => {
  it('shows distribution of vertex colors', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());
    const r = await engine.simulate(input);

    const geo = new THREE.SphereGeometry(1, 96, 48);
    const positions = geo.attributes.position as THREE.BufferAttribute;
    const basePositions = Float32Array.from(positions.array as ArrayLike<number>);
    const colorArray = new Float32Array(positions.count * 3);
    const dbRange = 30;
    const patternScale = 1;
    const linearRangeFactor = patternScale * 5;

    const histT = [0, 0, 0, 0, 0]; // bins
    let upperHemiSampleCount = 0;
    let lowerHemiSampleCount = 0;
    let upperGainSum = 0;
    let lowerGainSum = 0;

    for (let i = 0; i < positions.count; i++) {
      const bx = basePositions[i * 3]!;
      const by = basePositions[i * 3 + 1]!;
      const bz = basePositions[i * 3 + 2]!;
      const necZ = by;
      const necX = bx;
      const necY = -bz;
      const rUnit = Math.hypot(necX, necY, necZ);
      const thetaDeg = (Math.acos(necZ / rUnit) * 180) / Math.PI;
      let phiDeg = (Math.atan2(necY, necX) * 180) / Math.PI;
      if (phiDeg < 0) phiDeg += 360;
      const gainDb = samplePatternDb(r.pattern, thetaDeg, phiDeg);
      if (thetaDeg <= 90) { upperHemiSampleCount++; upperGainSum += gainDb; }
      else { lowerHemiSampleCount++; lowerGainSum += gainDb; }
      const t = gainToColorT(gainDb, r.maxGainDbi, dbRange);
      const bin = Math.min(4, Math.floor(t * 5));
      histT[bin]++;
      const [cr, cg, cb] = sampleColormap('viridis', t);
      colorArray[i * 3] = cr;
      colorArray[i * 3 + 1] = cg;
      colorArray[i * 3 + 2] = cb;
    }

    console.log('maxGainDbi', r.maxGainDbi);
    console.log('histT bins', histT);
    console.log('upper hemi', upperHemiSampleCount, 'avg gain', upperGainSum / upperHemiSampleCount);
    console.log('lower hemi', lowerHemiSampleCount, 'avg gain', lowerGainSum / lowerHemiSampleCount);
    // Sample a few colors
    console.log('color@0', [colorArray[0], colorArray[1], colorArray[2]]);
    const mid = Math.floor(positions.count / 2);
    console.log('color@mid', [colorArray[mid*3], colorArray[mid*3+1], colorArray[mid*3+2]]);
    expect(positions.count).toBeGreaterThan(0);
  }, 30_000);
});
