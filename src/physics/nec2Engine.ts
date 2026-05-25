// NEC-2 (nec2c) WebAssembly engine wrapper.
//
// The Wasm module is loaded from `/nec2.js` at runtime (served from public/).
// We deliberately do NOT import it statically so Vite leaves it alone; this
// also keeps the main bundle lean — the ~60 kB JS loader + 250 kB Wasm is
// fetched only when the solver is first used.
//
// Each simulate() call:
//   1. Spins up a fresh Emscripten module instance (the factory is cached
//      so only the Wasm instantiation cost is paid — ~50ms in Node, similar
//      in browsers thanks to Wasm compilation caching).
//   2. Writes a generated .nec card deck into the virtual FS.
//   3. Invokes `callMain(['-i', ..., '-o', ...])`.
//   4. Reads the output file and parses impedance + pattern.
//
// Why a fresh module every call? nec2c relies heavily on global state and
// was written as a one-shot CLI. After callMain() returns the globals are in
// an indeterminate state, so a second call typically aborts. Recreating the
// module is cheap and guarantees correctness.

import { buildNecCards } from './necCard';
import { parseNecImpedanceSweep, parseNecOutput } from './necParser';
import { computeTerminationDiagnostics } from './terminationDiagnostics';
import { swr, mismatchLossFactor } from './impedance';
import { findSwrBands } from './bandwidth';
import type { Engine, ImpedanceResult, SimulationInput, SimulationResult, SweepPoint } from './types';

interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string): Uint8Array;
  readFile(path: string, opts: { encoding: 'utf8' }): string;
  unlink?(path: string): void;
}

interface EmscriptenInstance {
  FS: EmscriptenFS;
  callMain(args: string[]): number;
  ccall: (...args: unknown[]) => unknown;
  HEAPF64: Float64Array;
}

interface EmscriptenFactory {
  (opts?: {
    print?: (s: string) => void;
    printErr?: (s: string) => void;
    noInitialRun?: boolean;
    locateFile?: (path: string, prefix: string) => string;
  }): Promise<EmscriptenInstance>;
}

/**
 * The glue loader exposes `Nec2Module` as an ES module default export.
 *
 * We must use a *fully-qualified* URL for the dynamic import(). If we pass
 * a bare path like "/nec2.js" Vite's dev server tries to resolve it as a
 * source module and errors with "This file is in /public and should not be
 * imported from source code". Constructing the URL from `location.origin`
 * (or `self.location` inside a worker) defeats that static analysis.
 *
 * Keep this helper separate so tests can stub it out with a file:// URL.
 */
async function loadNec2Factory(baseUrl: string): Promise<EmscriptenFactory> {
  let url: string;
  if (/^https?:|^file:/.test(baseUrl)) {
    // Already an absolute URL (e.g. test harness).
    url = `${baseUrl}nec2.js`;
  } else {
    // Relative to the current origin. Building the absolute URL at runtime
    // prevents Vite from treating the specifier as a source file.
    const origin =
      typeof self !== 'undefined' && typeof self.location !== 'undefined'
        ? self.location.origin
        : '';
    url = new URL(`${baseUrl}nec2.js`, origin || 'http://localhost/').href;
  }
  const parsedUrl = new URL(url, 'http://localhost/');
  if (!['http:', 'https:', 'file:'].includes(parsedUrl.protocol)) {
    throw new Error(`Untrusted protocol: ${parsedUrl.protocol}`);
  }
  const mod = (await import(/* @vite-ignore */ url)) as { default: EmscriptenFactory };
  return mod.default;
}

export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface Nec2EngineOptions {
  /** Base URL to fetch nec2.js / nec2.wasm from. Defaults to "/". */
  baseUrl?: string;
  /** Suppress noisy nec2c stdout except warnings/errors. Default true. */
  quiet?: boolean;
  /** Optional logger to receive console output from the engine. */
  logger?: Logger;
}

export interface SweepOptions {
  /**
   * Total span centred on the operating frequency. When provided, the sweep
   * uses this fixed span (single pass). When omitted, the sweep is adaptive:
   * it auto-frames the window around the antenna's 2:1 bandwidth so the curve
   * fills the chart for both narrowband and broadband antennas.
   */
  spanFraction?: number;
  /** Number of sample points across the (final) sweep. Default 15. */
  points?: number;
  /**
   * Display-side impedance transformer ratio used only for adaptive framing.
   * For antennas whose balun is modelled in the display layer (not in NEC),
   * the swept R/X are raw; dividing by this ratio yields the SWR the user
   * actually sees, so framing matches the displayed curve. Defaults to 1 (no
   * display transform — raw SWR is already what's shown).
   */
  displayRatio?: number;
}

export class Nec2Engine implements Engine {
  public readonly name = 'NEC-2 (WebAssembly)';
  public ready = false;
  private factory: EmscriptenFactory | null = null;
  private readonly baseUrl: string;
  private readonly quiet: boolean;
  private readonly logger?: Logger;
  private initPromise: Promise<void> | null = null;
  private lock: Promise<void> = Promise.resolve();

  constructor(opts: Nec2EngineOptions = {}) {
    this.baseUrl = opts.baseUrl ?? '/';
    this.quiet = opts.quiet ?? true;
    this.logger = opts.logger;
  }

  async init(): Promise<void> {
    if (this.ready) return;
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    await this.initPromise;
  }

  private resolveAsset(path: string): string {
    if (/^https?:|^file:/.test(this.baseUrl)) return `${this.baseUrl}${path}`;
    const origin =
      typeof self !== 'undefined' && typeof self.location !== 'undefined'
        ? self.location.origin
        : 'http://localhost/';
    return new URL(`${this.baseUrl}${path}`, origin).href;
  }

  private async doInit(): Promise<void> {
    this.logger?.info('[nec2] loading factory from', this.resolveAsset('nec2.js'));
    this.factory = await loadNec2Factory(this.baseUrl);
    this.logger?.info('[nec2] factory loaded, instantiating warmup module…');
    // Warm up the V8/wasm compilation cache so the first simulate() call
    // doesn't pay the full compile cost.
    const warmup = await this.factory({
      noInitialRun: true,
      locateFile: (path: string) => this.resolveAsset(path),
      print: () => {},
      printErr: (s) => this.logger?.warn('[nec2 warmup stderr]', s),
    });
    // Touch FS so it's initialised.
    warmup.FS.writeFile('/warmup.txt', '');
    this.ready = true;
    this.logger?.info('[nec2] engine ready');
  }

  async simulate(input: SimulationInput): Promise<SimulationResult> {
    if (!this.factory) await this.init();
    const factory = this.factory;
    if (!factory) throw new Error('NEC-2 engine failed to initialise');

    // Serialise so concurrent simulate() calls don't compete for memory.
    const release = await this.acquire();
    const t0 = performance.now();
    try {
      const stderrLines: string[] = [];
      const instance = await factory({
        noInitialRun: true,
        locateFile: (path: string) => this.resolveAsset(path),
        print: this.quiet ? () => {} : (s) => this.logger?.info('[nec2]', s),
        printErr: (s) => {
          stderrLines.push(s);
          if (!this.quiet) this.logger?.warn('[nec2 stderr]', s);
        },
      });

      const inPath = '/input.nec';
      const outPath = '/output.nout';

      const cards = buildNecCards(input);
      instance.FS.writeFile(inPath, cards);

      const rc = instance.callMain(['-i', inPath, '-o', outPath]);
      if (rc !== 0) {
        const tail = stderrLines.slice(-5).join(' | ') || '(no stderr)';
        throw new Error(`nec2c exited with status ${rc}. ${tail}`);
      }

      const outputBytes = instance.FS.readFile(outPath);
      const output = new TextDecoder().decode(outputBytes);

      const parsed = parseNecOutput(
        output,
        input.patternResolution.thetaSteps,
        input.patternResolution.phiSteps,
      );

      if (!parsed.pattern) {
        throw new Error(
          `NEC-2 did not produce a radiation pattern. Notices: ${parsed.notices.join('; ') || '(none)'}`,
        );
      }
      if (!parsed.impedance) {
        throw new Error('NEC-2 did not produce an impedance result.');
      }

      // Locate max gain direction.
      let maxGain = -Infinity;
      let maxIdx = 0;
      for (let i = 0; i < parsed.pattern.data.length; i++) {
        const v = parsed.pattern.data[i]!;
        if (v > maxGain) {
          maxGain = v;
          maxIdx = i;
        }
      }
      const ti = Math.floor(maxIdx / parsed.pattern.phiSteps);
      const pi = maxIdx % parsed.pattern.phiSteps;
      const thetaDeg = ti * parsed.pattern.dTheta;
      const phiDeg = pi * parsed.pattern.dPhi;
      // Convert NEC theta (0 = +z zenith) to elevation (0 = horizon).
      const elevationDeg = 90 - thetaDeg;

      const computeTimeMs = performance.now() - t0;

      const terminationDiagnostics = computeTerminationDiagnostics(
        parsed.currents,
        parsed.powerBudget,
        parsed.pattern,
        elevationDeg,
        phiDeg,
      );

      const efficiency = parsed.powerBudget ? parsed.powerBudget.efficiencyPct / 100 : undefined;

      // Directivity: D = G / η  →  D(dBi) = G(dBi) − 10·log10(η)
      // Only defined when the power budget is available and η > 0.
      const maxDirectivityDbi =
        efficiency && efficiency > 1e-6
          ? maxGain - 10 * Math.log10(efficiency)
          : undefined;

      // Realized gain: deducts feedpoint mismatch loss vs 50 Ω source.
      // G_r(dBi) = G(dBi) + 10·log10(1 − |Γ|²)
      const mlf = mismatchLossFactor(parsed.impedance);
      const maxRealizedGainDbi = mlf > 0 ? maxGain + 10 * Math.log10(mlf) : undefined;

      return {
        pattern: parsed.pattern,
        maxGainDbi: maxGain,
        maxDirectivityDbi,
        maxRealizedGainDbi,
        takeoffElevationDeg: elevationDeg,
        takeoffAzimuthDeg: phiDeg,
        impedance: parsed.impedance,
        swr: swr(parsed.impedance),
        efficiency,
        computeTimeMs,
        terminationDiagnostics,
      };
    } finally {
      release();
    }
  }

  async sweepImpedance(input: SimulationInput, opts: SweepOptions = {}): Promise<SweepPoint[]> {
    const points = Math.max(3, Math.round(opts.points ?? 15));
    // Explicit spanFraction → fixed single-pass sweep (back-compat for tests
    // and callers that want a specific window).
    if (opts.spanFraction !== undefined) {
      const { start, end } = this.clampSpan(input.frequencyMHz, opts.spanFraction);
      return this.runScan(input, start, end, points);
    }
    // Otherwise auto-frame the window around the antenna's 2:1 bandwidth.
    return this.adaptiveSweep(input, points, Math.max(1, opts.displayRatio ?? 1));
  }

  private static readonly F_MIN_MHZ = 1.8;
  private static readonly F_MAX_MHZ = 30;

  private clampSpan(freq: number, spanFraction: number): { start: number; end: number } {
    return {
      start: Math.max(Nec2Engine.F_MIN_MHZ, freq * (1 - spanFraction / 2)),
      end: Math.min(Nec2Engine.F_MAX_MHZ, freq * (1 + spanFraction / 2)),
    };
  }

  /** Run one fixed-window scan over [start, end] with `n` evenly-spaced points. */
  private async runScan(
    input: SimulationInput,
    start: number,
    end: number,
    n: number,
  ): Promise<SweepPoint[]> {
    const step = n > 1 ? (end - start) / (n - 1) : 0;
    const parsedResults = await this.solveImpedanceSweep(input, n, start, step);
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
   */
  private async adaptiveSweep(
    input: SimulationInput,
    points: number,
    displayRatio: number,
  ): Promise<SweepPoint[]> {
    const { F_MIN_MHZ: F_MIN, F_MAX_MHZ: F_MAX } = Nec2Engine;
    const f = input.frequencyMHz;
    // Effective SWR = what the user sees (after any display-only balun).
    const effSwr = (p: SweepPoint): number =>
      displayRatio > 1 ? swr({ R: p.R / displayRatio, X: p.X / displayRatio }) : p.swr;

    // Phase 1 — expand until both edges exceed 2:1, or we hit the band limits.
    const CHAR_POINTS = 11;
    let span = 0.1;
    const first = this.clampSpan(f, span);
    let scan = await this.runScan(input, first.start, first.end, CHAR_POINTS);
    for (let iter = 0; iter < 5; iter++) {
      const lowOK = effSwr(scan[0]!) > 2;
      const highOK = effSwr(scan[scan.length - 1]!) > 2;
      const atLimits =
        scan[0]!.frequencyMHz <= F_MIN + 1e-9 && scan[scan.length - 1]!.frequencyMHz >= F_MAX - 1e-9;
      if ((lowOK && highOK) || atLimits) break;
      span *= 3;
      const { start, end } = this.clampSpan(f, span);
      scan = await this.runScan(input, start, end, CHAR_POINTS);
    }

    const loEdge = scan[0]!.frequencyMHz;
    const hiEdge = scan[scan.length - 1]!.frequencyMHz;

    // Frame the window around every ≤2:1 band found in the characterisation
    // scan (the antenna may be usable on several disjoint sub-bands), so the
    // chart shows them all rather than just the one around the global minimum.
    const bands = findSwrBands(
      scan.map((p) => p.frequencyMHz),
      scan.map(effSwr),
      2,
    );

    let winStart: number;
    let winEnd: number;
    if (bands.length > 0) {
      const unionLow = bands[0]!.fLow;
      const unionHigh = bands[bands.length - 1]!.fHigh;
      const width = Math.max(unionHigh - unionLow, f * 0.02);
      const margin = Math.max(width * 0.25, f * 0.02);
      // When a band is clipped the actual crossing lies beyond the scanned
      // range. Use the full scan edge as the anchor so the final window still
      // reaches (and slightly past) the scan boundary on that side.
      winStart = bands[0]!.lowClipped ? loEdge - margin : unionLow - margin;
      winEnd = bands[bands.length - 1]!.highClipped ? hiEdge + margin : unionHigh + margin;
    } else {
      // Never dips below 2:1 within the explored window — show what we scanned.
      winStart = loEdge;
      winEnd = hiEdge;
    }

    // Keep the operating-frequency marker in view and clamp to the HF band.
    winStart = Math.max(F_MIN, Math.min(winStart, f));
    winEnd = Math.min(F_MAX, Math.max(winEnd, f));
    if (!(winEnd > winStart)) {
      ({ start: winStart, end: winEnd } = this.clampSpan(f, 0.1));
    }

    return this.runScan(input, winStart, winEnd, points);
  }

  /** Simple in-process mutex so overlapping simulate() calls queue up. */
  private async acquire(): Promise<() => void> {
    const prev = this.lock;
    let release: () => void = () => {};
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    return release;
  }

  private async solveImpedanceSweep(
    input: SimulationInput,
    points: number,
    startFreq: number,
    step: number,
  ): Promise<{ impedance: ImpedanceResult | null; power: number | null }[]> {
    if (!this.factory) await this.init();
    const factory = this.factory;
    if (!factory) throw new Error('NEC-2 engine failed to initialise');

    const release = await this.acquire();
    try {
      const stderrLines: string[] = [];
      const instance = await factory({
        noInitialRun: true,
        locateFile: (path: string) => this.resolveAsset(path),
        print: this.quiet ? () => {} : (s) => this.logger?.info('[nec2 sweep]', s),
        printErr: (s) => {
          stderrLines.push(s);
          if (!this.quiet) this.logger?.warn('[nec2 sweep stderr]', s);
        },
      });

      const inPath = '/input.nec';
      const outPath = '/output.nout';
      instance.FS.writeFile(
        inPath,
        buildNecCards(input, {
          includePattern: false,
          sweepPoints: points,
          sweepStartFreq: startFreq,
          sweepStep: step,
        }),
      );

      const rc = instance.callMain(['-i', inPath, '-o', outPath]);
      if (rc !== 0) {
        const tail = stderrLines.slice(-5).join(' | ') || '(no stderr)';
        throw new Error(`nec2c sweep exited with status ${rc}. ${tail}`);
      }

      const outputBytes = instance.FS.readFile(outPath);
      const output = new TextDecoder().decode(outputBytes);
      return parseNecImpedanceSweep(output);
    } finally {
      release();
    }
  }
}
