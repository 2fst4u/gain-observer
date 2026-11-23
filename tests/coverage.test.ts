import { describe, expect, it } from 'vitest';
import { COVERAGE_BINS, COVERAGE_FLOOR_DB, computeCoverage, groundReflectionPower, mapCoverage } from '../src/physics/coverage';
import { sampleProfile, traceFan } from '../src/physics/ionosphere/raytrace';
import type { GainPattern } from '../src/physics/types';

const R = 6371;

// Isotropic upper hemisphere: 0 dBi at every elevation and bearing.
function isotropic(phiSteps = 8): GainPattern {
  const thetaSteps = 19;
  const data = new Float32Array(thetaSteps * phiSteps).fill(0);
  return { data, thetaSteps, phiSteps, dTheta: 5, dPhi: 360 / phiSteps };
}

// A thin dense layer at 300 km returns every ray at 7 MHz.
const mirrorFan = traceFan(sampleProfile((h) => (h >= 300 ? 50 : 0), 50, 1000, 0.05), 7, 0.25);

describe('ground reflection', () => {
  it('is total for a perfect conductor and at grazing incidence', () => {
    expect(groundReflectionPower({ sigma: Infinity, epsilon: 1 }, 7, 30)).toBe(1);
    expect(groundReflectionPower({ sigma: 0.005, epsilon: 13 }, 7, 0)).toBeCloseTo(1, 10);
  });

  it('matches the lossless normal-incidence Fresnel coefficient', () => {
    const eps = 9; // ((√ε − 1)/(√ε + 1))² = 0.25 for both polarisations
    expect(groundReflectionPower({ sigma: 0, epsilon: eps }, 7, 90)).toBeCloseTo(0.25, 10);
  });

  it('reflects more from sea than from dry ground at mid angles', () => {
    const sea = groundReflectionPower({ sigma: 5, epsilon: 81 }, 7, 20);
    const dry = groundReflectionPower({ sigma: 0.001, epsilon: 5 }, 7, 20);
    expect(sea).toBeGreaterThan(0.9);
    expect(dry).toBeLessThan(sea);
    expect(dry).toBeGreaterThan(0);
  });
});

describe('relative coverage map', () => {
  it('is the same at every bearing for an isotropic antenna', () => {
    const map = computeCoverage(isotropic(), mirrorFan, 7, { sigma: Infinity, epsilon: 1 }, 1)!;
    for (let bin = 0; bin < COVERAGE_BINS; bin++) {
      const first = map.relativeDb[bin]!;
      for (let s = 1; s < map.bearingsDeg.length; s++) {
        const value = map.relativeDb[s * COVERAGE_BINS + bin]!;
        if (Number.isFinite(first)) expect(value).toBeCloseTo(first, 9);
        else expect(value).toBe(first);
      }
    }
  });

  it('peaks near the antenna for an isotropic pattern and a mirror ionosphere', () => {
    // Ray-tube spreading: power per unit ground area falls with distance.
    const map = computeCoverage(isotropic(1), mirrorFan, 7, { sigma: Infinity, epsilon: 1 }, 1)!;
    expect(map.relativeDb[0]).toBe(0);
    const near = map.relativeDb[2]!, far = map.relativeDb[40]!;
    expect(near).toBeGreaterThan(far);
  });

  it('conserves the radiated power that lands, for one hop', () => {
    // Every ray returns from the mirror. An isotropic upper hemisphere sends
    // half the input power upward (∫cos ε dε over 0–90° × 2π / 4π = 1/2);
    // with a perfect ground and no cropping all of it lands.
    const map = mapCoverage(isotropic(1), mirrorFan, 7, { sigma: Infinity, epsilon: 1 }, 1, 4000)!;
    let landed = 0;
    for (let bin = 0; bin < COVERAGE_BINS; bin++) {
      const db = map.relativeDb[bin]!;
      if (!Number.isFinite(db)) continue;
      const area = 2 * Math.PI * R * R * (Math.cos(bin * map.binKm / R) - Math.cos((bin + 1) * map.binKm / R));
      landed += 10 ** (db / 10) * map.peakDensity * area;
    }
    // The fan's midpoint rule on cos ε at 0.25° is accurate to ~1e-5.
    expect(landed).toBeCloseTo(0.5, 4);
  });

  it('weakens each later hop by the ground reflection', () => {
    const at = (sigma: number, epsilon: number) => mapCoverage(isotropic(1), mirrorFan, 7, { sigma, epsilon }, 3, 9000)!;
    const perfect = at(Infinity, 1);
    const lossy = at(0.001, 5);
    // Absolute density: far cells, reached only by later hops, lose power to
    // each ground reflection.
    const absolute = (map: typeof perfect, bin: number) => 10 ** (map.relativeDb[bin]! / 10) * map.peakDensity;
    const farBin = COVERAGE_BINS - 4;
    expect(10 * Math.log10(absolute(lossy, farBin) / absolute(perfect, farBin))).toBeLessThan(-1);
    expect(lossy.dominantHops[farBin]).toBeGreaterThan(1);
    expect(lossy.dominantHops[0]).toBe(1);
  });

  it('leaves a skip zone empty when near-vertical rays escape', () => {
    // Parabolic F layer, foF2 5 MHz, at 7.1 MHz: steep rays pass through.
    const fan = traceFan(sampleProfile((h) => Math.sqrt(Math.max(0, 25 * (1 - ((h - 300) / 100) ** 2)))), 7.1, 0.25);
    const map = computeCoverage(isotropic(1), fan, 7.1, { sigma: Infinity, epsilon: 1 }, 1)!;
    const skipBins = Math.floor(400 / map.binKm);
    for (let bin = 0; bin < skipBins; bin++) expect(map.relativeDb[bin]).toBe(-Infinity);
    expect(Math.max(...Array.from(map.relativeDb))).toBe(0);
  });

  it('crops the map to where it is drawn', () => {
    const map = computeCoverage(isotropic(1), mirrorFan, 7, { sigma: 0.005, epsilon: 13 }, 3)!;
    const drawn = Array.from(map.relativeDb).map((db, bin) => (db >= COVERAGE_FLOOR_DB ? bin : -1));
    expect(Math.max(...drawn)).toBeGreaterThan(COVERAGE_BINS * 0.8);
  });
});
