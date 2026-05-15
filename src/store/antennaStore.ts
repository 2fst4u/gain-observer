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
  SLOPING_V_MIN_TIP_Z_M,
  findFeedlinePreset,
  findGroundPreset,
  referenceLength,
  halfWaveLength,
  wavelengthMeters,
} from '../physics/constants';
import type { UnitSystem } from '../physics/units';

/**
 * Antenna topology type.
 *
 * Different topologies have different reference lengths for resonance:
 *   - dipole / inverted-v: ½λ total (standard resonant length).
 *   - delta-loop: 1λ perimeter.
 *   - sloping-v / v-beam: 2λ total (1λ per leg).
 */
export type AntennaType = 'dipole' | 'inverted-v' | 'delta-loop' | 'sloping-v' | 'v-beam';

export type OrientationPreset = 'EW' | 'NS' | 'NE-SW' | 'NW-SE';
export type Orientation = OrientationPreset | number;
export type Theme = 'dark' | 'light';
export type Mode = 'normal' | 'nvis' | 'comparison';
export type Colormap = 'viridis' | 'turbo' | 'jet';

export interface ComparisonSnapshot {
  readonly type: AntennaType;
  readonly frequency: number;
  readonly antennaType: AntennaType;
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly vAngle: number;
  readonly legSlope: number;
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
  /** Primary antenna type. 'type' is kept for backward compatibility. */
  antennaType: AntennaType;
  type: AntennaType;
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
  legSlope: number;
  /** Legacy alias for legSlope. */
  slope: number;

  // Environment
  groundId: string;
  groundSigma: number;
  groundEpsilon: number;

  // Feedline (coax / parallel-line modelled as physical radiating shield
  // wire + NEC TL card for the differential signal). When feedlineId is
  // 'none' the legacy direct-feed behaviour is used.
  //
  // feedlineOffset is the displacement of the shield's attachment point
  // from the geometric centre of the dipole, in metres along the dipole
  // axis (positive = toward the +X / "east" end). With offset = 0 the
  // model is symmetric and common-mode current is near zero (correct
  // physics for a perfectly balanced feed); any nonzero offset breaks the
  // symmetry and produces real common-mode shield radiation. Real coax
  // attachment is never perfectly centred, so this slider is the primary
  // knob for adjusting the unbalanced feed effect.
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

  // Propagation (HF sky-wave estimator inputs).
  //
  // tIndex is the Australian IPS / BOM ionospheric T-index (dimensionless,
  // typically -50..+200). It is entered manually — the app does not
  // currently fetch it from any service.
  //
  // latitudeDeg is the path-midpoint latitude. Defaults to null (we treat
  // null as 0° for predictions but the UI shows it as "not set"). The
  // browser geolocation API may populate it on user request.
  //
  // monthOverride / utcHourOverride let the user explore conditions at a
  // different time. When null, the UI auto-fills from the browser clock.
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
  setAntennaType(t: AntennaType): void;
  /** Legacy alias for setAntennaType. */
  setType(t: AntennaType): void;
  setFrequency(mhz: number): void;
  setLength(meters: number): void;
  setHalfWaveLength(): void;
  setHeight(meters: number): void;
  setOrientation(o: Orientation): void;
  setVAngle(deg: number): void;
  setLegSlope(deg: number): void;
  /** Legacy alias for setLegSlope. */
  setSlope(deg: number): void;
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

const INITIAL_FREQ = 7.1; // 40m band per user spec
const INITIAL_HEIGHT = 10; // metres
const INITIAL_TYPE: AntennaType = 'dipole';
const INITIAL_LENGTH = referenceLength(INITIAL_TYPE, INITIAL_FREQ); // resonant reference length

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
      vAngle: 90,
      legSlope: 30,
      slope: 30,

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

      // Propagation defaults: T=30 (~quiet sun, plausible long-term median),
      // no location until user requests it, no time override.
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

      setAntennaType: (t) => set((s) => {
        s.antennaType = t;
        s.type = t;
        // When switching to a non-dipole type, clear feedline state.
        if (t !== 'dipole') {
          s.feedlineId = 'none';
          s.feedlineLength = 0;
          s.feedlineOffset = 0;
          s.balunEnabled = false;
        }
        // Auto-resize length per topology.
        s.length = calculateDefaultLength(t, s.frequency);

        // Reset angles for specific types.
        if (t === 'dipole') {
          s.legSlope = 0;
          s.slope = 0;
          s.vAngle = 180;
        } else if (t === 'inverted-v') {
          s.vAngle = 120;
          s.legSlope = 30; // (180 - 120) / 2
          s.slope = 30;
        }

        // Re-clamp feedline offset (relevant if t is dipole).
        const limit = Math.max(0, s.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setType: (t) => {
        useAntennaStore.getState().setAntennaType(t);
      },
      setFrequency: (mhz) => set((s) => { s.frequency = clampFreq(mhz); }),
      setLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.length = Math.max(0.1, meters);
        // Re-clamp feedline offset to fit inside the new antenna.
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
          // Normalize to [0, 360)
          let normalized = o % 360;
          if (normalized < 0) normalized += 360;
          s.orientation = normalized;
        } else {
          s.orientation = o;
        }
      }),
      setVAngle: (deg) => set((s) => {
        if (!Number.isFinite(deg)) return;
        const v = Math.max(10, Math.min(180, deg));
        s.vAngle = v;
        // Sync legSlope for Inverted V
        if (s.antennaType === 'inverted-v') {
          const syncSlope = (180 - v) / 2;
          s.legSlope = syncSlope;
          s.slope = syncSlope;
        }
      }),
      setLegSlope: (deg) => set((s) => {
        if (!Number.isFinite(deg)) return;
        const v = Math.max(0, Math.min(90, deg));
        s.legSlope = v;
        s.slope = v;
        // Sync vAngle for Inverted V
        if (s.antennaType === 'inverted-v') {
          s.vAngle = 180 - 2 * v;
        }
      }),
      setSlope: (deg) => {
        useAntennaStore.getState().setLegSlope(deg);
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
      setFeedlineOffset: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        // The offset must keep the source bridge inside the dipole. We
        // clamp to length/2 minus a small margin for the bridge itself.
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
        // Clamp to the practical range. Anything outside this is unphysical.
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
        // Wrap into -180..+180.
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
  // NEC-2 conventionally wants an odd number of segments for a centre feed.
  return v % 2 === 0 ? v + 1 : v;
}

/**
 * Compute the default resonant/standard length for a given topology.
 *
 *  - Dipole / Inverted V: half-wave (0.5λ * 0.95 end-effect)
 *  - Delta loop: full-wave (1.0λ)
 *  - Sloping V / V-beam: 1λ per leg (2.0λ total)
 */
function calculateDefaultLength(type: AntennaType, frequencyMHz: number): number {
  const lambda = wavelengthMeters(frequencyMHz);
  switch (type) {
    case 'dipole':
    case 'inverted-v':
      return halfWaveLength(frequencyMHz);
    case 'delta-loop':
      return lambda;
    case 'sloping-v':
    case 'v-beam':
      return lambda * 2;
    default:
      return halfWaveLength(frequencyMHz);
  }
}

// --------------- Selectors ---------------

/**
 * Tag identifiers for the built-in geometry.
 *
 * When no feedline is active we use a single dipole wire on tag 1 (legacy
 * behaviour, preserved for backwards compat with tests and snapshots).
 *
 * When a feedline IS active we split the dipole into two halves separated
 * by a 1-segment "source bridge" — the antenna terminals — and add a
 * vertical coax-shield wire that physically connects to one side of the
 * bridge (offset from the geometric centre by `feedlineOffset`). This is
 * the textbook NEC modelling approach for an unchoked, unbalanced coax
 * feed: the asymmetric attachment naturally drives common-mode current
 * onto the outside of the shield.
 */
export const DIPOLE_TAG = 1;          // single-wire dipole (no feedline)
export const DIPOLE_LEFT_TAG = 1;     // left half of split dipole
export const DIPOLE_RIGHT_TAG = 2;    // right half of split dipole
export const FEED_BRIDGE_TAG = 3;     // 1-segment source bridge
export const FEEDLINE_SHIELD_TAG = 4; // coax shield (radiating outer surface)

/**
 * Number of segments on the coax shield wire. Odd so the middle segment
 * is well-defined; small enough to keep NEC fast but large enough to
 * resolve common-mode current variation along a multi-wavelength run.
 */
const FEEDLINE_SHIELD_SEGMENTS = 11;

/**
 * Physical length of the source bridge — the small wire segment that
 * stands in for the antenna terminals between the two dipole halves.
 * Kept short (5 cm) so it doesn't itself contribute meaningful radiation,
 * but long enough to satisfy NEC's segment-vs-radius geometry rules at
 * typical HF wire radii (≤ ~5 mm).
 */
const FEEDLINE_BRIDGE_LENGTH_M = 0.05;

/** Minimum gap (m) between the bottom of the shield wire and the ground
 * plane, to avoid NEC's "wire touching ground" warning. */
const FEEDLINE_GROUND_GAP_M = 0.1;

/**
 * Build a unit-vector along the chosen dipole orientation in the XY plane.
 *
 * Convention: 0° is North (+Y / NS), 90° is East (+X / EW).
 * Radio convention: 0 is North, clockwise increasing.
 */
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

  // To map radio degrees (0=N, 90=E) to unit circle (0=E, 90=N):
  // unit_angle = 90 - radio_angle
  const rad = ((90 - deg) * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
}

/**
 * Build the geometry vector for the current state.
 *
 * Two topologies are produced depending on whether a feedline is active:
 *
 *  • No feedline → a single dipole wire (tag 1), centre-fed.
 *
 *  • Feedline → split dipole topology:
 *      - tag 1: left half of the dipole.
 *      - tag 2: right half of the dipole.
 *      - tag 3: 1-segment "source bridge" between the halves; this is
 *               where the EX card sits when there is no TL card, or where
 *               the TL card's antenna-side terminates when there is one.
 *      - tag 4: vertical coax shield, attached at the bridge's right end
 *               (so the shield is connected to the right dipole leg, just
 *               like a real unchoked coax).
 *      The bridge is shifted along the dipole axis by `feedlineOffset`
 *      metres from the geometric centre. With offset = 0 the geometry is
 *      symmetric about the bridge midpoint and common-mode current is
 *      near zero; nonzero offset breaks the symmetry → real shield
 *      radiation.
 */
export function buildWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'frequency' | 'antennaType' | 'type' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset' | 'vAngle' | 'legSlope' | 'slope'>>,
): Wire[] {
  const antennaType = state.antennaType ?? state.type ?? 'dipole';
  const half = state.length / 2;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);
  const [px, py] = [-dy, dx];
  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  // Sloping V / Inverted V logic:
  const isSlopingV = antennaType === 'sloping-v';
  const isInvertedV = antennaType === 'inverted-v';

  let slopeDeg = 0;
  let vAngleDeg = 180;

  if (isSlopingV) {
    slopeDeg = state.legSlope ?? state.slope ?? 0;
    vAngleDeg = state.vAngle ?? 180;
  } else if (isInvertedV) {
    // Inverted V: drop angle derived from vAngle. drop = (180 - vAngle) / 2.
    slopeDeg = (180 - (state.vAngle ?? 120)) / 2;
    vAngleDeg = 180; // Legs are straight in XY plane relative to orientation axis.
  }

  // Validity check / Clamping:
  const maxSin = half > 0 ? (h - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const requestedSlopeRad = (slopeDeg * Math.PI) / 180;
  const effectiveSlopeRad = Math.min(requestedSlopeRad, maxSlopeRad);

  const cosS = Math.cos(effectiveSlopeRad);
  const sinS = Math.sin(effectiveSlopeRad);

  const openingHalfRad = ((180 - vAngleDeg) / 2 * Math.PI) / 180;
  const cosV = Math.cos(openingHalfRad);
  const sinV = Math.sin(openingHalfRad);

  /**
   * Map a position along a leg (axis ∈ [0, length/2]) to 3D space.
   * side = -1 (left leg) or +1 (right leg).
   */
  function legPointAt(axis: number, side: number): [number, number, number] {
    const lx = axis * cosS * cosV * side;
    const ly = axis * cosS * sinV;
    const lz = -axis * sinS;
    const wx = dx * lx + px * ly;
    const wy = dy * lx + py * ly;
    const wz = h + lz;
    return [cleanZero(wx), cleanZero(wy), cleanZero(wz)];
  }

  // Decide whether to build the split-dipole + shield topology.
  const layout = computeFeedlineLayout(state);

  if (!layout) {
    // Two-wire V topologies.
    if (isSlopingV || isInvertedV || vAngleDeg < 180 || slopeDeg > 0) {
      let segmentsPerLeg = Math.max(1, Math.round(state.segments / 2));
      if (isInvertedV && state.frequency) {
        const lambda = wavelengthMeters(state.frequency);
        const minSeg = Math.ceil(20 * half / lambda);
        segmentsPerLeg = Math.max(9, minSeg, segmentsPerLeg);
      }

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
    // Pure straight horizontal dipole (legacy path).
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

interface FeedlineLayout {
  readonly offset: number;
  readonly shield: { readonly bottomZ: number; readonly radius: number } | null;
}

function computeFeedlineLayout(
  state: Pick<AntennaState, 'length' | 'height'> &
    Partial<Pick<AntennaState, 'antennaType' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
): FeedlineLayout | null {
  if (state.antennaType && state.antennaType !== 'dipole') return null;

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
  if (drop < 0.05) {
    return { offset, shield: null };
  }

  return {
    offset,
    shield: {
      bottomZ,
      radius: preset.shieldOuterRadiusM,
    },
  };
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
  const excitation = feedlineActive && hasShield
    ? { wireTag: FEEDLINE_SHIELD_TAG, segment: FEEDLINE_SHIELD_SEGMENTS }
    : feedlineActive
      ? { wireTag: FEED_BRIDGE_TAG, segment: 1 }
      : state.antennaType === 'inverted-v'
        ? { wireTag: DIPOLE_LEFT_TAG, segment: wires.find(w => w.tag === DIPOLE_LEFT_TAG)!.segments }
        : { wireTag: DIPOLE_TAG, segment: dipoleCentreSeg };

  const transmissionLines: TransmissionLine[] = [];
  const loads: SegmentLoad[] = [];

  if (feedlineActive && hasShield) {
    const preset = findFeedlinePreset(state.feedlineId);
    const electricalLength = state.feedlineLength / Math.max(0.05, preset.velocityFactor);
    transmissionLines.push({
      fromTag: FEED_BRIDGE_TAG,
      fromSegment: 1,
      toTag: FEEDLINE_SHIELD_TAG,
      toSegment: FEEDLINE_SHIELD_SEGMENTS,
      z0: preset.z0,
      lengthM: electricalLength,
    });

    if (state.balunEnabled) {
      loads.push({
        type: 4,
        wireTag: FEEDLINE_SHIELD_TAG,
        segmentStart: 1,
        segmentEnd: 1,
        param1: DEFAULT_BALUN_IMPEDANCE_OHMS,
        param2: 0,
      });
    }
  }

  return {
    wires,
    frequencyMHz: state.frequency,
    ground: buildGroundParams(state),
    excitation,
    patternResolution: {
      thetaSteps: 37,
      phiSteps: 72,
    },
    transmissionLines: transmissionLines.length > 0 ? transmissionLines : undefined,
    loads: loads.length > 0 ? loads : undefined,
  };
}

function createComparisonSnapshot(state: AntennaState): ComparisonSnapshot | null {
  if (!state.result || state.sweep.length === 0) return null;
  return {
    type: state.antennaType,
    frequency: state.frequency,
    antennaType: state.antennaType,
    length: state.length,
    height: state.height,
    orientation: state.orientation,
    wireRadius: state.wireRadius,
    segments: state.segments,
    vAngle: state.vAngle,
    legSlope: state.legSlope,
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
