// Central application state (Zustand + Immer).
//
// Invariants:
//   - All geometry is stored in metres internally. UI conversion happens at
//     the component edge via useUnits() / toDisplayLength().
//   - `result` is read-only for UI code; it is written only by the physics
//     worker bridge via the underscored _setResult action.

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  SimulationInput,
  SimulationResult,
  GroundParams,
  SweepPoint,
  Wire,
} from '../physics/types';
import {
  DEFAULT_GROUND_ID,
  DEFAULT_WIRE_RADIUS_M,
  findGroundPreset,
  halfWaveLength,
} from '../physics/constants';
import type { UnitSystem } from '../physics/units';

export type Orientation = 'EW' | 'NS' | 'NE-SW' | 'NW-SE';
export type Theme = 'dark' | 'light';
export type Mode = 'normal' | 'nvis' | 'comparison';
export type Colormap = 'viridis' | 'turbo' | 'jet';

export interface ComparisonSnapshot {
  readonly frequency: number;
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly groundId: string;
  readonly groundSigma: number;
  readonly groundEpsilon: number;
  readonly result: SimulationResult;
  readonly sweep: SweepPoint[];
  readonly capturedAt: number;
}

export interface AntennaState {
  // Antenna geometry (metres, MHz)
  frequency: number;
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;

  // Environment
  groundId: string;
  groundSigma: number;
  groundEpsilon: number;

  // Display / UI
  theme: Theme;
  units: UnitSystem;
  mode: Mode;
  colormap: Colormap;
  patternScale: number;
  dbRange: number;
  showGrid: boolean;
  showAxes: boolean;
  showPolarCuts: boolean;

  // Solver output
  result: SimulationResult | null;
  sweep: SweepPoint[];
  error: string | null;
  loading: boolean;
  engineReady: boolean;
  comparisonReference: ComparisonSnapshot | null;

  // Actions — user-facing
  setFrequency(mhz: number): void;
  setLength(meters: number): void;
  setHalfWaveLength(): void;
  setHeight(meters: number): void;
  setOrientation(o: Orientation): void;
  setWireRadius(meters: number): void;
  setSegments(n: number): void;
  setGround(id: string): void;
  setCustomGround(sigma: number, epsilon: number): void;
  setTheme(t: Theme): void;
  toggleTheme(): void;
  setUnits(u: UnitSystem): void;
  toggleUnits(): void;
  setMode(m: Mode): void;
  setColormap(c: Colormap): void;
  setPatternScale(s: number): void;
  setDbRange(db: number): void;
  setShowGrid(v: boolean): void;
  setShowAxes(v: boolean): void;
  setShowPolarCuts(v: boolean): void;
  captureComparisonReference(): void;
  clearComparisonReference(): void;

  // Actions — internal (used by hooks/workers only, prefixed with _)
  _setSimulationData(r: SimulationResult, sweep: readonly SweepPoint[]): void;
  _setError(msg: string | null): void;
  _setLoading(v: boolean): void;
  _setEngineReady(v: boolean): void;
}

const INITIAL_FREQ = 7.1; // 40m band per user spec
const INITIAL_HEIGHT = 10; // metres
const INITIAL_LENGTH = halfWaveLength(INITIAL_FREQ); // resonant ½λ

export const useAntennaStore = create<AntennaState>()(
  subscribeWithSelector(
    immer((set) => ({
      frequency: INITIAL_FREQ,
      length: INITIAL_LENGTH,
      height: INITIAL_HEIGHT,
      orientation: 'EW',
      wireRadius: DEFAULT_WIRE_RADIUS_M,
      segments: 21,

      groundId: DEFAULT_GROUND_ID,
      groundSigma: findGroundPreset(DEFAULT_GROUND_ID).sigma,
      groundEpsilon: findGroundPreset(DEFAULT_GROUND_ID).epsilon,

      theme: 'dark',
      units: 'metric',
      mode: 'normal',
      colormap: 'viridis',
      patternScale: 1,
      dbRange: 30,
      showGrid: true,
      showAxes: true,
      showPolarCuts: true,

      result: null,
      sweep: [],
      error: null,
      loading: false,
      engineReady: false,
      comparisonReference: null,

      setFrequency: (mhz) => set((s) => { s.frequency = clampFreq(mhz); }),
      setLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.length = Math.max(0.1, meters);
      }),
      setHalfWaveLength: () => set((s) => { s.length = halfWaveLength(s.frequency); }),
      setHeight: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.height = Math.max(0, meters);
      }),
      setOrientation: (o) => set((s) => { s.orientation = o; }),
      setWireRadius: (r) => set((s) => {
        if (!Number.isFinite(r)) return;
        s.wireRadius = Math.max(0.0001, r);
      }),
      setSegments: (n) => set((s) => { s.segments = clampSegments(n); }),
      setGround: (id) => set((s) => {
        s.groundId = id;
        if (id !== 'custom') {
          const preset = findGroundPreset(id);
          s.groundSigma = preset.sigma;
          s.groundEpsilon = preset.epsilon;
        }
      }),
      setCustomGround: (sigma, epsilon) => set((s) => {
        if (!Number.isFinite(sigma) || !Number.isFinite(epsilon)) return;
        s.groundId = 'custom';
        s.groundSigma = Math.max(0, sigma);
        s.groundEpsilon = Math.max(1, epsilon);
      }),
      setTheme: (t) => set((s) => { s.theme = t; }),
      toggleTheme: () => set((s) => { s.theme = s.theme === 'dark' ? 'light' : 'dark'; }),
      setUnits: (u) => set((s) => { s.units = u; }),
      toggleUnits: () => set((s) => { s.units = s.units === 'metric' ? 'imperial' : 'metric'; }),
      setMode: (m) => set((s) => {
        s.mode = m;
        if (m === 'comparison' && !s.comparisonReference) {
          s.comparisonReference = createComparisonSnapshot(s);
        }
      }),
      setColormap: (c) => set((s) => { s.colormap = c; }),
      setPatternScale: (v) => set((s) => { s.patternScale = Math.max(0.1, v); }),
      setDbRange: (db) => set((s) => { s.dbRange = Math.max(5, Math.min(60, db)); }),
      setShowGrid: (v) => set((s) => { s.showGrid = v; }),
      setShowAxes: (v) => set((s) => { s.showAxes = v; }),
      setShowPolarCuts: (v) => set((s) => { s.showPolarCuts = v; }),
      captureComparisonReference: () => set((s) => {
        s.comparisonReference = createComparisonSnapshot(s);
      }),
      clearComparisonReference: () => set((s) => { s.comparisonReference = null; }),

      _setSimulationData: (r, sweep) => set((s) => {
        s.result = r;
        s.sweep = [...sweep];
        s.loading = false;
        s.error = null;
      }),
      _setError: (msg) => set((s) => {
        s.error = msg;
        s.loading = false;
      }),
      _setLoading: (v) => set((s) => { s.loading = v; }),
      _setEngineReady: (v) => set((s) => { s.engineReady = v; }),
    })),
  ),
);

function clampFreq(f: number): number {
  if (!Number.isFinite(f)) return 7.1;
  return Math.max(1.8, Math.min(30, f));
}

function clampSegments(n: number): number {
  if (!Number.isFinite(n)) return 21;
  const odd = Math.round(n);
  const v = Math.max(9, Math.min(101, odd));
  // NEC-2 conventionally wants an odd number of segments for a centre feed.
  return v % 2 === 0 ? v + 1 : v;
}

// --------------- Selectors ---------------

/**
 * Build the geometry vector for the current state.
 * The dipole lies along the chosen orientation at the configured height.
 */
export function buildWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'>,
): Wire[] {
  const half = state.length / 2;
  const h = state.height;
  // For ground mode NEC needs z>0 for all segments. When height is 0 we
  // treat it as free-space (caller will still pass free ground).
  const z = h;
  let start: [number, number, number];
  let end: [number, number, number];
  switch (state.orientation) {
    case 'EW':
      start = [-half, 0, z];
      end = [half, 0, z];
      break;
    case 'NS':
      start = [0, -half, z];
      end = [0, half, z];
      break;
    case 'NE-SW': {
      const c = Math.SQRT1_2 * half;
      start = [-c, -c, z];
      end = [c, c, z];
      break;
    }
    case 'NW-SE': {
      const c = Math.SQRT1_2 * half;
      start = [-c, c, z];
      end = [c, -c, z];
      break;
    }
  }
  return [{
    start, end,
    radius: state.wireRadius,
    segments: state.segments,
    tag: 1,
  }];
}

export function buildGroundParams(state: AntennaState): GroundParams {
  if (state.height <= 0) return { type: 'free' };
  switch (state.groundId) {
    case 'free': return { type: 'free' };
    case 'perfect': return { type: 'perfect' };
    default:
      return { type: 'real', sigma: state.groundSigma, epsilon: state.groundEpsilon };
  }
}

export function selectSimulationInput(state: AntennaState): SimulationInput {
  return {
    wires: buildWires(state),
    frequencyMHz: state.frequency,
    ground: buildGroundParams(state),
    excitation: {
      wireTag: 1,
      segment: Math.ceil(state.segments / 2),
    },
    patternResolution: {
      thetaSteps: 37, // 5° steps (0..180)
      phiSteps: 72,   // 5° steps (0..360)
    },
  };
}

function createComparisonSnapshot(state: AntennaState): ComparisonSnapshot | null {
  if (!state.result || state.sweep.length === 0) return null;
  return {
    frequency: state.frequency,
    length: state.length,
    height: state.height,
    orientation: state.orientation,
    wireRadius: state.wireRadius,
    segments: state.segments,
    groundId: state.groundId,
    groundSigma: state.groundSigma,
    groundEpsilon: state.groundEpsilon,
    result: state.result,
    sweep: [...state.sweep],
    capturedAt: Date.now(),
  };
}
