import type {
  SimulationInput,
  GroundParams,
  Wire,
  TransmissionLine,
  SegmentLoad,
  NetworkLoad,
  AntennaType,
} from '../physics/types';
import {
  SWEEP_F_MIN_MHZ,
  SWEEP_F_MAX_MHZ,
  TRANSFORMER_CHOKE_OHMS,
  ATU_COMPONENT_Q,
  findFeedlinePreset,
  feedlineLossDb,
  FEED_BRIDGE_LENGTH_M,
  SLOPING_V_COUNTERPOISE_RADIALS,
  SLOPING_V_COUNTERPOISE_LENGTH_WL,
  slopingVTerminationHubZ,
  wavelengthMeters,
  FOLDED_DIPOLE_DEFAULT_APERTURE_M,
  FOLDED_DIPOLE_FEED_R_OHMS,
  halfWaveLength,
  SLOPING_V_MIN_TIP_Z_M,
} from '../physics/constants';
import type { AtuMatchConfig } from '../physics/impedance';
import {
  MAIN_WIRE_TAG,
  LEFT_LEG_TAG,
  RIGHT_LEG_TAG,
  FEED_BRIDGE_TAG,
  FEEDLINE_SHIELD_TAG,
  SLOPING_V_LEFT_STUB_TAG,
  SLOPING_V_RIGHT_STUB_TAG,
  SLOPING_V_LEFT_COUNTERPOISE_TAG,
  SLOPING_V_RIGHT_COUNTERPOISE_TAG,
  TERMINATED_DELTA_LEFT_BASE_TAG,
  TERMINATED_DELTA_RIGHT_BASE_TAG,
  TERMINATED_DELTA_BRIDGE_TAG,
  VERTICAL_WHIP_TAG,
  INVERTED_L_VERTICAL_TAG,
  FOLDED_DIPOLE_OPPOSITE_TAG,
  FOLDED_DIPOLE_TERM_BRIDGE_TAG,
} from '../physics/tags';
import {
  buildInvertedVWires,
  buildSlopingVWires,
  buildDeltaLoopWires,
  buildTerminatedDeltaWires,
  buildVerticalWhipWires,
  buildInvertedLWires,
  buildFoldedAntennaWires,
  buildDipoleWires,
  SEGS_PER_WAVELENGTH,
} from './antennaGeometry';
import type { AntennaState } from './antennaStore';

export const FEEDLINE_SUPPORTED_TYPES = new Set<string>([
  'dipole',
  'inverted-v',
  'delta-loop',
  'sloping-v',
  'terminated-delta',
  'folded-dipole',
]);

export const SLOPING_V_DEFAULT_TERMINATION_OHMS = 300;
export const TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS = 600;

export const RECOMMENDED_TERMINATING_RESISTORS: Record<AntennaType, number> = {
  'sloping-v': SLOPING_V_DEFAULT_TERMINATION_OHMS,
  'terminated-delta': TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS,
  'folded-dipole': FOLDED_DIPOLE_FEED_R_OHMS,
  'dipole': 0,
  'inverted-v': 0,
  'delta-loop': 0,
  'vertical-whip': 0,
  'inverted-l': 0,
};

export function recommendedTerminatingResistor(antennaType: AntennaType): number {
  return RECOMMENDED_TERMINATING_RESISTORS[antennaType] ?? 0;
}

export const SWR_VIEW_MIN_SPAN_MHZ = 0.05;
export const DEFAULT_SWR_VIEW_SPAN_FRACTION = 0.2;

export function clampSwrView(centerMHz: number, spanMHz: number): { center: number; span: number } {
  const fullSpan = SWEEP_F_MAX_MHZ - SWEEP_F_MIN_MHZ;
  const span = Math.min(fullSpan, Math.max(SWR_VIEW_MIN_SPAN_MHZ, spanMHz));
  const half = span / 2;
  const center = Math.min(SWEEP_F_MAX_MHZ - half, Math.max(SWEEP_F_MIN_MHZ + half, centerMHz));
  return { center, span };
}

export function defaultSwrSpan(frequencyMHz: number): number {
  return clampSwrView(frequencyMHz, frequencyMHz * DEFAULT_SWR_VIEW_SPAN_FRACTION).span;
}

export function selectSwrWindow(
  state: Pick<AntennaState, 'swrViewCenterMHz' | 'swrViewSpanMHz'>,
): { startMHz: number; endMHz: number } {
  const { center, span } = clampSwrView(state.swrViewCenterMHz, state.swrViewSpanMHz);
  return { startMHz: center - span / 2, endMHz: center + span / 2 };
}

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

export function legMultipleFromLength(totalLengthM: number, frequencyMHz: number): number {
  const lambda = 299.792458 / frequencyMHz;
  const legLen = Math.max(0, (totalLengthM - FEED_BRIDGE_LENGTH_M) / 2);
  return Math.max(1, Math.round(legLen / lambda));
}

export function calculateDefaultLength(type: AntennaType, frequencyMHz: number): number {
  const lambda = 299.792458 / frequencyMHz;
  switch (type) {
    case 'dipole':
      return halfWaveLength(frequencyMHz);
    case 'inverted-v':
      return lambda * 0.5 * 0.97;
    case 'delta-loop':
      return lambda;
    case 'sloping-v':
      return lambda * 2;
    case 'terminated-delta':
      return lambda;
    case 'vertical-whip':
      return lambda * 0.25 * 0.95;
    case 'inverted-l':
      return lambda * 0.25 * 0.95;
    case 'folded-dipole':
      return halfWaveLength(frequencyMHz);
    default:
      return halfWaveLength(frequencyMHz);
  }
}

const FEEDLINE_SHIELD_SEGMENTS = 11;
const FEEDLINE_GROUND_GAP_M = 0.1;

export function buildWires(
  state: Pick<AntennaState, 'antennaType' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments' | 'frequency' | 'vAngle' | 'legSlope'> &
    Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength' | 'feedlineOffset' | 'whipCounterpoise' | 'foldedDipoleAperture' | 'terminatingResistor'>>,
): Wire[] {
  const wires = buildWiresInternal(state);
  const layout = computeFeedlineLayout(state);
  if (layout?.shield && state.antennaType !== 'delta-loop' && state.antennaType !== 'terminated-delta') {
    let bridge: Wire | undefined;
    for (let i = 0; i < wires.length; i++) {
      if (wires[i].tag === FEED_BRIDGE_TAG) {
        bridge = wires[i];
        break;
      }
    }
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

function computeFeedlineShield(
  state: Parameters<typeof computeFeedlineLayout>[0],
) {
  const layout = computeFeedlineLayout(state);
  return layout?.shield
    ? { ...layout.shield, segments: FEEDLINE_SHIELD_SEGMENTS }
    : null;
}

function buildWiresInternal(
  state: Pick<AntennaState, 'antennaType' | 'length' | 'height' | 'orientation' | 'wireRadius' | 'segments' | 'frequency' | 'vAngle' | 'legSlope'> &
    Partial<Pick<AntennaState, 'feedlineId' | 'feedlineLength' | 'feedlineOffset' | 'whipCounterpoise' | 'foldedDipoleAperture' | 'terminatingResistor'>>,
): Wire[] {
  const h = state.height;

  switch (state.antennaType) {
    case 'inverted-v':
      return buildInvertedVWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        vAngle: state.vAngle,
      });

    case 'sloping-v':
      return buildSlopingVWires(state);

    case 'delta-loop':
      return buildDeltaLoopWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        feedlineShield: computeFeedlineShield(state),
      });

    case 'terminated-delta':
      return buildTerminatedDeltaWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        feedlineShield: computeFeedlineShield(state),
      });

    case 'vertical-whip':
      return buildVerticalWhipWires({
        length: state.length,
        height: h,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        counterpoise: state.whipCounterpoise ?? false,
      });

    case 'inverted-l':
      return buildInvertedLWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        frequency: state.frequency,
        counterpoise: state.whipCounterpoise ?? false,
      });

    case 'folded-dipole':
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

    case 'dipole':
    default:
      return buildDipoleWires({
        length: state.length,
        height: h,
        orientation: state.orientation,
        wireRadius: state.wireRadius,
        segments: state.segments,
        layout: computeFeedlineLayout(state),
      });
  }
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
    let leftLeg: Wire | undefined;
    for (let i = 0; i < wires.length; i++) {
      if (wires[i].tag === LEFT_LEG_TAG) {
        leftLeg = wires[i];
        break;
      }
    }
    return { wireTag: LEFT_LEG_TAG, segment: leftLeg!.segments };
  } else if (state.antennaType === 'vertical-whip') {
    return { wireTag: VERTICAL_WHIP_TAG, segment: 1 };
  } else if (state.antennaType === 'inverted-l') {
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
      transmissionLines.push({
        fromTag: FEED_BRIDGE_TAG,
        fromSegment: 1,
        toTag: FEEDLINE_SHIELD_TAG,
        toSegment: FEEDLINE_SHIELD_SEGMENTS,
        z0: preset.z0,
        lengthM: electricalLength,
      });
    }

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

function findSlopingVLegTips(wires: Wire[]): {
  leftTip: Wire['start'];
  rightTip: Wire['end'];
} {
  let firstLeft: Wire | undefined;
  let lastRight: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i]!;
    if (w.tag === LEFT_LEG_TAG && !firstLeft) firstLeft = w;
    if (w.tag === RIGHT_LEG_TAG) lastRight = w;
  }
  return {
    leftTip: firstLeft!.start,
    rightTip: lastRight!.end,
  };
}

function createSlopingVStubsAndLoads(
  leftTip: Wire['start'],
  rightTip: Wire['end'],
  hubZ: number,
  radius: number,
  R: number,
) {
  const stubWires: Wire[] = [
    {
      start: leftTip,
      end: [leftTip[0], leftTip[1], hubZ],
      radius,
      segments: 1,
      tag: SLOPING_V_LEFT_STUB_TAG,
    },
    {
      start: rightTip,
      end: [rightTip[0], rightTip[1], hubZ],
      radius,
      segments: 1,
      tag: SLOPING_V_RIGHT_STUB_TAG,
    },
  ];

  const stubLoads: SegmentLoad[] = [
    { type: 4, wireTag: SLOPING_V_LEFT_STUB_TAG, segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
    { type: 4, wireTag: SLOPING_V_RIGHT_STUB_TAG, segmentStart: 1, segmentEnd: 1, param1: R, param2: 0 },
  ];

  return { stubWires, stubLoads };
}

function createSlopingVCounterpoises(
  leftTip: Wire['start'],
  rightTip: Wire['end'],
  hubZ: number,
  radius: number,
  frequency: number,
): Wire[] {
  const counterpoiseWires: Wire[] = [];

  const lambda = wavelengthMeters(frequency);
  const dx = leftTip[0] - rightTip[0];
  const dy = leftTip[1] - rightTip[1];
  const tipSeparation = Math.sqrt(dx * dx + dy * dy);
  const radialLength = Math.min(
    lambda * SLOPING_V_COUNTERPOISE_LENGTH_WL,
    Math.max(0.1, tipSeparation * 0.4),
  );
  const radialSegments = Math.max(1, Math.ceil(radialLength / (lambda / SEGS_PER_WAVELENGTH)));

  const hubs: Array<[[number, number, number], number]> = [
    [[leftTip[0], leftTip[1], hubZ], SLOPING_V_LEFT_COUNTERPOISE_TAG],
    [[rightTip[0], rightTip[1], hubZ], SLOPING_V_RIGHT_COUNTERPOISE_TAG],
  ];

  for (let h = 0; h < hubs.length; h++) {
    const hub = hubs[h]![0];
    const tag = hubs[h]![1];
    for (let i = 0; i < SLOPING_V_COUNTERPOISE_RADIALS; i++) {
      const angle = (2 * Math.PI * i) / SLOPING_V_COUNTERPOISE_RADIALS + Math.PI / SLOPING_V_COUNTERPOISE_RADIALS;
      counterpoiseWires.push({
        start: hub,
        end: [
          hub[0] + radialLength * Math.cos(angle),
          hub[1] + radialLength * Math.sin(angle),
          hubZ,
        ],
        radius,
        segments: radialSegments,
        tag,
      });
    }
  }

  return counterpoiseWires;
}

function buildSlopingVTermination(R: number, radius: number, frequency: number, wires: Wire[]) {
  const { leftTip, rightTip } = findSlopingVLegTips(wires);
  const hubZ = slopingVTerminationHubZ(frequency, Math.min(leftTip[2], rightTip[2]));

  const { stubWires, stubLoads } = createSlopingVStubsAndLoads(leftTip, rightTip, hubZ, radius, R);
  const counterpoiseWires = createSlopingVCounterpoises(leftTip, rightTip, hubZ, radius, frequency);

  return {
    extraWires: [...stubWires, ...counterpoiseWires],
    loads: stubLoads,
  };
}

function buildTerminatedDeltaTermination(R: number, radius: number, wires: Wire[]) {
  const extraWires: Wire[] = [];
  const loads: SegmentLoad[] = [];

  let leftHalfBase: Wire | undefined;
  let rightHalfBase: Wire | undefined;
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (w.tag === TERMINATED_DELTA_LEFT_BASE_TAG) leftHalfBase = w;
    else if (w.tag === TERMINATED_DELTA_RIGHT_BASE_TAG && !rightHalfBase) rightHalfBase = w;
  }
  const leftInner = leftHalfBase!.end;
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
  const topCenterLeft = leftHalfOpp!.end;
  const topCenterRight = rightHalfOpp!.start;

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
        const { extraWires: ew, loads: l } = buildSlopingVTermination(state.terminatingResistor, state.wireRadius, state.frequency, wires);
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

export function selectAtuConfig(args: {
  atuEnabled: boolean;
  frequency: number;
  feedlineId: string;
  feedlineLength: number;
  atuMainFeedlineLength: number;
}): AtuMatchConfig | undefined {
  if (!args.atuEnabled) return undefined;
  const preset = findFeedlinePreset(args.feedlineId);
  return {
    z0: preset.z0,
    upmastMatchedLossDb: feedlineLossDb(preset, args.frequency, args.feedlineLength),
    mainMatchedLossDb: feedlineLossDb(preset, args.frequency, args.atuMainFeedlineLength),
    componentQ: ATU_COMPONENT_Q,
  };
}

export function selectSimulationInput(state: AntennaState): SimulationInput {
  const wires = buildWires(state);

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
