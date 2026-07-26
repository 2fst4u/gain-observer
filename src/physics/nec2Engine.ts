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
import type { Engine, ImpedanceResult, SimulationInput, SimulationResult, SweepPoint } from './types';
import { SWEEP_F_MIN_MHZ, SWEEP_F_MAX_MHZ } from './constants';
import { clampSpan, runScan, adaptiveSweep } from './sweep';

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
  const mod = (await import(/* @vite-ignore */ parsedUrl.href)) as { default: EmscriptenFactory };
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
  /**
   * Explicit absolute frequency window [startMHz, endMHz]. Takes precedence
   * over `spanFraction` and the adaptive framing. Used by the interactive
   * zoom/pan SWR view: the sweep samples exactly this window so zooming in
   * resamples a narrower span at full point density (efficient recompute).
   * Clamped to the engine's HF sweep limits.
   */
  window?: { startMHz: number; endMHz: number };
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
  /**
   * Points per characterisation scan in the adaptive expansion phase. Each
   * scan is a separate Wasm invocation, so fewer points here mainly reduces
   * text-parse cost — the matrix solve dominates. Default 11.
   */
  charPoints?: number;
  /**
   * Maximum number of adaptive expansion iterations before giving up and
   * using the widest explored window. Reducing this caps the number of
   * serial Wasm invocations on the expansion path. Default 5.
   */
  maxIter?: number;
  /**
   * Skip the secondary broad HF-range scan that detects ≤2:1 bands outside
   * the primary window (e.g. harmonic resonances). Saves one Wasm invocation.
   * Safe to enable on low-power devices where the multi-band edge case is
   * less important than total latency. Default false.
   */
  skipBroadScan?: boolean;
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
    let url: string;
    if (/^https?:|^file:/.test(this.baseUrl)) {
      url = `${this.baseUrl}${path}`;
    } else {
      const origin =
        typeof self !== 'undefined' && typeof self.location !== 'undefined'
          ? self.location.origin
          : 'http://localhost/';
      url = new URL(`${this.baseUrl}${path}`, origin).href;
    }
    const parsedUrl = new URL(url, 'http://localhost/');
    if (!['http:', 'https:', 'file:'].includes(parsedUrl.protocol)) {
      throw new Error(`Untrusted protocol: ${parsedUrl.protocol}`);
    }
    return parsedUrl.href;
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

  /**
   * Run one nec2c job to completion: instantiate the Wasm module, feed it
   * `cards` on the virtual filesystem, and return the decoded output deck.
   *
   * Callers own the concurrency lock and the module lifetime around this —
   * `kind` only selects the log and error labels so the two call sites stay
   * distinguishable in the console and in thrown messages.
   */
  private async runJob(
    factory: EmscriptenFactory,
    cards: string,
    kind: 'simulate' | 'sweep',
  ): Promise<string> {
    const logLabel = kind === 'sweep' ? 'nec2 sweep' : 'nec2';
    const errorLabel = kind === 'sweep' ? 'nec2c sweep' : 'nec2c';

    const stderrLines: string[] = [];
    const instance = await factory({
      noInitialRun: true,
      locateFile: (path: string) => this.resolveAsset(path),
      print: this.quiet ? () => {} : (s) => this.logger?.info(`[${logLabel}]`, s),
      printErr: (s) => {
        stderrLines.push(s);
        if (!this.quiet) this.logger?.warn(`[${logLabel} stderr]`, s);
      },
    });

    const inPath = '/input.nec';
    const outPath = '/output.nout';

    instance.FS.writeFile(inPath, cards);

    const rc = instance.callMain(['-i', inPath, '-o', outPath]);
    if (rc !== 0) {
      const tail = stderrLines.slice(-5).join(' | ') || '(no stderr)';
      throw new Error(`${errorLabel} exited with status ${rc}. ${tail}`);
    }

    const outputBytes = instance.FS.readFile(outPath);
    return new TextDecoder().decode(outputBytes);
  }

  async simulate(input: SimulationInput): Promise<SimulationResult> {
    if (!this.factory) await this.init();
    const factory = this.factory;
    if (!factory) throw new Error('NEC-2 engine failed to initialise');

    // Serialise so concurrent simulate() calls don't compete for memory.
    const release = await this.acquire();
    const t0 = performance.now();
    try {
      const cards = buildNecCards(input);
      const output = await this.runJob(factory, cards, 'simulate');

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

  /**
   * Single-frequency feedpoint impedance with no radiation pattern — far
   * cheaper than a full simulate(). Used to obtain a *transformer-independent*
   * antenna feedpoint (caller passes the bare antenna, no feedline/transformer)
   * for the Match suggestion, so the suggested ratio is one stable value
   * regardless of which transformer is currently fitted.
   */
  async feedpointImpedance(input: SimulationInput): Promise<ImpedanceResult> {
    const results = await this.solveImpedanceSweep(input, 1, input.frequencyMHz, 0);
    const z = results[0]?.impedance;
    if (!z) {
      throw new Error('NEC-2 did not produce a feedpoint impedance result.');
    }
    return z;
  }

  async sweepImpedance(input: SimulationInput, opts: SweepOptions = {}): Promise<SweepPoint[]> {
    const points = Math.max(3, Math.round(opts.points ?? 15));
    const solveCb = this.solveImpedanceSweep.bind(this);
    // Explicit window → fixed single-pass sweep over exactly that range. This
    // is the interactive zoom/pan path: the caller owns the framing, so no
    // auto-zoom is applied.
    if (opts.window) {
      const lo = Math.min(opts.window.startMHz, opts.window.endMHz);
      const hi = Math.max(opts.window.startMHz, opts.window.endMHz);
      const start = Math.max(SWEEP_F_MIN_MHZ, lo);
      const end = Math.min(SWEEP_F_MAX_MHZ, hi);
      return runScan(solveCb, input, start, end, points);
    }
    // Explicit spanFraction → fixed single-pass sweep (back-compat for tests
    // and callers that want a specific window).
    if (opts.spanFraction !== undefined) {
      const { start, end } = clampSpan(input.frequencyMHz, opts.spanFraction);
      return runScan(solveCb, input, start, end, points);
    }
    // Otherwise auto-frame the window around the antenna's 2:1 bandwidth.
    return adaptiveSweep(solveCb, input, points, Math.max(1, opts.displayRatio ?? 1), opts);
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
      const cards = buildNecCards(input, {
        includePattern: false,
        sweepPoints: points,
        sweepStartFreq: startFreq,
        sweepStep: step,
      });
      const output = await this.runJob(factory, cards, 'sweep');
      return parseNecImpedanceSweep(output);
    } finally {
      release();
    }
  }
}
