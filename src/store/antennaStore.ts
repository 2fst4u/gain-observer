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
  ImpedanceResult,
  GroundParams,
  SweepPoint,
  Wire,
  TransmissionLine,
  SegmentLoad,
  NetworkLoad,
  AntennaType,
} from '../physics/types';
import {
  TRANSFORMER_CHOKE_OHMS,
  ATU_COMPONENT_Q,
  DEFAULT_FEEDLINE_ID,
  DEFAULT_FEEDLINE_LENGTH_M,
  DEFAULT_ATU_MAIN_FEEDLINE_LENGTH_M,
  DEFAULT_GROUND_ID,
  DEFAULT_WIRE_RADIUS_M,
  SLOPING_V_MIN_TIP_Z_M,
  findFeedlinePreset,
  findGroundPreset,
  referenceLength,
  halfWaveLength,
  MAIN_WIRE_TAG,
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  FEED_BRIDGE_LENGTH_M,
  DELTA_BASE_TAG,
  SLOPING_V_LEFT_STUB_TAG,
  SLOPING_V_RIGHT_STUB_TAG,
  SLOPING_V_STUB_BOTTOM_Z_M,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  TERMINATED_DELTA_BRIDGE_TAG,
  VERTICAL_WHIP_TAG,
  DEFAULT_WHIP_LENGTH_M,
  INVERTED_L_VERTICAL_TAG,
  FOLDED_DIPOLE_OPPOSITE_TAG,
  FOLDED_DIPOLE_CONNECTOR_TAG,
  FOLDED_DIPOLE_TERM_BRIDGE_TAG,
  FOLDED_DIPOLE_DEFAULT_APERTURE_M,
  FOLDED_DIPOLE_MAX_APERTURE_M,
} from '../physics/constants';

// Re-export geometry tags for UI and tests.
export {
  MAIN_WIRE_TAG,
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  DELTA_BASE_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  TERMINATED_DELTA_BRIDGE_TAG,
  VERTICAL_WHIP_TAG,
  INVERTED_L_VERTICAL_TAG,
  FOLDED_DIPOLE_OPPOSITE_TAG,
  FOLDED_DIPOLE_CONNECTOR_TAG,
  FOLDED_DIPOLE_TERM_BRIDGE_TAG,
};
import type { Theme } from '../utils/themeColors';
import type { UnitSystem } from '../physics/units';
import type { AtuMatchConfig } from '../physics/impedance';
import {
  buildInvertedVWires,
  buildSlopingVWires,
  buildDeltaLoopWires,
  buildTerminatedDeltaWires,
  buildVerticalWhipWires,
  buildInvertedLWires,
  buildFoldedAntennaWires,
  buildDipoleWires,
  type Orientation,
} from './antennaGeometry';

// Re-export shared types for UI and geometry.
export type { AntennaType };
export type { Orientation };

const FEEDLINE_SUPPORTED_TYPES = new Set<string>(['dipole', 'inverted-v', 'delta-loop', 'sloping-v', 'terminated-delta', 'folded-dipole']);

// Recommended ("auto") terminating-resistor values, in ohms. These double as the
// default value applied when an antenna type that supports a terminating resistor
// is selected, and as the value set by the auto-resistance button in the UI.
export const SLOPING_V_DEFAULT_TERMINATION_OHMS = 300;
export const TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS = 600;

/**
 * The recommended terminating resistance for an antenna type, in ohms, or 0 for
 * types that do not support a terminating resistor. This is the single source of
 * truth behind both the per-type default and the auto-resistance button:
 *
 *   • sloping-V / terminated-delta — a fixed design value (≈ the structure's
 *     characteristic impedance over real ground).
 *   • folded-dipole — the characteristic impedance Z₀ of the two-wire line,
 *     which depends on the conductor spacing (aperture) and wire radius:
 *     Z₀ = 120 · acosh(D / 2r). Terminating at R = Z₀ gives a travelling-wave
 *     (T2FD) broadband match.
 */
export function recommendedTerminatingResistor(
  antennaType: AntennaType,
  foldedDipoleAperture: number,
  wireRadius: number,
): number {
  switch (antennaType) {
    case 'sloping-v':
      return SLOPING_V_DEFAULT_TERMINATION_OHMS;
    case 'terminated-delta':
      return TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS;
    case 'folded-dipole':
      return Math.round(120 * Math.acosh(foldedDipoleAperture / (2 * wireRadius)));
    default:
      return 0;
  }
}

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
  'folded-dipole': { enabled: true, ratio: 6 },
  // Base-fed monopole-style verticals: unbalanced feedpoint, no balun.
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

  /**
   * For sloping V: the interior angle between the two legs,
   * degrees (10..180). For Inverted V: the interior angle at the apex.
   */
  vAngle: number;

  /**
   * For sloping V: the downward slope angle of each leg relative to
   * the horizontal, degrees (0..90).
   */
  legSlope: number;

  /**
   * Folded-dipole only: spacing between the two parallel conductors
   * (metres). Larger apertures widen impedance bandwidth and eventually
   * introduce array-like pattern effects. Ignored for other antenna types.
   */
  foldedDipoleAperture: number;

  /**
   * Far-end terminating resistor (ohms).
   * 0 = unterminated.
   *
   * - sloping-V: inserts stub wires with NEC LD cards for tip-to-earth termination.
   * - terminated-delta: inserts a single horizontal bridge wire across the
   *   gap at the centre of the base, with one NEC LD card carrying the full
   *   resistor value. This is the T2FD / aperiodic-loop topology — the
   *   resistor absorbs the wave that propagates around the loop from the
   *   apex feed, giving broadband flat impedance instead of a cardioid.
   */
  terminatingResistor: number;

  /**
   * Vertical-whip only: when true, deploy a 4-radial counterpoise at the
   * base. Without it the whip is freestanding and NEC reports the very
   * high reactance / SWR that a radial-less monopole physically exhibits.
   * Ignored for all other antenna types.
   */
  whipCounterpoise: boolean;

  // Environment
  groundId: string;
  groundSigma: number;
  groundEpsilon: number;

  // Feedline (coax / parallel-line modelled as physical radiating shield
  // wire + NEC TL card for the differential signal).
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

  // Ideal transformer post-processing display (does not affect NEC simulation)
  transformerEnabled: boolean;
  /** Impedance transformation ratio n² (e.g. 9 for a 3:1 turns-ratio transformer). */
  transformerRatio: number;

  // Idealised ATU at the base of the mast (post-processing display only). The
  // feedline above acts as the up-mast run; this is the main run down to the
  // shack, which the tuner keeps at ~1:1.
  atuEnabled: boolean;
  atuMainFeedlineLength: number;

  // Propagation
  tIndex: number;
  latitudeDeg: number | null;
  longitudeDeg: number | null;
  monthOverride: number | null;
  utcHourOverride: number | null;
  geolocationStatus: 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error';

  // SWR sweep view window (user-controlled zoom/pan, MHz). The sweep is
  // sampled across exactly [center - span/2, center + span/2] so zooming in
  // resamples a narrower span at full point density rather than upscaling
  // a fixed dataset.
  swrViewCenterMHz: number;
  swrViewSpanMHz: number;

  // Solver output
  result: SimulationResult | null;
  /**
   * Bare antenna feedpoint impedance (no feedline, no transformer), solved
   * alongside `result` only when a transformer is fitted over a feedline. It is
   * the transformer-independent reference the Match suggestion matches to the
   * feedline impedance, so the suggested ratio is stable no matter which
   * transformer is currently fitted. Null when not applicable / not yet solved.
   */
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
  /**
   * Sets each leg to `n` wavelengths for sloping-V and snaps the
   * V-angle to the optimal value. No-op for other antenna types.
   */
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

  // SWR sweep zoom / pan (lateral only — the y-axis is intentionally fixed).
  /** Multiply the view span by `factor` (<1 zooms in, >1 zooms out), keeping
   *  `pivotMHz` (default: window centre) fixed on screen. */
  zoomSwrView(factor: number, pivotMHz?: number): void;
  /** Shift the view centre laterally by `fraction` of the current span. */
  panSwrView(fraction: number): void;
  /** Shift the view centre by an absolute number of MHz (for drag-to-pan). */
  panSwrViewByMHz(deltaMHz: number): void;
  /** Re-centre on the operating frequency at the default span. */
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

  // Actions — internal (used by hooks/workers only, prefixed with _)
  _setSimulationData(
    r: SimulationResult,
    sweep: readonly SweepPoint[],
    feedpointImpedance?: ImpedanceResult | null,
  ): void;
  /** Replace only the SWR sweep (efficient zoom/pan recompute — leaves the
   *  radiation pattern result untouched). */
  _setSweep(sweep: readonly SweepPoint[]): void;
  _setError(msg: string | null): void;
  _setLoading(v: boolean): void;
  _setEngineReady(v: boolean): void;
}

const INITIAL_FREQ = 7.1; // 40m band per user spec
const INITIAL_HEIGHT = 8; // metres
const INITIAL_TYPE: AntennaType = 'dipole';
const INITIAL_LENGTH = referenceLength(INITIAL_TYPE, INITIAL_FREQ); // resonant reference length

// SWR sweep view-window bounds (MHz). The window is always clamped inside this
// range, which matches the engine's sweep limits (Nec2Engine.F_MIN/F_MAX_MHZ).
export const SWR_VIEW_F_MIN_MHZ = 1.0;
export const SWR_VIEW_F_MAX_MHZ = 30;
// Tightest span the user can zoom to (kHz-scale detail) and the default span as
// a fraction of the operating frequency (the "logical default zoom").
const SWR_VIEW_MIN_SPAN_MHZ = 0.05;
const DEFAULT_SWR_VIEW_SPAN_FRACTION = 0.2;

/** Clamp a (centre, span) pair so the whole window stays within the HF limits. */
function clampSwrView(centerMHz: number, spanMHz: number): { center: number; span: number } {
  const fullSpan = SWR_VIEW_F_MAX_MHZ - SWR_VIEW_F_MIN_MHZ;
  const span = Math.min(fullSpan, Math.max(SWR_VIEW_MIN_SPAN_MHZ, spanMHz));
  const half = span / 2;
  const center = Math.min(SWR_VIEW_F_MAX_MHZ - half, Math.max(SWR_VIEW_F_MIN_MHZ + half, centerMHz));
  return { center, span };
}

/** Default view span (MHz) framed around the operating frequency. */
function defaultSwrSpan(frequencyMHz: number): number {
  return clampSwrView(frequencyMHz, frequencyMHz * DEFAULT_SWR_VIEW_SPAN_FRACTION).span;
}

const INITIAL_SWR_VIEW = clampSwrView(INITIAL_FREQ, defaultSwrSpan(INITIAL_FREQ));

/** The absolute [start, end] frequency window the SWR sweep is sampled over. */
export function selectSwrWindow(
  state: Pick<AntennaState, 'swrViewCenterMHz' | 'swrViewSpanMHz'>,
): { startMHz: number; endMHz: number } {
  const { center, span } = clampSwrView(state.swrViewCenterMHz, state.swrViewSpanMHz);
  return { startMHz: center - span / 2, endMHz: center + span / 2 };
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

        // When switching to a horizontal antenna, restore the default mast height
        // if the current height is 0. (Inverted-L keeps whatever height
        // is set since its height is the bend point, not the base.)
        if (type !== 'vertical-whip' && type !== 'inverted-l' && s.height === 0) {
          s.height = INITIAL_HEIGHT;
        }

        if (!FEEDLINE_SUPPORTED_TYPES.has(type)) {
          s.feedlineId = 'none';
          s.feedlineLength = 0;
          s.feedlineOffset = 0;
        } else {
          // Every feedline-capable antenna defaults to an RG-58 coax run. Restore
          // it when returning from a non-feedline type (which clears it to 'none'),
          // while preserving any explicit cable the user has chosen.
          if (s.feedlineId === 'none') {
            s.feedlineId = DEFAULT_FEEDLINE_ID;
            s.feedlineLength = DEFAULT_FEEDLINE_LENGTH_M;
          }
          if (type !== 'dipole') {
            // Apex-fed antennas don't support an offset; reset it so UI is consistent.
            s.feedlineOffset = 0;
          }
        }
        s.length = calculateDefaultLength(type, s.frequency);

        if (type === 'dipole') {
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
        } else if (type === 'vertical-whip') {
          // User-specified default: 32 ft long (9.75 m).
          // The resonant length (¼λ) at the current frequency is available
          // via the "¼λ" button (setHalfWaveLength → calculateDefaultLength).
          s.length = DEFAULT_WHIP_LENGTH_M;
          s.height = 0;
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
          s.whipCounterpoise = true;
        } else if (type === 'inverted-l') {
          // Base-fed L-antenna. `height` is the bend-point height (= vertical
          // section length). If coming from a vertical whip with height=0,
          // restore a sensible mast height so there is a vertical section.
          if (s.height === 0) s.height = INITIAL_HEIGHT;
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
          s.whipCounterpoise = true;
        } else if (type === 'folded-dipole') {
          // Two parallel half-wave conductors separated vertically by the
          // aperture. Plain (unterminated) by default — ~300 Ω feedpoint,
          // dipole-like pattern. A non-zero terminating resistor (TFD) adds
          // a series R at the top-conductor centre, raising the feedpoint by
          // approximately R (Z ≈ 300 + R Ω). The 6:1 balun is appropriate for
          // both unterminated (~300 Ω → ~50 Ω) and terminated
          // (e.g. R=600 Ω → ~900 Ω → ~150 Ω) cases; for optimal traveling-wave
          // termination choose R ≈ Z0 of the two-wire line (typically 600–700 Ω
          // for typical HF apertures of 0.1–0.5 m with 1 mm wire).
          s.vAngle = 180;
          s.legSlope = 0;
          s.terminatingResistor = 0;
        } else if (type === 'sloping-v') {
          // Slope is auto-computed from height and leg length (tips at ground).
          // V-angle snaps to the value giving maximum forward gain; the user
          // can then adjust it via the slider.
          s.vAngle = computeOptimalVAngleDeg(s.length, s.frequency, s.height);
          s.legSlope = 0;
          // Default ~300 Ω per leg matches the reference design (antenna.be/sv.html).
          if (s.terminatingResistor === 0) s.terminatingResistor = SLOPING_V_DEFAULT_TERMINATION_OHMS;
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
          // 600 Ω is a typical match for the characteristic impedance of an
          // HF wire loop over real ground (Z0 ≈ 60·ln(2h/a) ≈ 500–700 Ω at
          // common HF heights). Sitting near loop-Z0 is what gives the
          // bridge-terminated design its flat broadband impedance.
          if (s.terminatingResistor === 0) s.terminatingResistor = TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS;
        }

        // Consolidated transformer/balun defaults. Every balun-capable antenna
        // gets the transformer enabled (so the auto-matching button is present);
        // verticals stay unbalanced with no balun. Done here, after the per-type
        // geometry branches, so there is a single source of truth.
        const transformerDefaults = TRANSFORMER_DEFAULTS[type];
        s.transformerEnabled = transformerDefaults.enabled;
        s.transformerRatio = transformerDefaults.ratio;

        const limit = Math.max(0, s.length / 2 - FEED_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setFrequency: (mhz) => set((s) => {
        s.frequency = clampFreq(mhz);
        // Re-centre the SWR view on the new operating frequency (keeping the
        // current span) so the marker stays in frame after a band change.
        const { center, span } = clampSwrView(s.frequency, s.swrViewSpanMHz);
        s.swrViewCenterMHz = center;
        s.swrViewSpanMHz = span;
      }),
      setLength: (meters) => set((s) => {
        if (!Number.isFinite(meters)) return;
        s.length = Math.max(0.1, meters);
        const limit = Math.max(0, s.length / 2 - FEED_BRIDGE_LENGTH_M);
        if (s.feedlineOffset > limit) s.feedlineOffset = limit;
        if (s.feedlineOffset < -limit) s.feedlineOffset = -limit;
      }),
      setHalfWaveLength: () => set((s) => {
        const isTravelingWave = s.antennaType === 'sloping-v';
        if (isTravelingWave) {
          // Preserve the current leg multiple so a band change keeps the same
          // leg length in wavelengths (e.g. 3λ/leg on 40m stays 3λ/leg on 20m).
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
        // Clamp to [2 cm, FOLDED_DIPOLE_MAX_APERTURE_M]. The upper bound keeps
        // the antenna in the genuine folded-dipole regime (a realistic
        // conductor spacing) and, crucially, in the range where NEC's
        // close-parallel-wire solution converges within MAX_SEGS_PER_LEG.
        // Beyond that the structure morphs toward a loop and would need
        // impractically fine segmentation to solve accurately.
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
        // Keep the pivot frequency anchored at the same screen position.
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

/**
 * Returns the V-opening angle (degrees) that maximises forward gain for a
 * traveling-wave V antenna of the given total length at the given frequency.
 *
 * Derivation (Kraus / ARRL): a long wire of length L radiates its first peak
 * at angle θ from the wire axis where `cos(θ) ≈ 1 − 0.371·λ/L`. In a V the
 * two legs combine constructively along the bisector when the projection of
 * each leg's unit direction onto the bisector equals cos(θ).
 *
 * For a sloping-V each leg is tilted downward at slope angle α from
 * horizontal. Its unit direction is (sinV·cosα, cosV·cosα, −sinα). The
 * projection onto the forward bisector [0,1,0] is cosV·cosα. Setting
 * cosV·cosα = 1 − 0.371λ/L gives:
 *
 *   cosV = (1 − 0.371·λ/L) / cos(α)
 *
 * At α = 0 (horizontal) this reduces to the Kraus formula exactly.
 *
 * Clamped to [10°, 180°].
 */
export function computeOptimalVAngleDeg(
  totalLengthM: number,
  frequencyMHz: number,
  heightM?: number,
): number {
  const lambda = 299.792458 / frequencyMHz;
  const legLen = Math.max(0.01, (totalLengthM - FEED_BRIDGE_LENGTH_M) / 2);
  let cosHalfV = 1 - (0.371 * lambda) / legLen;

  if (heightM !== undefined && heightM > SLOPING_V_MIN_TIP_Z_M) {
    const sinSlope = Math.min(1, Math.max(0, (heightM - SLOPING_V_MIN_TIP_Z_M) / legLen));
    const cosSlope = Math.sqrt(1 - sinSlope * sinSlope);
    if (cosSlope > 1e-6) {
      cosHalfV = cosHalfV / cosSlope;
    }
  }

  const halfVRad = Math.acos(Math.max(-1, Math.min(1, cosHalfV)));
  return Math.max(10, Math.min(180, (2 * halfVRad * 180) / Math.PI));
}

/**
 * Returns the nearest integer leg-length multiple (λ per leg) for the current
 * sloping-V length at the given frequency. Minimum 1.
 */
export function legMultipleFromLength(totalLengthM: number, frequencyMHz: number): number {
  const lambda = 299.792458 / frequencyMHz;
  const legLen = Math.max(0, (totalLengthM - FEED_BRIDGE_LENGTH_M) / 2);
  return Math.max(1, Math.round(legLen / lambda));
}

function calculateDefaultLength(type: AntennaType, frequencyMHz: number): number {
  const lambda = 299.792458 / frequencyMHz;
  switch (type) {
    case 'dipole':
      return halfWaveLength(frequencyMHz);
    case 'inverted-v':
      // Inverted-V end-effect is higher (0.97) than a dipole (0.95) per spec.
      return lambda * 0.5 * 0.97;
    case 'delta-loop':
      return lambda;
    case 'sloping-v':
      return lambda * 2;
    case 'terminated-delta':
      // Same physical perimeter as a delta loop.
      return lambda;
    case 'vertical-whip':
      // Quarter-wave monopole resonant length (used by the ¼λ button).
      // The initial default on type-switch (32 ft / DEFAULT_WHIP_LENGTH_M)
      // is applied separately in setAntennaType so the user can pick
      // either a stock whip length or the resonant length.
      return lambda * 0.25 * 0.95;
    case 'inverted-l':
      // Total wire (vertical + horizontal) for a resonant quarter-wave.
      return lambda * 0.25 * 0.95;
    case 'folded-dipole':
      // Each conductor is a resonant half-wave (same as a standard dipole).
      return halfWaveLength(frequencyMHz);
    default:
      return halfWaveLength(frequencyMHz);
  }
}

// --------------- Selectors ---------------

const FEEDLINE_SHIELD_SEGMENTS = 11;
const FEEDLINE_GROUND_GAP_M = 0.1;

/**
 * Calculates the effective downward slope for a V-topology,
 * clamping it so the wire tips stay at or above SLOPING_V_MIN_TIP_Z_M.
 */
export function computeEffectiveSlope(
  state: Pick<AntennaState, 'length' | 'height' | 'legSlope'>,
) {
  const half = state.length / 2;
  const h = state.height;
  const requestedDeg = state.legSlope;

  const maxSin = half > 0 ? Math.max(0, h - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.min(1, maxSin));
  const requestedRad = (requestedDeg * Math.PI) / 180;

  const clamped = requestedRad > maxSlopeRad + 1e-7;
  const effectiveRad = Math.min(requestedRad, maxSlopeRad);
  const effectiveDeg = (effectiveRad * 180) / Math.PI;
  const tipHeightM = h - half * Math.sin(effectiveRad);

  return {
    requestedDeg,
    effectiveDeg,
    tipHeightM,
    clamped,
  };
}

export function buildWires(
  state: Pick<AntennaState, 'antennaType' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments' | 'frequency' | 'vAngle' | 'legSlope'> &
    Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength' | 'feedlineOffset' | 'whipCounterpoise' | 'foldedDipoleAperture' | 'terminatingResistor'>>,
): Wire[] {
  const wires = buildWiresInternal(state);
  const layout = computeFeedlineLayout(state);
  if (layout?.shield && state.antennaType !== 'delta-loop' && state.antennaType !== 'terminated-delta') {
    const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG);
    if (bridge) {
      wires.push({
        start: bridge.end,
        end: [bridge.end[0], bridge.end[1], layout.shield.bottomZ],
        radius: layout.shield.radius,
        segments: FEEDLINE_SHIELD_SEGMENTS,
        tag: FEEDLINE_SHIELD_TAG,
      });
    }
  }
  return wires;
}

function buildWiresInternal(
  state: Pick<AntennaState, 'antennaType' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments' | 'frequency' | 'vAngle' | 'legSlope'> &
    Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength' | 'feedlineOffset' | 'whipCounterpoise' | 'foldedDipoleAperture' | 'terminatingResistor'>>,
): Wire[] {
  const antennaType = state.antennaType;
  const h = state.height;

  if (antennaType === 'inverted-v') {
    return buildInvertedVWires({
      length: state.length,
      height: h,
      orientation: state.orientation,
      wireRadius: state.wireRadius,
      segments: state.segments,
      frequency: state.frequency,
      vAngle: state.vAngle,
    });
  }

  if (antennaType === 'sloping-v') {
    return buildSlopingVWires(state);
  }

  if (antennaType === 'delta-loop') {
    const layout = computeFeedlineLayout(state);
    const feedlineShield = layout?.shield
      ? { ...layout.shield, segments: FEEDLINE_SHIELD_SEGMENTS }
      : null;
    return buildDeltaLoopWires({
      length: state.length,
      height: h,
      orientation: state.orientation,
      wireRadius: state.wireRadius,
      segments: state.segments,
      frequency: state.frequency,
      feedlineShield,
    });
  }

  if (antennaType === 'terminated-delta') {
    const layout = computeFeedlineLayout(state);
    const feedlineShield = layout?.shield
      ? { ...layout.shield, segments: FEEDLINE_SHIELD_SEGMENTS }
      : null;
    return buildTerminatedDeltaWires({
      length: state.length,
      height: h,
      orientation: state.orientation,
      wireRadius: state.wireRadius,
      segments: state.segments,
      frequency: state.frequency,
      feedlineShield,
    });
  }

  if (antennaType === 'vertical-whip') {
    return buildVerticalWhipWires({
      length: state.length,
      height: h,
      wireRadius: state.wireRadius,
      segments: state.segments,
      frequency: state.frequency,
      counterpoise: state.whipCounterpoise ?? false,
    });
  }

  if (antennaType === 'inverted-l') {
    return buildInvertedLWires({
      length: state.length,
      height: h,
      orientation: state.orientation,
      wireRadius: state.wireRadius,
      segments: state.segments,
      frequency: state.frequency,
      counterpoise: state.whipCounterpoise ?? false,
    });
  }

  if (antennaType === 'folded-dipole') {
    return buildFoldedAntennaWires({
      length: state.length,
      height: h,
      aperture: state.foldedDipoleAperture ?? FOLDED_DIPOLE_DEFAULT_APERTURE_M,
      orientation: state.orientation,
      wireRadius: state.wireRadius,
      segments: state.segments,
      frequency: state.frequency,
      terminatingResistor: state.terminatingResistor ?? 0,
    });
  }

  const layout = computeFeedlineLayout(state);

  return buildDipoleWires({
    length: state.length,
    height: h,
    orientation: state.orientation,
    wireRadius: state.wireRadius,
    segments: state.segments,
    layout,
  });
}

interface FeedlineLayout {
  readonly offset: number;
  readonly shield: { readonly bottomZ: number; readonly radius: number } | null;
}

function computeFeedlineLayout(
  state: Pick<AntennaState, 'length' | 'height'> &
    Partial<Pick<AntennaState, 'antennaType' | 'feedlineId' | 'feedlineLength' | 'feedlineOffset'>>,
): FeedlineLayout | null {
  if (!FEEDLINE_SUPPORTED_TYPES.has(state.antennaType ?? '')) return null;

  const id = state.feedlineId;
  if (!id || id === 'none') return null;
  const preset = findFeedlinePreset(id);
  if (preset.id === 'none' || preset.shieldOuterRadiusM <= 0) return null;

  const len = state.feedlineLength;
  if (typeof len !== 'number' || !Number.isFinite(len) || len <= 0) return null;

  // Inverted-V and delta-loop are apex-fed: offset is meaningless, always 0.
  const limit = state.antennaType === 'dipole'
    ? Math.max(0, state.length / 2 - FEED_BRIDGE_LENGTH_M)
    : 0;
  const rawOffset = state.antennaType === 'dipole' ? (state.feedlineOffset ?? 0) : 0;
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


function buildGroundParams(state: AntennaState): GroundParams {
  // The height<=0 short-circuit makes the model "free space" when the user
  // sets the antenna at or below ground level — fine for horizontal antennas
  // (a dipole at h=0 is unphysical and should not pretend there's ground
  // beneath it). A vertical whip extends upward from its base, so a
  // ground-mounted whip (height=0) is the canonical case: it still needs
  // the configured ground beneath it, and switching to free space would
  // break the monopole's image-theory feedpoint impedance.
  if (state.height <= 0 && state.antennaType !== 'vertical-whip' && state.antennaType !== 'inverted-l') return { type: 'free' };
  switch (state.groundId) {
    case 'free': return { type: 'free' };
    case 'perfect': return { type: 'perfect' };
    default:
      return { type: 'real', sigma: state.groundSigma, epsilon: state.groundEpsilon };
  }
}

function buildExcitation(
  state: AntennaState,
  wires: Wire[],
  feedlineActive: boolean,
  hasBridge: boolean,
  hasShield: boolean,
) {
  if (feedlineActive && hasShield) {
    return { wireTag: FEEDLINE_SHIELD_TAG, segment: FEEDLINE_SHIELD_SEGMENTS };
  } else if (hasBridge) {
    return { wireTag: FEED_BRIDGE_TAG, segment: 1 };
  } else if (state.antennaType === 'delta-loop' || state.antennaType === 'terminated-delta') {
    // Apex-fed: excitation lives on the last segment of the left leg
    // (whose .end is the apex by convention in build*Wires).
    const leftLeg = wires.find((w) => w.tag === LEFT_LEG_TAG)!;
    return { wireTag: LEFT_LEG_TAG, segment: leftLeg.segments };
  } else if (state.antennaType === 'vertical-whip') {
    // Base-fed monopole: excitation on the first (lowest) segment.
    return { wireTag: VERTICAL_WHIP_TAG, segment: 1 };
  } else if (state.antennaType === 'inverted-l') {
    // Base-fed: excitation on the first (lowest) segment of the vertical section.
    return { wireTag: INVERTED_L_VERTICAL_TAG, segment: 1 };
  } else {
    const mainWireCentreSeg = Math.ceil(state.segments / 2);
    return { wireTag: MAIN_WIRE_TAG, segment: mainWireCentreSeg };
  }
}

function buildFeedlineElements(state: AntennaState, feedlineActive: boolean, hasShield: boolean) {
  const transmissionLines: TransmissionLine[] = [];
  const loads: SegmentLoad[] = [];
  const networks: NetworkLoad[] = [];

  if (feedlineActive && hasShield) {
    const preset = findFeedlinePreset(state.feedlineId);
    const electricalLength = state.feedlineLength / Math.max(0.05, preset.velocityFactor);
    const xfmrRatio = Math.max(1, state.transformerRatio);
    const xfmrActive = state.transformerEnabled && xfmrRatio > 1;

    if (xfmrActive) {
      // Real impedance-transforming unun at the antenna terminals, modelled
      // via an NEC NT (network) card. The transformer goes between the apex
      // bridge (port 1 = primary, antenna side, high Z) and the shield top
      // (port 2 = secondary, cable side, low Z). The TL card then carries
      // the matched signal from shield top to shield bottom through the
      // coax. NEC now sees the impedance step-down physically, so:
      //   • the coax is driven matched (low common-mode pressure)
      //   • the shield's residual radiation is suppressed by the choke
      //   • efficiency stops bleeding into shield-as-radiator
      //
      // The Y-matrix for an ideal transformer with voltage ratio n
      // (impedance ratio n² = xfmrRatio) and small primary-referred leakage
      // reactance X = ω·L_leak is:
      //   Y11 = -j/X    Y12 = +j·n/X    Y22 = -j·n²/X
      // Smaller X → closer to ideal. L_leak = 10 nH gives ~ 4.5 mΩ leakage at
      // 7 MHz — small enough to be ~ideal across HF, large enough to keep
      // the NEC matrix well-conditioned.
      const omega = 2 * Math.PI * state.frequency * 1e6;
      const xLeak = omega * 1e-8;
      const n = Math.sqrt(xfmrRatio);
      networks.push({
        fromTag: FEED_BRIDGE_TAG,
        fromSegment: 1,
        toTag: FEEDLINE_SHIELD_TAG,
        toSegment: 1,
        y11Real: 0, y11Imag: -1 / xLeak,
        y12Real: 0, y12Imag: +n / xLeak,
        y22Real: 0, y22Imag: -(n * n) / xLeak,
      });
      transmissionLines.push({
        fromTag: FEEDLINE_SHIELD_TAG,
        fromSegment: 1,
        toTag: FEEDLINE_SHIELD_TAG,
        toSegment: FEEDLINE_SHIELD_SEGMENTS,
        z0: preset.z0,
        lengthM: electricalLength,
      });
    } else {
      // No transformer: differential signal goes straight from the antenna
      // bridge to the rig end of the coax via a single TL card. With a
      // mismatched antenna this exposes the shield to large common-mode
      // currents — visible in the pattern as it should be.
      transmissionLines.push({
        fromTag: FEED_BRIDGE_TAG,
        fromSegment: 1,
        toTag: FEEDLINE_SHIELD_TAG,
        toSegment: FEEDLINE_SHIELD_SEGMENTS,
        z0: preset.z0,
        lengthM: electricalLength,
      });
    }

    // Choke on the shield top suppresses any residual common-mode current
    // (the transformer is reciprocal so common-mode on the shield isn't
    // automatically killed by the NT card itself).
    if (state.transformerEnabled) {
      loads.push({
        type: 4,
        wireTag: FEEDLINE_SHIELD_TAG,
        segmentStart: 1,
        segmentEnd: 1,
        param1: TRANSFORMER_CHOKE_OHMS,
        param2: 0,
      });
    }
  }

  return { transmissionLines, loads, networks };
}

function buildSlopingVTermination(R: number, radius: number, wires: Wire[]) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];
  // Model the physical tip-to-earth terminating resistor correctly:
  // add a short vertical stub wire from each tip down to near-ground
  // (SLOPING_V_STUB_BOTTOM_Z_M), then place the resistance in that stub.
  //
  // This creates an explicit NEC current path from the wire tip toward
  // the ground plane, matching the real antenna where the resistor
  // connects the wire end to a driven ground rod. A series LD on the
  // leg end alone does not create this shunt-to-earth current path.
  //
  // With graded segmentation each leg may be emitted as multiple sub-wires
  // sharing the leg's tag. By convention `buildSlopingVWires` emits the
  // LEFT leg tip→apex (so the first sub-wire's `.start` is the tip) and
  // the RIGHT leg apex→tip (so the last sub-wire's `.end` is the tip).
  let firstLeft: Wire | undefined;
  let lastRight: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (w.tag === LEFT_LEG_TAG && !firstLeft) firstLeft = w;
    if (w.tag === RIGHT_LEG_TAG) lastRight = w;
  }
  const leftTip  = firstLeft!.start;
  const rightTip = lastRight!.end;

  extraWires.push(
    {
      start: leftTip,
      end: [leftTip[0], leftTip[1], SLOPING_V_STUB_BOTTOM_Z_M],
      radius: radius,
      segments: 1,
      tag: SLOPING_V_LEFT_STUB_TAG,
    },
    {
      start: rightTip,
      end: [rightTip[0], rightTip[1], SLOPING_V_STUB_BOTTOM_Z_M],
      radius: radius,
      segments: 1,
      tag: SLOPING_V_RIGHT_STUB_TAG,
    },
  );
  loads.push(
    { type: 4, wireTag: SLOPING_V_LEFT_STUB_TAG,  segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
    { type: 4, wireTag: SLOPING_V_RIGHT_STUB_TAG, segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
  );

  return { extraWires, loads };
}

function buildTerminatedDeltaTermination(R: number, radius: number, wires: Wire[]) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];
  // T2FD / aperiodic-loop termination: a single horizontal bridge wire
  // spans the gap between the two half-base inner ends, and one LD-4
  // card places R Ω on its single segment. The wave that propagates
  // around the loop from the apex feed arrives at the bridge with
  // ~equal-and-opposite drive from each side; matching R to the loop's
  // characteristic impedance (~500–700 Ω over HF heights) flattens
  // the feedpoint impedance across an octave or more, at the cost of
  // efficiency on the fundamental.
  //
  // The LEFT half-base is emitted leftCorner → centreLeft so the
  // inner end is the wire's `.end`. The RIGHT half-base is emitted
  // centreRight → rightCorner so the inner end is the wire's `.start`.
  // The bridge runs leftInner → rightInner, joining the two halves
  // electrically through the resistor.
  let leftHalfBase: Wire | undefined;
  let rightHalfBase: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (w.tag === TERMINATED_DELTA_LEFT_BASE_TAG && !leftHalfBase) leftHalfBase = w;
    else if (w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG && !rightHalfBase) rightHalfBase = w;
    if (leftHalfBase && rightHalfBase) break;
  }
  const leftInner  = leftHalfBase!.end;
  const rightInner = rightHalfBase!.start;

  extraWires.push({
    start: leftInner,
    end: rightInner,
    radius: radius,
    segments: 1,
    tag: TERMINATED_DELTA_BRIDGE_TAG,
  });
  loads.push(
    { type: 4, wireTag: TERMINATED_DELTA_BRIDGE_TAG, segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
  );

  return { extraWires, loads };
}

function buildFoldedDipoleTermination(R: number, radius: number, wires: Wire[]) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];
  // Terminated Folded Dipole (TFD) — correct travelling-wave gap-bridge topology.
  //
  // buildFoldedAntennaWires splits the top (un-fed) conductor into two halves
  // with a gap of FEED_BRIDGE_LENGTH_M at the centre when a
  // terminating resistor is non-zero. The gap inner ends are:
  //   left-half  .end = topCenterLeft
  //   right-half .start = topCenterRight
  // We add a short horizontal bridge wire spanning that gap and place the
  // LD-4 load on its single segment. Current flowing in the top conductor
  // MUST pass through R to cross from one half to the other — exactly the
  // series-in-the-top-wire termination of a T2FD.
  //
  // This is identical in pattern to the terminated-delta bridge: the base is
  // split, the resistive bridge closes the gap, and wave energy is dissipated
  // rather than reflected. The gap is electrically small (≈ 0.1 m ≪ λ) so
  // it does not perturb the radiation pattern or the fundamental resonance.
  let leftHalfOpp: Wire | undefined;
  let rightHalfOpp: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (w.tag === FOLDED_DIPOLE_OPPOSITE_TAG) {
      if (!leftHalfOpp) {
        leftHalfOpp = w;
      } else if (!rightHalfOpp) {
        rightHalfOpp = w;
      }
    }
    if (leftHalfOpp && rightHalfOpp) break;
  }
  const topCenterLeft  = leftHalfOpp!.end;   // inner end of left half
  const topCenterRight = rightHalfOpp!.start; // inner end of right half

  extraWires.push({
    start: topCenterLeft,
    end: topCenterRight,
    radius: radius,
    segments: 1,
    tag: FOLDED_DIPOLE_TERM_BRIDGE_TAG,
  });
  loads.push({
    type: 4,
    wireTag: FOLDED_DIPOLE_TERM_BRIDGE_TAG,
    segmentStart: 1,
    segmentEnd: 1,
    param1: R,
    param2: 0,
  });

  return { extraWires, loads };
}

function buildTerminationElements(state: AntennaState, wires: Wire[]) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];

  if (state.terminatingResistor > 0) {
    switch (state.antennaType) {
      case 'sloping-v': {
        const { extraWires: ew, loads: l } = buildSlopingVTermination(state.terminatingResistor, state.wireRadius, wires);
        extraWires.push(...ew);
        loads.push(...l);
        break;
      }
      case 'terminated-delta': {
        const { extraWires: ew, loads: l } = buildTerminatedDeltaTermination(state.terminatingResistor, state.wireRadius, wires);
        extraWires.push(...ew);
        loads.push(...l);
        break;
      }
      case 'folded-dipole': {
        const { extraWires: ew, loads: l } = buildFoldedDipoleTermination(state.terminatingResistor, state.wireRadius, wires);
        extraWires.push(...ew);
        loads.push(...l);
        break;
      }
    }
  }

  return { extraWires, loads };
}

/**
 * Build the idealised mast-base ATU config for the realized-gain post-processing,
 * or `undefined` when the ATU is off. The currently-selected feedline doubles as
 * the up-mast run; `atuMainFeedlineLength` is the matched run down to the shack.
 * Pure (no store access) so it serves both the live state and comparison
 * snapshots, and ATU fields are deliberately absent from `selectSimulationInput`
 * — it's post-processing and must never trigger a NEC re-solve.
 */
export function selectAtuConfig(args: {
  atuEnabled: boolean;
  frequency: number;
  feedlineId: string;
  feedlineLength: number;
  atuMainFeedlineLength: number;
}): AtuMatchConfig | undefined {
  if (!args.atuEnabled) return undefined;
  return {
    frequencyMHz: args.frequency,
    preset: findFeedlinePreset(args.feedlineId),
    upmastLengthM: args.feedlineLength,
    mainLengthM: args.atuMainFeedlineLength,
    componentQ: ATU_COMPONENT_Q,
  };
}

export function selectSimulationInput(state: AntennaState): SimulationInput {
  const wires = buildWires(state);

  // ⚡ Bolt: Single pass for loop to replace multiple .some() array traversals
  let hasShield = false;
  let hasBridge = false;
  for (let i = 0; i < wires.length; i++) {
    const tag = wires[i].tag;
    if (tag === FEEDLINE_SHIELD_TAG) hasShield = true;
    else if (tag === FEED_BRIDGE_TAG) hasBridge = true;
    if (hasShield && hasBridge) break;
  }

  const feedlineSupport = FEEDLINE_SUPPORTED_TYPES.has(state.antennaType);
  const feedlineActive = hasBridge && feedlineSupport;

  const excitation = buildExcitation(state, wires, feedlineActive, hasBridge, hasShield);

  const feedlineElements = buildFeedlineElements(state, feedlineActive, hasShield);
  const { transmissionLines, networks, loads: feedlineLoads } = feedlineElements;
  let loads = feedlineLoads;

  const terminationElements = buildTerminationElements(state, wires);
  wires.push(...terminationElements.extraWires);
  loads = loads.concat(terminationElements.loads);

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
    networks: networks.length > 0 ? networks : undefined,
  };
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
