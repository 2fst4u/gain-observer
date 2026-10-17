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
  SimulationResult,
  ImpedanceResult,
  SweepPoint,
  AntennaType,
} from '../physics/types';
import {
  DEFAULT_FEEDLINE_ID,
  DEFAULT_FEEDLINE_LENGTH_M,
  DEFAULT_ATU_MAIN_FEEDLINE_LENGTH_M,
  DEFAULT_GROUND_ID,
  DEFAULT_WIRE_RADIUS_M,
  FEED_BRIDGE_LENGTH_M,
  findGroundPreset,
  findFeedlinePreset,
  referenceLength,
  DEFAULT_WHIP_LENGTH_M,
  FOLDED_DIPOLE_DEFAULT_APERTURE_M,
  FOLDED_DIPOLE_MAX_APERTURE_M,
} from '../physics/constants';

import type { Theme } from '../utils/themeColors';
import type { UnitSystem } from '../physics/units';
import { MIN_SEGS_PER_LEG, MAX_SEGS_PER_LEG, type Orientation } from './antennaGeometry';
import {
  calculateDefaultLength,
  computeOptimalVAngleDeg,
  legMultipleFromLength,
  clampSwrView,
  defaultSwrSpan,
  FEEDLINE_SUPPORTED_TYPES,
  SLOPING_V_DEFAULT_TERMINATION_OHMS,
  TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS,
} from './antennaSimulation';

// Re-export shared types and simulation selectors/helpers for UI and tests.
export type { AntennaType };
export type { Orientation };
export * from './antennaSimulation';

/**
 * Consolidated per-type transformer/balun defaults. Every antenna that supports a
 * balun (i.e. every type except the base-fed monopole-style verticals, whose
 * feedpoint is unbalanced) gets the transformer enabled by default so the
 * "Match n:1" auto-matching button is always available. The ratio is just a
 * sensible starting point — a 1:1 current ("choke") balun where no impedance
 * transformation is needed, or the established step-down ratio for the
 * high-impedance folded-dipole and terminated-delta designs.
 */
interface TransformerDefaults {
  readonly enabled: boolean;
  readonly ratio: number;
}
const TRANSFORMER_DEFAULTS: Record<AntennaType, TransformerDefaults> = {
  'dipole': { enabled: true, ratio: 1 },
  'inverted-v': { enabled: true, ratio: 1 },
  'sloping-v': { enabled: true, ratio: 1 },
  'delta-loop': { enabled: true, ratio: 1 },
  'terminated-delta': { enabled: true, ratio: 9 },
  'folded-dipole': { enabled: true, ratio: 9 },
  'vertical-whip': { enabled: false, ratio: 1 },
  'inverted-l': { enabled: false, ratio: 1 },
};

export type Mode = 'normal' | 'comparison';
export type Colormap = 'viridis' | 'turbo' | 'jet';

export interface ComparisonSnapshot {
  readonly frequency: number;
  readonly antennaType: AntennaType;
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly vAngle: number;
  readonly legSlope: number;
  readonly foldedDipoleAperture: number;
  readonly groundId: string;
  readonly groundSigma: number;
  readonly groundEpsilon: number;
  readonly feedlineId: string;
  readonly feedlineLength: number;
  readonly feedlineOffset: number;
  readonly whipCounterpoise: boolean;
  readonly result: SimulationResult;
  readonly sweep: SweepPoint[];
  readonly capturedAt: number;
}

export interface AntennaState {
  // Antenna geometry (metres, MHz)
  antennaType: AntennaType;
  frequency: number;
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;

  vAngle: number;
  legSlope: number;
  foldedDipoleAperture: number;
  terminatingResistor: number;
  whipCounterpoise: boolean;

  // Environment
  groundId: string;
  groundSigma: number;
  groundEpsilon: number;

  // Feedline
  feedlineId: string;
  feedlineLength: number;
  feedlineOffset: number;

  // Display / UI
  theme: Theme;
  units: UnitSystem;
  mode: Mode;
  colormap: Colormap;
  patternScale: number;
  dbRange: number;
  colorMaxDb: number;
  showGrid: boolean;
  showAxes: boolean;
  showPolarCuts: boolean;

  // Ideal transformer post-processing display
  transformerEnabled: boolean;
  transformerRatio: number;

  // Idealised ATU at the base of the mast
  atuEnabled: boolean;
  atuMainFeedlineLength: number;

  // Propagation
  tIndex: number;
  latitudeDeg: number | null;
  longitudeDeg: number | null;
  monthOverride: number | null;
  utcHourOverride: number | null;
  geolocationStatus: 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error';

  // SWR sweep view window
  swrViewCenterMHz: number;
  swrViewSpanMHz: number;

  // Solver output
  result: SimulationResult | null;
  feedpointImpedance: ImpedanceResult | null;
  sweep: SweepPoint[];
  error: string | null;
  loading: boolean;
  engineReady: boolean;
  comparisonReference: ComparisonSnapshot | null;

  // Actions — user-facing
  setAntennaType(type: AntennaType): void;
  setFrequency(mhz: number): void;
  setLength(meters: number): void;
  setHalfWaveLength(): void;
  setLegLengthMultiple(n: number): void;
  setHeight(meters: number): void;
  setOrientation(o: Orientation): void;
  setVAngle(deg: number): void;
  setLegSlope(deg: number): void;
  setFoldedDipoleAperture(meters: number): void;
  setTerminatingResistor(ohms: number): void;
  setWhipCounterpoise(enabled: boolean): void;
  setWireRadius(meters: number): void;
  setSegments(n: number): void;
  setGround(id: string): void;
  setCustomGround(sigma: number, epsilon: number): void;
  setFeedline(id: string): void;
  setFeedlineLength(meters: number): void;
  setFeedlineOffset(meters: number): void;
  setTheme(t: Theme): void;
  toggleTheme(): void;
  setUnits(u: UnitSystem): void;
  toggleUnits(): void;
  setMode(m: Mode): void;
  toggleMode(): void;
  setColormap(c: Colormap): void;
  setPatternScale(s: number): void;
  setDbRange(db: number): void;
  setColorMaxDb: (db: number) => void;
  setShowGrid(v: boolean): void;
  setShowAxes(v: boolean): void;
  setShowPolarCuts(v: boolean): void;
  setTransformerEnabled(enabled: boolean): void;
  setTransformerRatio(ratio: number): void;

  zoomSwrView(factor: number, pivotMHz?: number): void;
  panSwrView(fraction: number): void;
  panSwrViewByMHz(deltaMHz: number): void;
  resetSwrView(): void;
  setAtuEnabled(enabled: boolean): void;
  setAtuMainFeedlineLength(meters: number): void;
  captureComparisonReference(): void;
  clearComparisonReference(): void;

  // Propagation actions
  setTIndex(v: number): void;
  setLatitude(deg: number | null): void;
  setLongitude(deg: number | null): void;
  setMonthOverride(month: number | null): void;
  setUtcHourOverride(hour: number | null): void;
  setGeolocationStatus(s: AntennaState['geolocationStatus']): void;

  // Actions — internal
  _setSimulationData(
    r: SimulationResult,
    sweep: readonly SweepPoint[],
    feedpointImpedance?: ImpedanceResult | null,
  ): void;
  _setSweep(sweep: readonly SweepPoint[]): void;
  _setError(msg: string | null): void;
  _setLoading(v: boolean): void;
  _setEngineReady(v: boolean): void;
}

const INITIAL_FREQ = 7.1;
const INITIAL_HEIGHT = 8;
const INITIAL_TYPE: AntennaType = 'dipole';
const INITIAL_LENGTH = referenceLength(INITIAL_TYPE, INITIAL_FREQ);

const INITIAL_SWR_VIEW = clampSwrView(INITIAL_FREQ, defaultSwrSpan(INITIAL_FREQ));

function clampFreq(f: number): number {
  if (!Number.isFinite(f)) return 7.1;
  return Math.max(1.8, Math.min(30, f));
}

function clampSegments(n: number): number {
  if (!Number.isFinite(n)) return 21;
  const odd = Math.round(n);
  const v = Math.max(MIN_SEGS_PER_LEG, Math.min(MAX_SEGS_PER_LEG, odd));
  return v % 2 === 0 ? v + 1 : v;
}

function createComparisonSnapshot(state: AntennaState): ComparisonSnapshot | null {
  if (!state.result || state.sweep.length === 0) return null;
  return {
    frequency: state.frequency,
    antennaType: state.antennaType,
    length: state.length,
    height: state.height,
    orientation: state.orientation,
    wireRadius: state.wireRadius,
    segments: state.segments,
    vAngle: state.vAngle,
    legSlope: state.legSlope,
    foldedDipoleAperture: state.foldedDipoleAperture,
    groundId: state.groundId,
    groundSigma: state.groundSigma,
    groundEpsilon: state.groundEpsilon,
    feedlineId: state.feedlineId,
    feedlineLength: state.feedlineLength,
    feedlineOffset: state.feedlineOffset,
    whipCounterpoise: state.whipCounterpoise,
    result: state.result,
    sweep: [...state.sweep],
    capturedAt: Date.now(),
  };
}

export const useAntennaStore = create<AntennaState>()(
  subscribeWithSelector(
    immer((set) => ({
      antennaType: INITIAL_TYPE,
      frequency: INITIAL_FREQ,
      length: INITIAL_LENGTH,
      height: INITIAL_HEIGHT,
      orientation: 'EW',
      wireRadius: DEFAULT_WIRE_RADIUS_M,
      segments: 21,
      vAngle: 180,
      legSlope: 0,
      foldedDipoleAperture: FOLDED_DIPOLE_DEFAULT_APERTURE_M,
      terminatingResistor: 0,
      whipCounterpoise: false,

      groundId: DEFAULT_GROUND_ID,
      groundSigma: findGroundPreset(DEFAULT_GROUND_ID).sigma,
      groundEpsilon: findGroundPreset(DEFAULT_GROUND_ID).epsilon,

      feedlineId: DEFAULT_FEEDLINE_ID,
      feedlineLength: DEFAULT_FEEDLINE_LENGTH_M,
      feedlineOffset: 0,

      theme: 'dark',
      units: 'metric',
      mode: 'normal',
      colormap: 'viridis',
      patternScale: 1,
      dbRange: 30,
      colorMaxDb: 10,
      showGrid: true,
      showAxes: true,
      showPolarCuts: true,
      transformerEnabled: TRANSFORMER_DEFAULTS[INITIAL_TYPE].enabled,
      transformerRatio: TRANSFORMER_DEFAULTS[INITIAL_TYPE].ratio,

      swrViewCenterMHz: INITIAL_SWR_VIEW.center,
      swrViewSpanMHz: INITIAL_SWR_VIEW.span,

      atuEnabled: false,
      atuMainFeedlineLength: DEFAULT_ATU_MAIN_FEEDLINE_LENGTH_M,

      tIndex: 30,
      latitudeDeg: null,
      longitudeDeg: null,
      monthOverride: null,
      utcHourOverride: null,
      geolocationStatus: 'idle',

      result: null,
      feedpointImpedance: null,
      sweep: [],
      error: null,
      loading: false,
      engineReady: false,
      comparisonReference: null,

      setAntennaType: (type) => set((s) => {
        s.antennaType = type;

        if (type !== 'vertical-whip' && type !== 'inverted-l' && s.height === 0) {
          s.height = INITIAL_HEIGHT;
        }

        if (!FEEDLINE_SUPPORTED_TYPES.has(type)) {
          s.feedlineId = 'none';
          s.feedlineLength = 0;
          s.feedlineOffset = 0;
        } else {
          if (s.feedlineId === 'none') {
            s.feedlineId = DEFAULT_FEEDLINE_ID;
            s.feedlineLength = DEFAULT_FEEDLINE_LENGTH_M;
          }
          if (type !== 'dipole') {
            s.feedlineOffset = 0;
          }
        }
        s.length = calculateDefaultLength(type, s.frequency);

        if (type === 'dipole') {
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
        } else if (type === 'vertical-whip') {
          s.length = DEFAULT_WHIP_LENGTH_M;
          s.height = 0;
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
          s.whipCounterpoise = true;
        } else if (type === 'inverted-l') {
          if (s.height === 0) s.height = INITIAL_HEIGHT;
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
          s.whipCounterpoise = true;
        } else if (type === 'folded-dipole') {
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
        } else if (type === 'sloping-v') {
          s.vAngle = computeOptimalVAngleDeg(s.length, s.frequency, s.height);
          s.legSlope = 0;
          if (s.terminatingResistor === 0) {
            s.terminatingResistor = SLOPING_V_DEFAULT_TERMINATION_OHMS;
          }
        } else if (type === 'inverted-v') {
          s.vAngle = 120;
          s.legSlope = 0;
          s.terminatingResistor = 0;
        } else if (type === 'delta-loop') {
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
        } else if (type === 'terminated-delta') {
          s.vAngle = 180;
          s.legSlope = 0;
          if (s.terminatingResistor === 0) {
            s.terminatingResistor = TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS;
          }
        }

        const transformerDefaults = TRANSFORMER_DEFAULTS[type];
        s.transformerEnabled = transformerDefaults.enabled;
        s.transformerRatio = transformerDefaults.ratio;

        const limit = Math.max(0, s.length / 2 - FEED_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),

      setFrequency: (mhz) => set((s) => {
        s.frequency = clampFreq(mhz);
        const { center, span } = clampSwrView(s.frequency, s.swrViewSpanMHz);
        s.swrViewCenterMHz = center;
        s.swrViewSpanMHz = span;
      }),

      setLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.length = Math.max(0.1, meters);
        if (s.antennaType === 'sloping-v') {
          s.vAngle = computeOptimalVAngleDeg(s.length, s.frequency, s.height);
        }
        const limit = Math.max(0, s.length / 2 - FEED_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),

      setHalfWaveLength: () => set((s) => {
        const isTravelingWave = s.antennaType === 'sloping-v';
        if (isTravelingWave) {
          const n = legMultipleFromLength(s.length, s.frequency);
          s.length = n * 2 * (299.792458 / s.frequency);
        } else {
          s.length = calculateDefaultLength(s.antennaType, s.frequency);
        }
        if (s.antennaType === 'sloping-v') {
          s.vAngle = computeOptimalVAngleDeg(s.length, s.frequency, s.height);
        }
        const limit = Math.max(0, s.length / 2 - FEED_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),

      setLegLengthMultiple: (n) => set((s) => {
        if (s.antennaType !== 'sloping-v') return;
        if (!Number.isFinite(n) || n < 1) return;
        s.length = Math.round(n) * 2 * (299.792458 / s.frequency);
        if (s.antennaType === 'sloping-v') {
          s.vAngle = computeOptimalVAngleDeg(s.length, s.frequency, s.height);
        }
        const limit = Math.max(0, s.length / 2 - FEED_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),

      setHeight: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.height = Math.max(0, meters);
        if (s.antennaType === 'sloping-v') {
          s.vAngle = computeOptimalVAngleDeg(s.length, s.frequency, s.height);
        }
      }),

      setOrientation: (o) => set((s) => {
        if (typeof o === 'number') {
          if (!Number.isFinite(o)) return;
          let normalized = o % 360;
          if (normalized < 0) normalized += 360;
          s.orientation = normalized;
        } else {
          s.orientation = o;
        }
      }),

      setVAngle: (deg) => set((s) => {
        if (!Number.isFinite(deg)) return;
        s.vAngle = Math.max(10, Math.min(180, deg));
      }),

      setLegSlope: (deg) => set((s) => {
        if (!Number.isFinite(deg)) return;
        s.legSlope = Math.max(0, Math.min(90, deg));
      }),

      setFoldedDipoleAperture: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.foldedDipoleAperture = Math.max(0.02, Math.min(FOLDED_DIPOLE_MAX_APERTURE_M, meters));
      }),

      setTerminatingResistor: (ohms) => set((s) => {
        if (!Number.isFinite(ohms)) return;
        s.terminatingResistor = Math.max(0, ohms);
      }),

      setWhipCounterpoise: (enabled) => set((s) => {
        s.whipCounterpoise = !!enabled;
      }),

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
        const preset = findFeedlinePreset(id);
        s.feedlineId = preset.id;
      }),

      setFeedlineLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.feedlineLength = Math.max(0, Math.min(200, meters));
      }),

      setFeedlineOffset: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        const limit = Math.max(0, s.length / 2 - FEED_BRIDGE_LENGTH_M);
        s.feedlineOffset = Math.max(-limit, Math.min(limit, meters));
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

      toggleMode: () => set((s) => {
        const newMode = s.mode === 'normal' ? 'comparison' : 'normal';
        s.mode = newMode;
        if (newMode === 'comparison' && !s.comparisonReference) {
          s.comparisonReference = createComparisonSnapshot(s);
        }
      }),

      setColormap: (c) => set((s) => { s.colormap = c; }),
      setPatternScale: (v) => set((s) => { s.patternScale = Math.max(0.1, v); }),
      setDbRange: (db) => set((s) => { s.dbRange = Math.max(5, Math.min(60, db)); }),
      setColorMaxDb: (db) => set((s) => { s.colorMaxDb = Math.max(-20, Math.min(30, db)); }),
      setShowGrid: (v) => set((s) => { s.showGrid = v; }),
      setShowAxes: (v) => set((s) => { s.showAxes = v; }),
      setShowPolarCuts: (v) => set((s) => { s.showPolarCuts = v; }),

      setTransformerEnabled: (enabled) => set((s) => { s.transformerEnabled = !!enabled; }),
      setTransformerRatio: (ratio) => set((s) => {
        if (!Number.isFinite(ratio) || ratio <= 0) return;
        s.transformerRatio = Math.max(1, ratio);
      }),

      zoomSwrView: (factor, pivotMHz) => set((s) => {
        if (!Number.isFinite(factor) || factor <= 0) return;
        const oldSpan = s.swrViewSpanMHz;
        const pivot = pivotMHz !== undefined && Number.isFinite(pivotMHz) ? pivotMHz : s.swrViewCenterMHz;
        const newSpanRaw = oldSpan * factor;
        const newCenterRaw = pivot + (s.swrViewCenterMHz - pivot) * (newSpanRaw / oldSpan);
        const { center, span } = clampSwrView(newCenterRaw, newSpanRaw);
        s.swrViewCenterMHz = center;
        s.swrViewSpanMHz = span;
      }),

      panSwrView: (fraction) => set((s) => {
        if (!Number.isFinite(fraction)) return;
        const { center, span } = clampSwrView(s.swrViewCenterMHz + fraction * s.swrViewSpanMHz, s.swrViewSpanMHz);
        s.swrViewCenterMHz = center;
        s.swrViewSpanMHz = span;
      }),

      panSwrViewByMHz: (deltaMHz) => set((s) => {
        if (!Number.isFinite(deltaMHz)) return;
        const { center, span } = clampSwrView(s.swrViewCenterMHz + deltaMHz, s.swrViewSpanMHz);
        s.swrViewCenterMHz = center;
        s.swrViewSpanMHz = span;
      }),

      resetSwrView: () => set((s) => {
        const { center, span } = clampSwrView(s.frequency, defaultSwrSpan(s.frequency));
        s.swrViewCenterMHz = center;
        s.swrViewSpanMHz = span;
      }),

      setAtuEnabled: (enabled) => set((s) => { s.atuEnabled = !!enabled; }),
      setAtuMainFeedlineLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.atuMainFeedlineLength = Math.max(0, Math.min(300, meters));
      }),

      captureComparisonReference: () => set((s) => {
        s.comparisonReference = createComparisonSnapshot(s);
      }),

      clearComparisonReference: () => set((s) => { s.comparisonReference = null; }),

      setTIndex: (v) => set((s) => {
        if (!Number.isFinite(v)) return;
        s.tIndex = Math.max(-100, Math.min(250, v));
      }),
      setLatitude: (deg) => set((s) => {
        if (deg === null) { s.latitudeDeg = null; return; }
        if (!Number.isFinite(deg)) return;
        s.latitudeDeg = Math.max(-90, Math.min(90, deg));
      }),
      setLongitude: (deg) => set((s) => {
        if (deg === null) { s.longitudeDeg = null; return; }
        if (!Number.isFinite(deg)) return;
        let v = deg;
        while (v > 180) v -= 360;
        while (v < -180) v += 360;
        s.longitudeDeg = v;
      }),
      setMonthOverride: (m) => set((s) => {
        if (m === null) { s.monthOverride = null; return; }
        if (!Number.isFinite(m)) return;
        const i = Math.round(m);
        s.monthOverride = Math.max(1, Math.min(12, i));
      }),
      setUtcHourOverride: (h) => set((s) => {
        if (h === null) { s.utcHourOverride = null; return; }
        if (!Number.isFinite(h)) return;
        s.utcHourOverride = Math.max(0, Math.min(23.99, h));
      }),
      setGeolocationStatus: (st) => set((s) => { s.geolocationStatus = st; }),

      _setSimulationData: (r, sweep, feedpointImpedance) => set((s) => {
        s.result = r;
        s.sweep = [...sweep];
        s.feedpointImpedance = feedpointImpedance ?? null;
        s.loading = false;
        s.error = null;
      }),

      _setSweep: (sweep) => set((s) => {
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
