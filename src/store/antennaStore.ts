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
  TransmissionLine,
  SegmentLoad,
} from '../physics/types';
import {
  DEFAULT_BALUN_IMPEDANCE_OHMS,
  DEFAULT_FEEDLINE_ID,
  DEFAULT_FEEDLINE_LENGTH_M,
  DEFAULT_GROUND_ID,
  DEFAULT_WIRE_RADIUS_M,
  findFeedlinePreset,
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
  readonly feedlineId: string;
  readonly feedlineLength: number;
  readonly balunEnabled: boolean;
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

  // Feedline (coax / parallel-line modelled as physical radiating shield
  // wire + NEC TL card for the differential signal). When feedlineId is
  // 'none' the legacy direct-feed behaviour is used.
  feedlineId: string;
  feedlineLength: number;
  balunEnabled: boolean;

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
  setFeedline(id: string): void;
  setFeedlineLength(meters: number): void;
  setBalunEnabled(enabled: boolean): void;
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

      feedlineId: DEFAULT_FEEDLINE_ID,
      feedlineLength: DEFAULT_FEEDLINE_LENGTH_M,
      balunEnabled: false,

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
      setFeedline: (id) => set((s) => {
        // Validate; throws on unknown id.
        findFeedlinePreset(id);
        s.feedlineId = id;
      }),
      setFeedlineLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        // Cap at 200 m (substantially longer than any practical HF feedline)
        // to keep NEC matrices bounded.
        s.feedlineLength = Math.max(0, Math.min(200, meters));
      }),
      setBalunEnabled: (enabled) => set((s) => { s.balunEnabled = !!enabled; }),
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

/** Tag identifiers for the built-in geometry. */
export const DIPOLE_TAG = 1;
export const FEEDLINE_SHIELD_TAG = 2;

/**
 * Number of segments on the coax shield wire. Odd so the middle segment
 * is well-defined; small enough to keep NEC fast but large enough to
 * resolve common-mode current variation along a multi-wavelength run.
 */
export const FEEDLINE_SHIELD_SEGMENTS = 11;

/** Minimum gap (m) between the bottom of the shield wire and the ground
 * plane, to avoid NEC's "wire touching ground" warning. */
const FEEDLINE_GROUND_GAP_M = 0.1;

/**
 * Build the geometry vector for the current state.
 *
 * Geometry layout:
 *   - Dipole (tag 1): along the chosen orientation at `height` metres,
 *     centred on the origin in the X/Y plane.
 *   - Optional coax-shield wire (tag 2): a vertical wire dropping from the
 *     dipole feedpoint (which is at the origin in X/Y) toward the ground.
 *     Its top end coincides with the dipole feedpoint (a 3-way junction
 *     in NEC) so common-mode current can flow naturally onto it. The
 *     bottom end is the rig location and is fed by an EX card; see
 *     `selectSimulationInput`.
 */
export function buildWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength'>>,
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
  const wires: Wire[] = [{
    start, end,
    radius: state.wireRadius,
    segments: state.segments,
    tag: DIPOLE_TAG,
  }];

  // Add the coax shield wire when a feedline is configured.
  const shield = buildFeedlineShieldWire(state);
  if (shield) wires.push(shield);

  return wires;
}

function buildFeedlineShieldWire(
  state: Pick<AntennaState, 'height'> & Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength'>>,
): Wire | null {
  const id = state.feedlineId;
  const len = state.feedlineLength;
  if (!id || id === 'none') return null;
  if (typeof len !== 'number' || !Number.isFinite(len) || len <= 0) return null;
  const preset = findFeedlinePreset(id);
  if (preset.id === 'none' || preset.shieldOuterRadiusM <= 0) return null;

  // Top of the shield is the dipole feedpoint at (0, 0, height).
  const topZ = state.height;
  // Geometric drop is clamped so the bottom stays above the ground plane.
  // The user's entered length is preserved as the *electrical* length used
  // by the TL card and (any future) cable-loss calculation; only the
  // visible/radiating geometry is clamped.
  const minBottomZ = state.height > 0 ? FEEDLINE_GROUND_GAP_M : -len;
  const desiredBottomZ = topZ - len;
  const bottomZ = Math.max(minBottomZ, desiredBottomZ);
  const drop = topZ - bottomZ;
  if (drop < 0.05) return null; // not enough room for a meaningful wire

  return {
    start: [0, 0, topZ],
    end: [0, 0, bottomZ],
    radius: preset.shieldOuterRadiusM,
    segments: FEEDLINE_SHIELD_SEGMENTS,
    tag: FEEDLINE_SHIELD_TAG,
  };
}

function buildGroundParams(state: AntennaState): GroundParams {
  if (state.height <= 0) return { type: 'free' };
  switch (state.groundId) {
    case 'free': return { type: 'free' };
    case 'perfect': return { type: 'perfect' };
    default:
      return { type: 'real', sigma: state.groundSigma, epsilon: state.groundEpsilon };
  }
}

export function selectSimulationInput(state: AntennaState): SimulationInput {
  const wires = buildWires(state);
  const dipoleCentreSeg = Math.ceil(state.segments / 2);
  const feedlineActive = state.feedlineId !== 'none'
    && state.feedlineLength > 0
    && wires.some((w) => w.tag === FEEDLINE_SHIELD_TAG);

  // When a feedline is active, the source is at the *rig* end of the
  // coax — i.e. the bottom segment of the shield wire. Otherwise we feed
  // the dipole directly at its centre (legacy behaviour).
  const excitation = feedlineActive
    ? { wireTag: FEEDLINE_SHIELD_TAG, segment: FEEDLINE_SHIELD_SEGMENTS }
    : { wireTag: DIPOLE_TAG, segment: dipoleCentreSeg };

  const transmissionLines: TransmissionLine[] = [];
  const loads: SegmentLoad[] = [];

  if (feedlineActive) {
    const preset = findFeedlinePreset(state.feedlineId);
    // NEC's TL card uses free-space propagation; to model a real cable
    // with velocity factor < 1 we pass the *electrical* length, which is
    // physical length / VF. (β·ℓ_phys / VF gives the correct phase shift.)
    const electricalLength = state.feedlineLength / Math.max(0.05, preset.velocityFactor);
    transmissionLines.push({
      // Dipole feedpoint segment <-> bottom of shield (the rig location).
      fromTag: DIPOLE_TAG,
      fromSegment: dipoleCentreSeg,
      toTag: FEEDLINE_SHIELD_TAG,
      toSegment: FEEDLINE_SHIELD_SEGMENTS,
      z0: preset.z0,
      lengthM: electricalLength,
      // Shunt admittances are left at zero; cable copper/dielectric loss
      // is small for typical HF runs and is not the dominant effect we
      // are trying to capture (which is common-mode radiation from the
      // shield). A future enhancement may add a frequency-dependent
      // shunt-G term derived from feedlineLossDb().
    });

    if (state.balunEnabled) {
      // Place a 1:1 current ("choke") balun on the shield's TOP segment —
      // i.e. immediately below the antenna feedpoint. The high common-mode
      // impedance suppresses current on the outside of the shield without
      // affecting the differential signal inside (which travels via the
      // TL card and never sees this load).
      loads.push({
        type: 4, // impedance Z = R + jX
        wireTag: FEEDLINE_SHIELD_TAG,
        segmentStart: 1,
        segmentEnd: 1,
        param1: DEFAULT_BALUN_IMPEDANCE_OHMS, // R
        param2: 0,                            // X
      });
    }
  }

  return {
    wires,
    frequencyMHz: state.frequency,
    ground: buildGroundParams(state),
    excitation,
    patternResolution: {
      thetaSteps: 37, // 5° steps (0..180)
      phiSteps: 72,   // 5° steps (0..360)
    },
    transmissionLines: transmissionLines.length > 0 ? transmissionLines : undefined,
    loads: loads.length > 0 ? loads : undefined,
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
    feedlineId: state.feedlineId,
    feedlineLength: state.feedlineLength,
    balunEnabled: state.balunEnabled,
    result: state.result,
    sweep: [...state.sweep],
    capturedAt: Date.now(),
  };
}
