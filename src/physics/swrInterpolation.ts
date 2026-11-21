// SWR between NEC frequency samples.
//
// The sweep solves NEC at a handful of evenly spaced frequencies (each real-
// ground point costs a Sommerfeld table, ~25 ms). Joining those samples with
// straight lines *in SWR* is a poor estimate: SWR is a folded, cusp-shaped
// function of frequency near resonance, so the true minimum usually lies
// between samples and the straight chord cuts it off. Against a 281-point NEC
// reference, 15 linearly joined samples misread the minimum SWR by up to 0.12
// and the 2:1 band edges by up to 4 kHz (dipole, inverted-V, whip, inverted-L,
// with and without coax).
//
// The reflection coefficient Γ(f) = (Z − Z0)/(Z + Z0) is smooth and analytic
// in frequency: an antenna near resonance traces an arc on the Smith chart and
// a feedline rotates it. A cubic Hermite (Catmull-Rom) spline through the
// complex Γ samples, with SWR derived from |Γ| afterwards, reduced the same
// errors to 0.006 SWR and 1.8 kHz using exactly the same NEC solves.
//
// The interpolated values are an estimate between solved points, not extra
// NEC results; sampled points pass through unchanged.

import { Z0_SYSTEM } from './constants';
import type { ImpedanceResult } from './types';

export interface SwrCurvePoint {
  readonly frequencyMHz: number;
  readonly swr: number;
}

/** Matches `swr()` in impedance.ts: total reflection is reported as 999. */
const SWR_CAP = 999;

function gammaOf(z: ImpedanceResult, z0: number): [number, number] {
  const nr = z.R - z0;
  const dr = z.R + z0;
  const d = dr * dr + z.X * z.X;
  if (d === 0) return [1, 0];
  return [(nr * dr + z.X * z.X) / d, (z.X * dr - nr * z.X) / d];
}

function swrFromGamma(re: number, im: number): number {
  const mag = Math.sqrt(re * re + im * im);
  if (!(mag < 1)) return SWR_CAP;
  return Math.min((1 + mag) / (1 - mag), SWR_CAP);
}

/**
 * Densify an evenly spaced impedance sweep into an SWR curve.
 *
 * `subdivisions` intervals are inserted between neighbouring samples (1 keeps
 * only the samples). Frequencies must be ascending and evenly spaced, as
 * produced by the engine's sweeps. Interior tangents are central differences,
 * end tangents one-sided.
 */
export function interpolateSwrCurve(
  frequenciesMHz: readonly number[],
  impedances: readonly ImpedanceResult[],
  subdivisions = 8,
  z0: number = Z0_SYSTEM,
): SwrCurvePoint[] {
  const n = Math.min(frequenciesMHz.length, impedances.length);
  if (n === 0) return [];
  const gr = new Float64Array(n);
  const gi = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    [gr[i], gi[i]] = gammaOf(impedances[i]!, z0);
  }
  const k = Math.max(1, Math.floor(subdivisions));
  if (n < 3 || k === 1) {
    return Array.from({ length: n }, (_, i) => ({ frequencyMHz: frequenciesMHz[i]!, swr: swrFromGamma(gr[i]!, gi[i]!) }));
  }

  const tangent = (g: Float64Array, i: number): number =>
    i === 0 ? g[1]! - g[0]! : i === n - 1 ? g[n - 1]! - g[n - 2]! : (g[i + 1]! - g[i - 1]!) / 2;

  const out: SwrCurvePoint[] = [];
  for (let i = 0; i < n - 1; i++) {
    const f0 = frequenciesMHz[i]!;
    const f1 = frequenciesMHz[i + 1]!;
    const mr0 = tangent(gr, i), mr1 = tangent(gr, i + 1);
    const mi0 = tangent(gi, i), mi1 = tangent(gi, i + 1);
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      const re = h00 * gr[i]! + h10 * mr0 + h01 * gr[i + 1]! + h11 * mr1;
      const im = h00 * gi[i]! + h10 * mi0 + h01 * gi[i + 1]! + h11 * mi1;
      out.push({ frequencyMHz: f0 + t * (f1 - f0), swr: swrFromGamma(re, im) });
    }
  }
  out.push({ frequencyMHz: frequenciesMHz[n - 1]!, swr: swrFromGamma(gr[n - 1]!, gi[n - 1]!) });
  return out;
}
