import { swr } from './impedance';
import { findSwrBands } from './bandwidth';
import type { ImpedanceResult, SimulationInput, SweepPoint } from './types';
import type { SweepOptions } from './nec2Engine';
import { SWEEP_F_MIN_MHZ, SWEEP_F_MAX_MHZ } from './constants';

export type SolveImpedanceSweepCallback = (
  input: SimulationInput,
  points: number,
  startFreq: number,
  step: number
) => Promise<{ impedance: ImpedanceResult | null; power: number | null }[]>;

export function clampSpan(freq: number, spanFraction: number): { start: number; end: number } {
  return {
    start: Math.max(SWEEP_F_MIN_MHZ, freq * (1 - spanFraction / 2)),
    end: Math.min(SWEEP_F_MAX_MHZ, freq * (1 + spanFraction / 2)),
  };
}

/** Run one fixed-window scan over [start, end] with `n` evenly-spaced points. */
export async function runScan(
  solveImpedanceSweep: SolveImpedanceSweepCallback,
  input: SimulationInput,
  start: number,
  end: number,
  n: number,
): Promise<SweepPoint[]> {
  const step = n > 1 ? (end - start) / (n - 1) : 0;
  const parsedResults = await solveImpedanceSweep(input, n, start, step);
  const sweep: SweepPoint[] = [];
  for (let i = 0; i < n; i++) {
    const frequencyMHz = i === n - 1 ? end : start + step * i;
    const parsed = parsedResults[i];
    if (!parsed?.impedance) {
      throw new Error(`NEC-2 sweep missing impedance result for frequency ${frequencyMHz} MHz`);
    }
    sweep.push({
      frequencyMHz,
      swr: swr(parsed.impedance),
      R: parsed.impedance.R,
      X: parsed.impedance.X,
    });
  }
  return sweep;
}

/**
 * Adaptive sweep: expands a coarse characterisation window until the
 * (display-effective) SWR rises above 2:1 on both sides of the minimum or
 * the HF band limits are reached, locates the 2:1 crossings, then re-sweeps
 * a window framed around that bandwidth (with margin) at full resolution.
 * The result fills the chart whether the antenna is sharply resonant or
 * broadband — no fixed span has to be guessed up-front.
 *
 * For multi-band antennas (e.g. terminated folded dipoles and end-feds
 * resonant on harmonics), a secondary broad characterisation scan across the
 * full HF range finds any additional ≤2:1 bands that fall outside the primary
 * scan window, so the final sweep frames all usable bands in one chart.
 */
export async function adaptiveSweep(
  solveImpedanceSweep: SolveImpedanceSweepCallback,
  input: SimulationInput,
  points: number,
  displayRatio: number,
  opts: Pick<SweepOptions, 'charPoints' | 'maxIter' | 'skipBroadScan'> = {},
): Promise<SweepPoint[]> {
  const CHAR_POINTS = Math.max(3, opts.charPoints ?? 11);
  const MAX_ITER = Math.max(1, opts.maxIter ?? 5);
  const SKIP_BROAD = opts.skipBroadScan ?? false;

  const f = input.frequencyMHz;
  // Effective SWR = what the user sees (after any display-only balun).
  const effSwr = (p: SweepPoint): number =>
    displayRatio > 1 ? swr({ R: p.R / displayRatio, X: p.X / displayRatio }) : p.swr;

  // Phase 1 — expand until both edges exceed 2:1, or we hit the band limits.
  let span = 0.1;
  const first = clampSpan(f, span);
  let scan = await runScan(solveImpedanceSweep, input, first.start, first.end, CHAR_POINTS);
  let reachedLimits = false;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const lowOK = effSwr(scan[0]!) > 2;
    const highOK = effSwr(scan[scan.length - 1]!) > 2;
    const atLimits =
      scan[0]!.frequencyMHz <= SWEEP_F_MIN_MHZ + 1e-9 && scan[scan.length - 1]!.frequencyMHz >= SWEEP_F_MAX_MHZ - 1e-9;
    if (atLimits) { reachedLimits = true; break; }
    if (lowOK && highOK) break;
    span *= 3;
    const { start, end } = clampSpan(f, span);
    scan = await runScan(solveImpedanceSweep, input, start, end, CHAR_POINTS);
  }

  const loEdge = scan[0]!.frequencyMHz;
  const hiEdge = scan[scan.length - 1]!.frequencyMHz;

  // Phase 2 — if the primary scan did not need to span the entire HF range
  // (the ≤2:1 band near f is fully bounded), sweep the full range once with
  // enough points to detect additional ≤2:1 bands that lie outside the
  // primary window. Bands found there (e.g. lower-band resonances of a TFD
  // or harmonic resonances of an EFHW) are merged with the primary bands so
  // the final frame includes all of them.

  // ⚡ Bolt: Avoid intermediate arrays by passing the scan array and accessors directly
  // to findSwrBands, significantly reducing memory allocation overhead and GC pressure.
  const primaryBands = findSwrBands(
    scan,
    (pt) => pt.frequencyMHz,
    (pt) => effSwr(pt),
    2,
  );

  // Frame the final sweep window around a set of ≤2:1 bands, keeping the
  // operating-frequency marker in view and clamping to the HF band limits.
  const frameWindow = (bands: ReturnType<typeof findSwrBands>): { start: number; end: number } => {
    let winStart: number;
    let winEnd: number;
    if (bands.length > 0) {
      const unionLow = bands[0]!.fLow;
      const unionHigh = bands[bands.length - 1]!.fHigh;
      const width = Math.max(unionHigh - unionLow, f * 0.02);
      const margin = Math.max(width * 0.25, f * 0.02);
      // When a band is clipped the actual crossing lies beyond the scan boundary.
      // Use the appropriate HF limit as the anchor on that side.
      const lowAnchor = bands[0]!.lowClipped
        ? (reachedLimits ? loEdge : SWEEP_F_MIN_MHZ)
        : unionLow;
      const highAnchor = bands[bands.length - 1]!.highClipped
        ? (reachedLimits ? hiEdge : SWEEP_F_MAX_MHZ)
        : unionHigh;
      winStart = lowAnchor - margin;
      winEnd = highAnchor + margin;
    } else {
      // Never dips below 2:1 within the explored window — show what we scanned.
      winStart = loEdge;
      winEnd = hiEdge;
    }
    winStart = Math.max(SWEEP_F_MIN_MHZ, Math.min(winStart, f));
    winEnd = Math.min(SWEEP_F_MAX_MHZ, Math.max(winEnd, f));
    if (!(winEnd > winStart)) {
      ({ start: winStart, end: winEnd } = clampSpan(f, 0.1));
    }
    return { start: winStart, end: winEnd };
  };

  // Width of the operating-frequency band — the primary band containing f, or
  // failing that the primary band nearest f. Used to protect that band's
  // resolution when deciding whether to widen the window for distant bands.
  const operatingBandWidth = ((): number => {
    if (primaryBands.length === 0) return f * 0.02;
    let band = primaryBands[0];
    let bestDistance = Infinity;
    for (let i = 0; i < primaryBands.length; i++) {
      const b = primaryBands[i];
      if (f >= b.fLow && f <= b.fHigh) {
        band = b;
        break;
      }
      const d = Math.min(Math.abs(b.fLow - f), Math.abs(b.fHigh - f));
      if (d < bestDistance) {
        bestDistance = d;
        band = b;
      }
    }
    return Math.max(band.fHigh - band.fLow, f * 0.001);
  })();

  let allBands = primaryBands;
  if (!reachedLimits && !SKIP_BROAD) {
    // ~1 pt/MHz across 1.0–30 MHz — detects any band ≥ ~2 MHz wide.
    // Scale down with CHAR_POINTS so low-power devices get proportionally
    // fewer Wasm points here too (floor at 11 to retain ~1 pt/2.5 MHz).
    const BROAD_CHAR_POINTS = Math.max(11, Math.round(CHAR_POINTS * 29 / 11));
    const broadScan = await runScan(solveImpedanceSweep, input, SWEEP_F_MIN_MHZ, SWEEP_F_MAX_MHZ, BROAD_CHAR_POINTS);
    // Use a stricter threshold than the display 2:1 boundary. The broad scan
    // has only ~1 pt/MHz resolution: a single sample can dip just under 2:1
    // purely because of where it falls on a shallow, narrow dip. By requiring
    // SWR < 1.5 at the coarse sample, we ensure only bands where the minimum
    // SWR is genuinely well below 2:1 — and therefore reliably captured by
    // the fine sweep — are included. Multi-band antennas (TFDs, EFHWs) have
    // SWR comfortably below 1.5 in all their matching bands; marginal dips
    // that only just breach 2:1 in the coarse scan are safely ignored.
    const BROAD_THRESHOLD = 1.5;

    // ⚡ Bolt: Avoid intermediate arrays by passing the broadScan array and accessors directly
    const broadBands = findSwrBands(
      broadScan,
      (pt) => pt.frequencyMHz,
      (pt) => effSwr(pt),
      BROAD_THRESHOLD,
    );
    // Accept bands from the broad scan that lie clearly outside the primary
    // scan window (0.5 MHz guard band avoids duplicating the primary band).
    let merged: typeof primaryBands | null = null;
    for (let i = 0; i < broadBands.length; i++) {
      const b = broadBands[i];
      if (b.fHigh < loEdge - 0.5 || b.fLow > hiEdge + 0.5) {
        if (merged === null) {
          merged = [];
          for (let j = 0; j < primaryBands.length; j++) {
            merged.push(primaryBands[j]);
          }
        }
        merged.push(b);
      }
    }

    if (merged !== null) {
      merged.sort((a, b) => a.fLow - b.fLow);
      if (primaryBands.length === 0) {
        // No operating-frequency band to protect — show whatever band exists.
        allBands = merged;
      } else {
        // Resolve-aware merge: only widen the window to include a distant band
        // (e.g. a harmonic resonance of a narrowband dipole) if the operating
        // band stays adequately sampled at the final point count. Otherwise
        // the operating band falls between samples — its dip vanishes from the
        // chart and the marker reads an off-resonance SWR — so we keep the
        // window focused on the operating band instead.
        const MIN_OPERATING_BAND_SAMPLES = 4;
        const { start, end } = frameWindow(merged);
        const spacing = points > 1 ? (end - start) / (points - 1) : end - start;
        const samplesInOperatingBand = spacing > 0 ? operatingBandWidth / spacing : Infinity;
        if (samplesInOperatingBand >= MIN_OPERATING_BAND_SAMPLES) {
          allBands = merged;
        }
      }
    }
  }

  const { start: winStart, end: winEnd } = frameWindow(allBands);
  return runScan(solveImpedanceSweep, input, winStart, winEnd, points);
}
