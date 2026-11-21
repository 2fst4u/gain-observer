import { describe, expect, it } from 'vitest';
import { interpolateSwrCurve } from '../src/physics/swrInterpolation';
import { swr } from '../src/physics/impedance';
import { findSwrBands } from '../src/physics/bandwidth';
import type { ImpedanceResult } from '../src/physics/types';

// Series-RLC antenna (R = 60 Ω, loaded Q = 12 at 7.15 MHz), optionally seen
// through a lossless 50 Ω line: an analytic stand-in for a NEC sweep.
function antennaZ(fMHz: number, lineLambdasAtF0 = 0): ImpedanceResult {
  const f0 = 7.15;
  const r = 60;
  const x = 12 * r * (fMHz / f0 - f0 / fMHz);
  if (lineLambdasAtF0 === 0) return { R: r, X: x };
  const t = Math.tan(2 * Math.PI * lineLambdasAtF0 * fMHz / f0);
  // Zin = Z0 (ZL + j Z0 t) / (Z0 + j ZL t), Z0 = 50.
  const nr = r, ni = x + 50 * t;
  const dr = 50 - x * t, di = r * t;
  const d = dr * dr + di * di;
  return { R: 50 * (nr * dr + ni * di) / d, X: 50 * (ni * dr - nr * di) / d };
}

function sample(n: number, line = 0) {
  const f = Array.from({ length: n }, (_, i) => 6.4 + (1.4 * i) / (n - 1));
  return { f, z: f.map((x) => antennaZ(x, line)) };
}

describe('interpolateSwrCurve', () => {
  it('passes through every solved sample', () => {
    const { f, z } = sample(15);
    const curve = interpolateSwrCurve(f, z, 8);
    expect(curve).toHaveLength(14 * 8 + 1);
    f.forEach((freq, i) => {
      expect(curve[i * 8]!.frequencyMHz).toBeCloseTo(freq, 12);
      expect(curve[i * 8]!.swr).toBeCloseTo(swr(z[i]!), 10);
    });
  });

  for (const line of [0, 0.7]) {
    it(`recovers the minimum and 2:1 edges between samples (line ${line} λ)`, () => {
      const dense = sample(2801, line);
      const truth = dense.f.map((x, i) => ({ f: x, s: swr(dense.z[i]!) }));
      const { f, z } = sample(15, line);
      const curve = interpolateSwrCurve(f, z, 16).map((p) => ({ f: p.frequencyMHz, s: p.swr }));
      const linear = f.map((x, i) => ({ f: x, s: swr(z[i]!) }));

      const min = (pts: { s: number }[]) => Math.min(...pts.map((p) => p.s));
      const edges = (pts: { f: number; s: number }[]) =>
        findSwrBands(pts, (p) => p.f, (p) => p.s, 2).flatMap((b) => [b.fLow, b.fHigh]);

      const trueEdges = edges(truth);
      expect(trueEdges.length).toBeGreaterThan(0);
      const splineEdges = edges(curve);
      expect(splineEdges).toHaveLength(trueEdges.length);
      const splineEdgeErr = Math.max(...splineEdges.map((e, i) => Math.abs(e - trueEdges[i]!)));
      const linearEdgeErr = Math.max(...edges(linear).map((e, i) => Math.abs(e - trueEdges[i]!)));

      expect(Math.abs(min(curve) - min(truth))).toBeLessThan(0.01);
      expect(splineEdgeErr).toBeLessThan(0.002); // 2 kHz
      // The straight-chord estimate it replaces is measurably worse.
      expect(Math.abs(min(linear) - min(truth))).toBeGreaterThan(Math.abs(min(curve) - min(truth)));
      expect(linearEdgeErr).toBeGreaterThan(splineEdgeErr);
    });
  }

  it('reports total reflection with the same 999 cap as swr()', () => {
    const curve = interpolateSwrCurve([7, 7.1, 7.2], [{ R: 0, X: 0 }, { R: 0, X: 0 }, { R: 0, X: 0 }], 4);
    expect(curve.every((p) => p.swr === 999)).toBe(true);
    expect(swr({ R: 0, X: 0 })).toBe(999);
  });

  it('returns samples unchanged when there are too few to interpolate', () => {
    expect(interpolateSwrCurve([], [])).toEqual([]);
    const two = interpolateSwrCurve([7, 7.1], [{ R: 50, X: 0 }, { R: 100, X: 0 }], 8);
    expect(two.map((p) => p.frequencyMHz)).toEqual([7, 7.1]);
    expect(two[1]!.swr).toBeCloseTo(2, 10);
  });
});
