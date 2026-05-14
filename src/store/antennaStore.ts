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
  AntennaType,
} from '../physics/types';
import {
  DEFAULT_BALUN_IMPEDANCE_OHMS,
  DEFAULT_FEEDLINE_ID,
  DEFAULT_FEEDLINE_LENGTH_M,
  DEFAULT_GROUND_ID,
  DEFAULT_WIRE_RADIUS_M,
  SLOPING_V_MIN_TIP_Z_M,
  findFeedlinePreset,
  findGroundPreset,
  halfWaveLength,
  referenceLength,
} from '../physics/constants';
import type { UnitSystem } from '../physics/units';

export type OrientationPreset = 'EW' | 'NS' | 'NE-SW' | 'NW-SE';
export type Orientation = OrientationPreset | number;
export type Theme = 'dark' | 'light';
export type Mode = 'normal' | 'nvis' | 'comparison';
export type Colormap = 'viridis' | 'turbo' | 'jet';

export interface ComparisonSnapshot {
  readonly antennaType: AntennaType;
  readonly type: AntennaType; // Legacy alias
  readonly frequency: number;
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly vAngle: number;
  readonly slope: number;
  readonly legSlope: number; // Legacy alias
  readonly groundId: string;
  readonly groundSigma: number;
  readonly groundEpsilon: number;
  readonly feedlineId: string;
  readonly feedlineLength: number;
  readonly feedlineOffset: number;
  readonly balunEnabled: boolean;
  readonly result: SimulationResult;
  readonly sweep: SweepPoint[];
  readonly capturedAt: number;
}

export interface AntennaState {
  // Antenna geometry (metres, MHz)
  antennaType: AntennaType;
  type: AntennaType; // Legacy alias for backward compatibility

  frequency: number;
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;

  /**
   * For V-beam and sloping V: the interior angle between the two legs,
   * degrees (10..180). For Inverted V: the interior angle at the apex.
   */
  vAngle: number;

  /**
   * For sloping V: the downward slope angle of each leg relative to
   * the horizontal, degrees (0..90).
   */
  slope: number;
  legSlope: number; // Legacy alias for backward compatibility

  // Environment
  groundId: string;
  groundSigma: number;
  groundEpsilon: number;

  // Feedline
  feedlineId: string;
  feedlineLength: number;
  feedlineOffset: number;
  balunEnabled: boolean;

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

  // Propagation
  tIndex: number;
  latitudeDeg: number | null;
  longitudeDeg: number | null;
  monthOverride: number | null;
  utcHourOverride: number | null;
  geolocationStatus: 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error';

  // Solver output
  result: SimulationResult | null;
  sweep: SweepPoint[];
  error: string | null;
  loading: boolean;
  engineReady: boolean;
  comparisonReference: ComparisonSnapshot | null;

  // Actions — user-facing
  setAntennaType(type: AntennaType): void;
  setType(type: AntennaType): void; // Legacy alias

  setFrequency(mhz: number): void;
  setLength(meters: number): void;
  setHalfWaveLength(): void;
  setHeight(meters: number): void;
  setOrientation(o: Orientation): void;
  setVAngle(deg: number): void;

  setSlope(deg: number): void;
  setLegSlope(deg: number): void; // Legacy alias

  setWireRadius(meters: number): void;
  setSegments(n: number): void;
  setGround(id: string): void;
  setCustomGround(sigma: number, epsilon: number): void;
  setFeedline(id: string): void;
  setFeedlineLength(meters: number): void;
  setFeedlineOffset(meters: number): void;
  setBalunEnabled(enabled: boolean): void;
  setTheme(t: Theme): void;
  toggleTheme(): void;
  setUnits(u: UnitSystem): void;
  toggleUnits(): void;
  setMode(m: Mode): void;
  setColormap(c: Colormap): void;
  setPatternScale(s: number): void;
  setDbRange(db: number): void;
  setColorMaxDb: (db: number) => void;
  setShowGrid(v: boolean): void;
  setShowAxes(v: boolean): void;
  setShowPolarCuts(v: boolean): void;
  captureComparisonReference(): void;
  clearComparisonReference(): void;

  // Propagation actions
  setTIndex(v: number): void;
  setLatitude(deg: number | null): void;
  setLongitude(deg: number | null): void;
  setMonthOverride(month: number | null): void;
  setUtcHourOverride(hour: number | null): void;
  setGeolocationStatus(s: AntennaState['geolocationStatus']): void;

  // Actions — internal (used by hooks/workers only, prefixed with _)
  _setSimulationData(r: SimulationResult, sweep: readonly SweepPoint[]): void;
  _setError(msg: string | null): void;
  _setLoading(v: boolean): void;
  _setEngineReady(v: boolean): void;
}

const INITIAL_FREQ = 7.1;
const INITIAL_HEIGHT = 10;
const INITIAL_TYPE: AntennaType = 'dipole';
const INITIAL_LENGTH = referenceLength(INITIAL_TYPE, INITIAL_FREQ);

export const useAntennaStore = create<AntennaState>()(
  subscribeWithSelector(
    immer((set) => ({
      antennaType: INITIAL_TYPE,
      type: INITIAL_TYPE,
      frequency: INITIAL_FREQ,
      length: INITIAL_LENGTH,
      height: INITIAL_HEIGHT,
      orientation: 'EW',
      wireRadius: DEFAULT_WIRE_RADIUS_M,
      segments: 21,
      vAngle: 180,
      slope: 0,
      legSlope: 0,

      groundId: DEFAULT_GROUND_ID,
      groundSigma: findGroundPreset(DEFAULT_GROUND_ID).sigma,
      groundEpsilon: findGroundPreset(DEFAULT_GROUND_ID).epsilon,

      feedlineId: DEFAULT_FEEDLINE_ID,
      feedlineLength: DEFAULT_FEEDLINE_LENGTH_M,
      feedlineOffset: 0,
      balunEnabled: false,

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

      tIndex: 30,
      latitudeDeg: null,
      longitudeDeg: null,
      monthOverride: null,
      utcHourOverride: null,
      geolocationStatus: 'idle',

      result: null,
      sweep: [],
      error: null,
      loading: false,
      engineReady: false,
      comparisonReference: null,

      setAntennaType: (type) => set((s) => {
        s.antennaType = type;
        s.type = type;
        if (type !== 'dipole') {
          s.feedlineId = 'none';
          s.feedlineLength = 0;
          s.feedlineOffset = 0;
          s.balunEnabled = false;
        }

        // Initialize topology defaults if switching
        if (type === 'dipole') {
          s.slope = 0;
          s.legSlope = 0;
          s.vAngle = 180;
        } else if (type === 'inverted-v') {
          s.vAngle = 120;
          s.slope = 0;
          s.legSlope = 0;
        } else if (type === 'sloping-v') {
          s.vAngle = 90;
          s.slope = 30;
          s.legSlope = 30;
        } else if (type === 'v-beam') {
          s.vAngle = 90;
          s.slope = 0;
          s.legSlope = 0;
        } else if (type === 'delta-loop') {
          s.vAngle = 180;
          s.slope = 0;
          s.legSlope = 0;
        }

        s.length = calculateDefaultLength(type, s.frequency);
        const limit = Math.max(0, s.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setType: (type) => {
        // useAntennaStore.getState() is fine inside an action if we are not in a component
        const current = useAntennaStore.getState();
        current.setAntennaType(type);
      },
      setFrequency: (mhz) => set((s) => { s.frequency = clampFreq(mhz); }),
      setLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.length = Math.max(0.1, meters);
        const limit = Math.max(0, s.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setHalfWaveLength: () => set((s) => {
        s.length = calculateDefaultLength(s.antennaType, s.frequency);
        const limit = Math.max(0, s.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setHeight: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.height = Math.max(0, meters);
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
      setSlope: (deg) => set((s) => {
        if (!Number.isFinite(deg)) return;
        const val = Math.max(0, Math.min(90, deg));
        s.slope = val;
        s.legSlope = val;
      }),
      setLegSlope: (deg) => {
        const current = useAntennaStore.getState();
        current.setSlope(deg);
      },
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
        findFeedlinePreset(id);
        s.feedlineId = id;
      }),
      setFeedlineLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.feedlineLength = Math.max(0, Math.min(200, meters));
      }),
      setFeedlineOffset: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        const limit = Math.max(0, s.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
        s.feedlineOffset = Math.max(-limit, Math.min(limit, meters));
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
      setColorMaxDb: (db) => set((s) => { s.colorMaxDb = Math.max(-20, Math.min(30, db)); }),
      setShowGrid: (v) => set((s) => { s.showGrid = v; }),
      setShowAxes: (v) => set((s) => { s.showAxes = v; }),
      setShowPolarCuts: (v) => set((s) => { s.showPolarCuts = v; }),
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
  return v % 2 === 0 ? v + 1 : v;
}

function calculateDefaultLength(type: AntennaType, frequencyMHz: number): number {
  const lambda = 299.792458 / frequencyMHz;
  switch (type) {
    case 'dipole':
      return halfWaveLength(frequencyMHz);
    case 'inverted-v':
      return halfWaveLength(frequencyMHz, 0.97); // 0.485λ
    case 'delta-loop':
      return lambda;
    case 'sloping-v':
    case 'v-beam':
      return lambda * 2;
    default:
      return halfWaveLength(frequencyMHz);
  }
}

export const DIPOLE_TAG = 1;
export const DIPOLE_LEFT_TAG = 1;
export const DIPOLE_RIGHT_TAG = 2;
export const FEED_BRIDGE_TAG = 3;
export const FEEDLINE_SHIELD_TAG = 4;

const FEEDLINE_SHIELD_SEGMENTS = 11;
const FEEDLINE_BRIDGE_LENGTH_M = 0.05;
const FEEDLINE_GROUND_GAP_M = 0.1;

/**
 * Build Inverted-V wires.
 */
function buildInvertedVWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments' | 'frequency' | 'vAngle'>,
): Wire[] {
  const half = state.length / 2;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);
  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  const requestedSlopeDeg = (180 - state.vAngle) / 2;
  const maxSin = half > 0 ? (h - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const requestedSlopeRad = (requestedSlopeDeg * Math.PI) / 180;
  const effectiveSlopeRad = Math.min(requestedSlopeRad, maxSlopeRad);

  const cosS = Math.cos(effectiveSlopeRad);
  const sinS = Math.sin(effectiveSlopeRad);

  function legPointAt(axis: number, side: number): [number, number, number] {
    const lx = axis * cosS * side;
    const lz = -axis * sinS;
    return [cleanZero(dx * lx), cleanZero(dy * lx), cleanZero(h + lz)];
  }

  const lambda = 299.792458 / state.frequency;
  const minSegPerLeg = Math.ceil(20 * half / lambda);
  const segmentsPerLeg = Math.max(9, minSegPerLeg, Math.round(state.segments / 2));

  return [
    {
      start: legPointAt(half, -1),
      end: legPointAt(0, 0),
      radius: state.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: legPointAt(0, 0),
      end: legPointAt(half, 1),
      radius: state.wireRadius,
      segments: segmentsPerLeg,
      tag: DIPOLE_RIGHT_TAG,
    },
  ];
}

function orientationVector(o: Orientation): [number, number] {
  let deg = 0;
  if (typeof o === 'number') {
    deg = o;
  } else {
    switch (o) {
      case 'NS': deg = 0; break;
      case 'EW': deg = 90; break;
      case 'NE-SW': deg = 45; break;
      case 'NW-SE': deg = 315; break;
    }
  }
  const rad = ((90 - deg) * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

export function buildWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'antennaType' | 'type' | 'vAngle' | 'slope' | 'frequency' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
): Wire[] {
  const antennaType = state.antennaType ?? state.type ?? 'dipole';
  const frequency = state.frequency ?? 7.1;
  const vAngle = state.vAngle ?? (antennaType === 'inverted-v' ? 120 : (antennaType === 'sloping-v' || antennaType === 'v-beam' ? 90 : 180));
  const slope = state.slope ?? (antennaType === 'sloping-v' ? 30 : 0);

  if (antennaType === 'inverted-v') {
    return buildInvertedVWires({
      length: state.length,
      height: state.height,
      orientation: state.orientation,
      wireRadius: state.wireRadius,
      segments: state.segments,
      frequency,
      vAngle,
    });
  }

  const half = state.length / 2;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);
  const [px, py] = [-dy, dx];
  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  const slopeDeg = (antennaType === 'sloping-v' || antennaType === 'v-beam') ? slope : 0;
  const vAngleDeg = (antennaType === 'sloping-v' || antennaType === 'v-beam' || antennaType === 'delta-loop') ? vAngle : 180;

  const maxSin = half > 0 ? (h - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const requestedSlopeRad = (slopeDeg * Math.PI) / 180;
  const effectiveSlopeRad = Math.min(requestedSlopeRad, maxSlopeRad);

  const cosS = Math.cos(effectiveSlopeRad);
  const sinS = Math.sin(effectiveSlopeRad);

  const openingHalfRad = ((180 - vAngleDeg) / 2 * Math.PI) / 180;
  const cosV = Math.cos(openingHalfRad);
  const sinV = Math.sin(openingHalfRad);

  function legPointAt(axis: number, side: number): [number, number, number] {
    const lx = axis * cosS * cosV * side;
    const ly = axis * cosS * sinV;
    const lz = -axis * sinS;
    const wx = dx * lx + px * ly;
    const wy = dy * lx + py * ly;
    const wz = h + lz;
    return [cleanZero(wx), cleanZero(wy), cleanZero(wz)];
  }

  const layout = computeFeedlineLayout(state);
  if (!layout) {
    if (antennaType !== 'dipole') {
      return [
        {
          start: legPointAt(half, -1),
          end: legPointAt(0, 0),
          radius: state.wireRadius,
          segments: Math.max(1, Math.round(state.segments / 2)),
          tag: DIPOLE_LEFT_TAG,
        },
        {
          start: legPointAt(0, 0),
          end: legPointAt(half, 1),
          radius: state.wireRadius,
          segments: Math.max(1, Math.round(state.segments / 2)),
          tag: DIPOLE_RIGHT_TAG,
        },
      ];
    }
    return [{
      start: [cleanZero(-half * dx), cleanZero(-half * dy), h],
      end: [cleanZero(half * dx), cleanZero(half * dy), h],
      radius: state.wireRadius,
      segments: state.segments,
      tag: DIPOLE_TAG,
    }];
  }

  const offset = layout.offset;
  const bridgeHalf = FEEDLINE_BRIDGE_LENGTH_M / 2;
  const bridgeStart = legPointAt(offset - bridgeHalf, offset < 0 ? -1 : 1);
  const bridgeEnd = legPointAt(offset + bridgeHalf, offset < 0 ? -1 : 1);
  const leftTip = legPointAt(half, -1);
  const rightTip = legPointAt(half, 1);

  const dist = (p1: [number, number, number], p2: [number, number, number]) =>
    Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 + (p1[2] - p2[2]) ** 2);

  const leftLen = dist(leftTip, bridgeStart);
  const rightLen = dist(rightTip, bridgeEnd);
  const totalSeg = state.segments;
  const segDensity = totalSeg / state.length;
  const leftSeg = Math.max(3, oddRound(leftLen * segDensity));
  const rightSeg = Math.max(3, oddRound(rightLen * segDensity));

  const wires: Wire[] = [
    {
      start: leftTip, end: bridgeStart,
      radius: state.wireRadius,
      segments: leftSeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: bridgeEnd, end: rightTip,
      radius: state.wireRadius,
      segments: rightSeg,
      tag: DIPOLE_RIGHT_TAG,
    },
    {
      start: bridgeStart, end: bridgeEnd,
      radius: state.wireRadius,
      segments: 1,
      tag: FEED_BRIDGE_TAG,
    },
  ];

  if (layout.shield) {
    wires.push({
      start: bridgeEnd,
      end: [bridgeEnd[0], bridgeEnd[1], layout.shield.bottomZ],
      radius: layout.shield.radius,
      segments: FEEDLINE_SHIELD_SEGMENTS,
      tag: FEEDLINE_SHIELD_TAG,
    });
  }
  return wires;
}

function computeFeedlineLayout(
  state: Pick<AntennaState, 'length' | 'height'> &
    Partial<Pick<AntennaState, 'antennaType' | 'type' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
): { offset: number; shield: { bottomZ: number; radius: number } | null } | null {
  const antennaType = state.antennaType ?? state.type ?? 'dipole';
  if (antennaType !== 'dipole') return null;
  const id = state.feedlineId;
  if (!id || id === 'none') return null;
  const preset = findFeedlinePreset(id);
  if (preset.id === 'none' || preset.shieldOuterRadiusM <= 0) return null;
  const len = state.feedlineLength;
  if (typeof len !== 'number' || !Number.isFinite(len) || len <= 0) return null;
  const limit = Math.max(0, state.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
  const rawOffset = state.feedlineOffset ?? 0;
  const offset = Math.max(-limit, Math.min(limit, rawOffset));
  const topZ = state.height;
  const minBottomZ = state.height > 0 ? FEEDLINE_GROUND_GAP_M : -len;
  const desiredBottomZ = topZ - len;
  const bottomZ = Math.max(minBottomZ, desiredBottomZ);
  const drop = topZ - bottomZ;
  if (drop < 0.05) return { offset, shield: null };
  return { offset, shield: { bottomZ, radius: preset.shieldOuterRadiusM } };
}

function oddRound(v: number): number {
  const n = Math.max(1, Math.round(v));
  return n % 2 === 0 ? n + 1 : n;
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
  const hasShield = wires.some((w) => w.tag === FEEDLINE_SHIELD_TAG);
  const hasBridge = wires.some((w) => w.tag === FEED_BRIDGE_TAG);
  const feedlineActive = hasBridge && state.antennaType === 'dipole';

  const dipoleCentreSeg = Math.ceil(state.segments / 2);
  let excitation: SimulationInput['excitation'];
  if (feedlineActive && hasShield) {
    excitation = { wireTag: FEEDLINE_SHIELD_TAG, segment: FEEDLINE_SHIELD_SEGMENTS };
  } else if (feedlineActive) {
    excitation = { wireTag: FEED_BRIDGE_TAG, segment: 1 };
  } else if (state.antennaType !== 'dipole') {
    // For V and loop topologies, feed at the join of the two legs (DIPOLE_LEFT end / DIPOLE_RIGHT start)
    // buildWires/buildInvertedVWires puts the apex at DIPOLE_LEFT end.
    const leftLeg = wires.find((w) => w.tag === DIPOLE_LEFT_TAG);
    excitation = { wireTag: DIPOLE_LEFT_TAG, segment: leftLeg ? leftLeg.segments : 1 };
  } else {
    excitation = { wireTag: DIPOLE_TAG, segment: dipoleCentreSeg };
  }

  const transmissionLines: TransmissionLine[] = [];
  const loads: SegmentLoad[] = [];

  if (feedlineActive && hasShield) {
    const preset = findFeedlinePreset(state.feedlineId);
    const electricalLength = state.feedlineLength / Math.max(0.05, preset.velocityFactor);
    transmissionLines.push({
      fromTag: FEED_BRIDGE_TAG, fromSegment: 1,
      toTag: FEEDLINE_SHIELD_TAG, toSegment: FEEDLINE_SHIELD_SEGMENTS,
      z0: preset.z0, lengthM: electricalLength,
    });
    if (state.balunEnabled) {
      loads.push({
        type: 4, wireTag: FEEDLINE_SHIELD_TAG,
        segmentStart: 1, segmentEnd: 1,
        param1: DEFAULT_BALUN_IMPEDANCE_OHMS, param2: 0,
      });
    }
  }

  return {
    wires, frequencyMHz: state.frequency,
    ground: buildGroundParams(state), excitation,
    patternResolution: { thetaSteps: 37, phiSteps: 72 },
    transmissionLines: transmissionLines.length > 0 ? transmissionLines : undefined,
    loads: loads.length > 0 ? loads : undefined,
  };
}

function createComparisonSnapshot(state: AntennaState): ComparisonSnapshot | null {
  if (!state.result || state.sweep.length === 0) return null;
  return {
    antennaType: state.antennaType,
    type: state.antennaType,
    frequency: state.frequency,
    length: state.length,
    height: state.height,
    orientation: state.orientation,
    wireRadius: state.wireRadius,
    segments: state.segments,
    vAngle: state.vAngle,
    slope: state.slope,
    legSlope: state.slope,
    groundId: state.groundId,
    groundSigma: state.groundSigma,
    groundEpsilon: state.groundEpsilon,
    feedlineId: state.feedlineId,
    feedlineLength: state.feedlineLength,
    feedlineOffset: state.feedlineOffset,
    balunEnabled: state.balunEnabled,
    result: state.result,
    sweep: [...state.sweep],
    capturedAt: Date.now(),
  };
}
