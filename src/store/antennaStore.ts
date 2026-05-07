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

export type OrientationPreset = 'EW' | 'NS' | 'NE-SW' | 'NW-SE';
export type Orientation = OrientationPreset | number;
export type Theme = 'dark' | 'light';
export type Mode = 'normal' | 'nvis' | 'comparison';
export type Colormap = 'viridis' | 'turbo' | 'jet';

export type AntennaType = 'dipole' | 'inverted-v' | 'sloping-v' | 'delta-loop';

export interface ComparisonSnapshot {
  readonly type: AntennaType;
  readonly frequency: number;
  readonly length: number;
  readonly height: number;
  readonly orientation: Orientation;
  readonly wireRadius: number;
  readonly segments: number;
  readonly vAngle: number;
  readonly legSlope: number;
  readonly terminatedEnabled?: boolean;
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
  type: AntennaType;
  frequency: number;
  length: number;
  height: number;
  orientation: Orientation;
  wireRadius: number;
  segments: number;
  vAngle: number;
  legSlope: number;

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
  terminatedEnabled: boolean;
  terminatingResistor: number;

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
  setType(t: AntennaType): void;
  setFrequency(mhz: number): void;
  setLength(meters: number): void;
  setHalfWaveLength(): void;
  setHeight(meters: number): void;
  setOrientation(o: Orientation): void;
  setVAngle(degrees: number): void;
  setLegSlope(degrees: number): void;
  setWireRadius(meters: number): void;
  setSegments(n: number): void;
  setGround(id: string): void;
  setCustomGround(sigma: number, epsilon: number): void;
  setFeedline(id: string): void;
  setFeedlineLength(meters: number): void;
  setFeedlineOffset(meters: number): void;
  setBalunEnabled(enabled: boolean): void;
  setTerminatedEnabled(enabled: boolean): void;
  setTerminatingResistor(ohms: number): void;
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
const INITIAL_LENGTH = halfWaveLength(INITIAL_FREQ); // resonant ½λ

export const useAntennaStore = create<AntennaState>()(
  subscribeWithSelector(
    immer((set) => ({
      type: 'dipole',
      frequency: INITIAL_FREQ,
      length: INITIAL_LENGTH,
      height: INITIAL_HEIGHT,
      orientation: 'EW',
      wireRadius: DEFAULT_WIRE_RADIUS_M,
      segments: 21,
      vAngle: 120,
      legSlope: 45,

      groundId: DEFAULT_GROUND_ID,
      groundSigma: findGroundPreset(DEFAULT_GROUND_ID).sigma,
      groundEpsilon: findGroundPreset(DEFAULT_GROUND_ID).epsilon,

      feedlineId: DEFAULT_FEEDLINE_ID,
      feedlineLength: DEFAULT_FEEDLINE_LENGTH_M,
      feedlineOffset: 0,
      balunEnabled: false,
      terminatedEnabled: false,
      terminatingResistor: 450,

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

      setFrequency: (mhz) => set((s) => { s.frequency = clampFreq(mhz); }),
      setLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.length = Math.max(0.1, meters);
        // Re-clamp feedline offset to fit inside the new dipole.
        const limit = Math.max(0, s.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setHalfWaveLength: () => set((s) => {
        s.length = halfWaveLength(s.frequency);
        const limit = Math.max(0, s.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setHeight: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.height = Math.max(0, meters);
      }),
      setType: (t) => set((s) => {
        s.type = t;
        // Reset dependent state that does not apply to the new type, to
        // avoid stale values silently affecting the simulation:
        //   - Feedline only models a coax run on a plain horizontal dipole.
        //     For V-shapes / loops we force 'none' so a stale shield wire
        //     can't poison the geometry next time the user switches back.
        //   - Termination has different physical meanings per type and the
        //     UI should reflect the new context, so we clear it on change.
        if (t !== 'dipole') {
          s.feedlineId = 'none';
        }
        s.terminatedEnabled = false;
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
      setVAngle: (v) => set((s) => { s.vAngle = Math.max(10, Math.min(180, v)); }),
      setLegSlope: (l) => set((s) => { s.legSlope = Math.max(0, Math.min(90, l)); }),
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
      setTerminatedEnabled: (enabled) => set((s) => { s.terminatedEnabled = enabled; }),
      setTerminatingResistor: (ohms) => set((s) => { s.terminatingResistor = Math.max(1, ohms); }),
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
 * Base (closing) wire of a delta loop. Distinct from DIPOLE_TAG (=1)
 * because the loop's left leg already uses tag 1 and we need to be able
 * to find the base wire unambiguously in selectSimulationInput.
 */
export const DELTA_BASE_TAG = 5;
/** @deprecated kept for binary-compat with earlier termination prototype.
 *  No wire is built with this tag any more — termination is now implemented
 *  via LD cards on existing tip segments rather than dedicated drop wires.
 */
export const TERM_LEFT_TAG = 10;
/** @deprecated see {@link TERM_LEFT_TAG}. */
export const TERM_RIGHT_TAG = 11;

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
  state: Pick<AntennaState, 'type' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'vAngle' | 'legSlope' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset' | 'terminatedEnabled'>>,
): Wire[] {
  if (state.type === 'delta-loop') {
    return buildDeltaLoopWires(state);
  } else if (state.type === 'inverted-v' || state.type === 'sloping-v') {
    return buildVWires(state);
  }
  return buildDipoleWires(state);
}

function buildDeltaLoopWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'>
): Wire[] {
  const L = state.length;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);

  // Apex at top, fed at the apex
  const apexZ = h;
  const apex = [0, 0, apexZ];

  // Equilateral triangle
  const side = L / 3;
  const heightTri = side * Math.sqrt(3) / 2;
  const baseZ = Math.max(0.1, h - heightTri); // Keep above ground

  const halfBase = side / 2;
  const left = [-halfBase * dx, -halfBase * dy, baseZ];
  const right = [halfBase * dx, halfBase * dy, baseZ];

  const segPerSide = Math.max(3, oddRound(state.segments / 3));

  return [
    {
      start: left as [number, number, number], end: apex as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_LEFT_TAG
    },
    {
      start: apex as [number, number, number], end: right as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DIPOLE_RIGHT_TAG
    },
    {
      start: right as [number, number, number], end: left as [number, number, number],
      radius: state.wireRadius, segments: segPerSide, tag: DELTA_BASE_TAG
    }
  ];
}

function buildVWires(
  state: Pick<AntennaState, 'type' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'vAngle' | 'legSlope' | 'terminatedEnabled'>>
): Wire[] {
  const half = state.length / 2;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);

  const apex: [number, number, number] = [0, 0, h];
  const halfSeg = Math.max(3, Math.floor(state.segments / 2));

  let end1: [number, number, number];
  let end2: [number, number, number];

  if (state.type === 'inverted-v') {
    // Classic inverted V. Both legs lie in the SAME vertical plane that
    // contains the orientation axis (so for orientation='EW' the V sits in
    // the X-Z plane). The legs go in OPPOSITE horizontal directions along
    // the orientation axis, both drooping below the apex.
    //
    // `vAngle` is the included angle between the two legs measured in that
    // vertical plane (i.e. the apex angle). Each leg therefore drops below
    // horizontal by (180° - vAngle) / 2.
    const slopeRad = ((180 - (state.vAngle ?? 120)) / 2) * Math.PI / 180;
    const projLen = half * Math.cos(slopeRad);
    const zDrop = half * Math.sin(slopeRad);
    const tipZ = Math.max(0.1, h - zDrop);
    end1 = [-projLen * dx, -projLen * dy, tipZ];
    end2 = [+projLen * dx, +projLen * dy, tipZ];
  } else {
    // Sloping V (a.k.a. drooping V / vee-beam, fed at the apex). The two
    // legs share the apex, splay outward by ±halfAngle around the
    // orientation axis (so the V opens in the +orientation direction),
    // and droop downward by `legSlope`.
    //
    // NOTE: this geometry is necessarily symmetric about the orientation
    // axis. A symmetric V cannot exhibit the asymmetric travelling-wave
    // forward-gain pattern of a true terminated rhombic / asymmetric V —
    // see the PR-101 review for the deeper discussion.
    const vAngleRad = ((state.vAngle ?? 120) * Math.PI) / 180;
    const halfAngle = vAngleRad / 2;
    const slopeRad = ((state.legSlope ?? 45) * Math.PI) / 180;
    const projLen = half * Math.cos(slopeRad);
    const zDrop = half * Math.sin(slopeRad);
    const tipZ = Math.max(0.1, h - zDrop);

    const leg1DirX = dx * Math.cos(halfAngle) - dy * Math.sin(halfAngle);
    const leg1DirY = dx * Math.sin(halfAngle) + dy * Math.cos(halfAngle);
    const leg2DirX = dx * Math.cos(-halfAngle) - dy * Math.sin(-halfAngle);
    const leg2DirY = dx * Math.sin(-halfAngle) + dy * Math.cos(-halfAngle);

    end1 = [projLen * leg1DirX, projLen * leg1DirY, tipZ];
    end2 = [projLen * leg2DirX, projLen * leg2DirY, tipZ];
  }

  const wires: Wire[] = [
    {
      start: end1, end: apex,
      radius: state.wireRadius, segments: halfSeg, tag: DIPOLE_LEFT_TAG
    },
    {
      start: apex, end: end2,
      radius: state.wireRadius, segments: halfSeg, tag: DIPOLE_RIGHT_TAG
    }
  ];

  // Termination is modelled as an LD card on the outermost tip segment of
  // each leg (see selectSimulationInput). No additional geometry is needed —
  // an extra "drop to ground" wire was previously inserted here, but it is
  // not physical: a real terminated V / rhombic places the resistor across
  // the open leg ends (often to a counterpoise / radial system not modelled
  // here), not as a floating vertical 10 cm above an unrelated ground
  // surface. Keeping the antenna geometry minimal also avoids NEC warnings
  // about wires very close to ground without a proper bond.

  return wires;
}

function buildDipoleWires(
  state: Pick<AntennaState, 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments'> &
    Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
): Wire[] {
  const half = state.length / 2;
  const h = state.height;
  const [dx, dy] = orientationVector(state.orientation);

  // Helper that normalises -0 → +0 so endpoints compare cleanly.
  const cleanZero = (v: number): number => (v === 0 ? 0 : v);

  // Geometric endpoints of the dipole.
  const start: [number, number, number] = [cleanZero(-half * dx), cleanZero(-half * dy), h];
  const end: [number, number, number] = [cleanZero(half * dx), cleanZero(half * dy), h];

  // Decide whether to build the split-dipole + shield topology.
  const layout = computeFeedlineLayout(state);

  if (!layout) {
    // Plain single-wire dipole (no feedline).
    return [{
      start, end,
      radius: state.wireRadius,
      segments: state.segments,
      tag: DIPOLE_TAG,
    }];
  }

  // Split-dipole layout. The bridge is centred at axisCentre + offset along
  // the dipole axis. Bridge endpoints are the inner ends of each half.
  const offset = layout.offset;
  const bridgeHalf = FEEDLINE_BRIDGE_LENGTH_M / 2;
  // Position along the axis (signed distance from the dipole midpoint):
  //   left half:  axis ∈ [-half, offset - bridgeHalf]
  //   bridge:     axis ∈ [offset - bridgeHalf, offset + bridgeHalf]
  //   right half: axis ∈ [offset + bridgeHalf, half]
  const leftLen = offset - bridgeHalf - (-half);
  const rightLen = half - (offset + bridgeHalf);

  function pointAt(axis: number): [number, number, number] {
    return [cleanZero(axis * dx), cleanZero(axis * dy), h];
  }

  const leftStart = pointAt(-half);
  const leftEnd = pointAt(offset - bridgeHalf);
  const bridgeStart = leftEnd;
  const bridgeEnd = pointAt(offset + bridgeHalf);
  const rightStart = bridgeEnd;
  const rightEnd = pointAt(half);

  // Allocate segments to each half proportionally to its length, keeping
  // them odd and at least 3 so NEC has enough resolution near the feed.
  const totalSeg = state.segments;
  const segDensity = totalSeg / state.length;
  const leftSeg = Math.max(3, oddRound(leftLen * segDensity));
  const rightSeg = Math.max(3, oddRound(rightLen * segDensity));

  const wires: Wire[] = [
    {
      start: leftStart, end: leftEnd,
      radius: state.wireRadius,
      segments: leftSeg,
      tag: DIPOLE_LEFT_TAG,
    },
    {
      start: rightStart, end: rightEnd,
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

  // Shield drops vertically from the bridge's right-hand vertex (where the
  // right dipole half begins). This attachment to ONE leg, not the centre,
  // is the source of the unbalanced feed effect.
  if (layout.shield) {
    wires.push({
      start: rightStart,
      end: [rightStart[0], rightStart[1], layout.shield.bottomZ],
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
    Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
): FeedlineLayout | null {
  const id = state.feedlineId;
  if (!id || id === 'none') return null;
  const preset = findFeedlinePreset(id);
  if (preset.id === 'none' || preset.shieldOuterRadiusM <= 0) return null;

  const len = state.feedlineLength;
  if (typeof len !== 'number' || !Number.isFinite(len) || len <= 0) return null;

  // Clamp offset to keep the source bridge inside the dipole.
  const limit = Math.max(0, state.length / 2 - FEEDLINE_BRIDGE_LENGTH_M);
  const rawOffset = state.feedlineOffset ?? 0;
  const offset = Math.max(-limit, Math.min(limit, rawOffset));

  // Compute shield drop (clamped above the ground plane).
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
  const feedlineActive = hasBridge; // bridge is added iff feedline is configured

  // Excitation:
  //   - Feedline active: the EX is at the *rig* end of the coax shield
  //     (bottom segment of the shield wire). The TL card carries the
  //     differential signal from there back to the antenna terminals
  //     (the source bridge).
  //   - No feedline: legacy single-wire dipole, fed at its centre segment.
  const dipoleCentreSeg = Math.ceil(state.segments / 2);
  let excitationWire = DIPOLE_TAG;
  let excitationSeg = dipoleCentreSeg;

  if (feedlineActive && hasShield) {
    excitationWire = FEEDLINE_SHIELD_TAG;
    excitationSeg = FEEDLINE_SHIELD_SEGMENTS;
  } else if (feedlineActive) {
    excitationWire = FEED_BRIDGE_TAG;
    excitationSeg = 1;
  } else if (state.type === 'inverted-v' || state.type === 'sloping-v') {
    // Fed at the apex, which is the end of the left leg (or start of right leg)
    const leftWire = wires.find((w) => w.tag === DIPOLE_LEFT_TAG);
    if (leftWire) {
      excitationWire = DIPOLE_LEFT_TAG;
      excitationSeg = leftWire.segments; // The end closest to apex
    }
  } else if (state.type === 'delta-loop') {
    // Fed at the apex
    const leftWire = wires.find((w) => w.tag === DIPOLE_LEFT_TAG);
    if (leftWire) {
      excitationWire = DIPOLE_LEFT_TAG;
      excitationSeg = leftWire.segments; // The end closest to apex
    }
  }

  const excitation = { wireTag: excitationWire, segment: excitationSeg };

  const transmissionLines: TransmissionLine[] = [];
  const loads: SegmentLoad[] = [];

  if (feedlineActive && hasShield) {
    const preset = findFeedlinePreset(state.feedlineId);
    // NEC's TL card uses free-space propagation; to model a real cable
    // with velocity factor < 1 we pass the *electrical* length, which is
    // physical length / VF. (β·ℓ_phys / VF gives the correct phase shift.)
    const electricalLength = state.feedlineLength / Math.max(0.05, preset.velocityFactor);
    transmissionLines.push({
      // Antenna terminals (source bridge) <-> bottom of shield (the rig).
      fromTag: FEED_BRIDGE_TAG,
      fromSegment: 1,
      toTag: FEEDLINE_SHIELD_TAG,
      toSegment: FEEDLINE_SHIELD_SEGMENTS,
      z0: preset.z0,
      lengthM: electricalLength,
      // Shunt admittances are left at zero. Cable copper/dielectric loss
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

  if (state.terminatedEnabled && state.terminatingResistor) {
    if (state.type === 'delta-loop') {
      // Delta loop: fed at apex, so terminated opposite feedpoint (centre
      // of the base wire, which is its own DELTA_BASE_TAG).
      const bottomWire = wires.find(w => w.tag === DELTA_BASE_TAG);
      if (bottomWire) {
        const midSeg = Math.ceil(bottomWire.segments / 2);
        loads.push({
          type: 4,
          wireTag: DELTA_BASE_TAG,
          segmentStart: midSeg,
          segmentEnd: midSeg,
          param1: state.terminatingResistor,
          param2: 0
        });
      }
    } else if (state.type === 'inverted-v' || state.type === 'sloping-v') {
      // V-shapes: tag 1 wire runs end1 -> apex (so segment 1 is the leg
      // tip, the open end). Tag 2 wire runs apex -> end2 (so segment N is
      // the open end). Place the resistor on the tip segment of each leg —
      // this is the textbook treatment of a terminated V / rhombic, where
      // the load absorbs the leg's traveling-wave current at the open end.
      //
      // Caveat: with a real ground this is still an idealisation — a real
      // terminated V grounds the far side of the resistor through a
      // counterpoise or radial system that NEC must see as a wire bond.
      // Without that, the load behaves more like a series end-resistor
      // than a true matched termination. This is documented in the UI
      // hint and is sufficient to demonstrate the qualitative pattern
      // change.
      const leftLeg = wires.find(w => w.tag === DIPOLE_LEFT_TAG);
      const rightLeg = wires.find(w => w.tag === DIPOLE_RIGHT_TAG);
      if (leftLeg) {
        loads.push({
          type: 4,
          wireTag: DIPOLE_LEFT_TAG,
          segmentStart: 1,
          segmentEnd: 1,
          param1: state.terminatingResistor,
          param2: 0,
        });
      }
      if (rightLeg) {
        loads.push({
          type: 4,
          wireTag: DIPOLE_RIGHT_TAG,
          segmentStart: rightLeg.segments,
          segmentEnd: rightLeg.segments,
          param1: state.terminatingResistor,
          param2: 0,
        });
      }
    } else {
      // Dipole (T2FD-style end loading). Two cases:
      //   - Single-wire dipole (no feedline): one wire tagged DIPOLE_TAG;
      //     load segment 1 and segment N (the two tips).
      //   - Split dipole (feedline active): tag 1 = left half, tag 2 =
      //     right half. The outer tip of the left half is segment 1 of
      //     tag 1; the outer tip of the right half is segment N of tag 2.
      const single = wires.find(w => w.tag === DIPOLE_TAG && !hasBridge);
      if (single) {
        loads.push({
          type: 4,
          wireTag: DIPOLE_TAG,
          segmentStart: 1,
          segmentEnd: 1,
          param1: state.terminatingResistor,
          param2: 0,
        });
        loads.push({
          type: 4,
          wireTag: DIPOLE_TAG,
          segmentStart: single.segments,
          segmentEnd: single.segments,
          param1: state.terminatingResistor,
          param2: 0,
        });
      } else {
        const leftHalf = wires.find(w => w.tag === DIPOLE_LEFT_TAG);
        const rightHalf = wires.find(w => w.tag === DIPOLE_RIGHT_TAG);
        if (leftHalf) {
          loads.push({
            type: 4,
            wireTag: DIPOLE_LEFT_TAG,
            segmentStart: 1, // outer (leftmost) tip
            segmentEnd: 1,
            param1: state.terminatingResistor,
            param2: 0,
          });
        }
        if (rightHalf) {
          loads.push({
            type: 4,
            wireTag: DIPOLE_RIGHT_TAG,
            segmentStart: rightHalf.segments, // outer (rightmost) tip
            segmentEnd: rightHalf.segments,
            param1: state.terminatingResistor,
            param2: 0,
          });
        }
      }
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
    type: state.type,
    frequency: state.frequency,
    length: state.length,
    height: state.height,
    orientation: state.orientation,
    wireRadius: state.wireRadius,
    segments: state.segments,
    vAngle: state.vAngle,
    legSlope: state.legSlope,
    terminatedEnabled: state.terminatedEnabled,
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
