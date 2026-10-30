import { describe, expect, it } from 'vitest';
import { averageGainLinear, directivityDbi } from '../src/physics/patternIntegral';
import type { GainPattern } from '../src/physics/types';

const THETA_STEPS = 37;
const PHI_STEPS = 72;

function pattern(fill: (thetaDeg: number, phiDeg: number) => number): GainPattern {
  const dTheta = 180 / (THETA_STEPS - 1);
  const dPhi = 360 / PHI_STEPS;
  const data = new Float32Array(THETA_STEPS * PHI_STEPS);
  for (let ti = 0; ti < THETA_STEPS; ti++) {
    for (let pi = 0; pi < PHI_STEPS; pi++) {
      data[ti * PHI_STEPS + pi] = fill(ti * dTheta, pi * dPhi);
    }
  }
  return { data, thetaSteps: THETA_STEPS, phiSteps: PHI_STEPS, dTheta, dPhi };
}

describe('averageGainLinear', () => {
  it('returns 1 for a lossless isotropic radiator', () => {
    // 0.06 % low: the trapezoidal ∫sinθ dθ on a 5° grid. That sets the floor
    // on how exactly any of these values can come back.
    expect(averageGainLinear(pattern(() => 0))).toBeCloseTo(1, 2);
  });

  it('tracks a uniform loss', () => {
    // Every direction 3.0103 dB down = half the power radiated.
    expect(averageGainLinear(pattern(() => -3.0103))).toBeCloseTo(0.5, 3);
  });

  it('uses the horizon as an endpoint only for a ground-supported pattern', () => {
    // 3 dBi above the horizon, nothing below: the classic perfect-ground
    // doubling. Directions NEC never computed come through as the parser's
    // large-negative sentinel.
    //
    const p = pattern((thetaDeg) => (thetaDeg <= 90 ? 3.0103 : -100));
    expect(Math.abs(averageGainLinear({ ...p, integrationThetaMaxDeg: 90 }) - 1)).toBeLessThan(0.001);
    // A free-space horizon is an interior sample and retains full weight.
    const freeSpace = pattern(() => 0);
    expect(Math.abs(averageGainLinear(freeSpace) - 1)).toBeLessThan(0.001);
  });

  it('integrates a perfect-ground short monopole without a fictitious horizon cell', () => {
    // G=3 sin²(theta) on the upper hemisphere has exactly unit average gain
    // and a 4.771 dBi peak. Nonzero horizon power exercises the boundary.
    for (const step of [15, 5, 1]) {
      const thetaSteps = 180 / step + 1;
      const phiSteps = 360 / step;
      const data = new Float32Array(thetaSteps * phiSteps);
      for (let ti = 0; ti < thetaSteps; ti++) {
        const gain = ti * step <= 90 ? 3 * Math.sin(ti * step * Math.PI / 180) ** 2 : 0;
        data.fill(gain > 0 ? 10 * Math.log10(gain) : -100, ti * phiSteps, (ti + 1) * phiSteps);
      }
      const p: GainPattern = { data, thetaSteps, phiSteps, dTheta: step, dPhi: step, integrationThetaMaxDeg: 90 };
      expect(averageGainLinear(p)).toBeCloseTo(1, 3);
      expect(directivityDbi(p, 10 * Math.log10(3))).toBeCloseTo(10 * Math.log10(3), 3);
    }
  });

  it('integrates a sin²θ (dipole-like) pattern to its analytic value', () => {
    // A short dipole has U ∝ sin²θ and D = 1.5, so a lossless one has
    // G(θ) = 1.5·sin²θ and ⟨G⟩ = 1.
    const p = pattern((thetaDeg) => {
      const s = Math.sin((thetaDeg * Math.PI) / 180);
      const g = 1.5 * s * s;
      return g > 0 ? 10 * Math.log10(g) : -100;
    });
    expect(averageGainLinear(p)).toBeCloseTo(1, 2);
    // …and the directivity recovered from a 1.76 dBi peak is 1.5 (1.76 dB).
    expect(directivityDbi(p, 10 * Math.log10(1.5))!).toBeCloseTo(10 * Math.log10(1.5), 1);
  });

  it('reports the extra loss a lossy ground takes out of the far field', () => {
    // G(θ) = A·cosθ over the upper hemisphere is a smooth stand-in for a
    // ground-reflected pattern; its directivity is exactly 4 (6.02 dBi)
    // whatever A is. Scaling it down by 1.2 dB — the share of the radiated
    // power a lossy soil absorbs — leaves the directivity untouched and drops
    // the gain, so D − G must come back as that 1.2 dB.
    //
    // This is the case NEC's POWER BUDGET cannot see: it reports η = 100 %
    // over soil, so the old D = G − 10·log10(η) form returned D = G exactly.
    const LOSS_DB = 1.2;
    const p = pattern((thetaDeg) => {
      const c = Math.cos((thetaDeg * Math.PI) / 180);
      return c > 0 ? 6.0206 - LOSS_DB + 10 * Math.log10(c) : -100;
    });
    const gain = 6.0206 - LOSS_DB;
    const d = directivityDbi(p, gain)!;
    expect(d).toBeCloseTo(6.0206, 1);
    expect(d - gain).toBeCloseTo(LOSS_DB, 1);
    expect(averageGainLinear(p)).toBeLessThan(1);
  });

  it('is defensive about degenerate patterns', () => {
    const empty: GainPattern = { data: new Float32Array(0), thetaSteps: 0, phiSteps: 0, dTheta: 5, dPhi: 5 };
    expect(averageGainLinear(empty)).toBe(0);
    expect(directivityDbi(empty, 3)).toBeUndefined();
    // A pattern that radiates nowhere cannot yield a directivity.
    expect(directivityDbi(pattern(() => -999), 0)).toBeUndefined();
  });
});
