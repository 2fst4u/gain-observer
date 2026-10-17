export {
  SEGS_PER_WAVELENGTH,
  MIN_SEGS_PER_LEG,
  MAX_SEGS_PER_LEG,
  safeSegs,
  type GradedSegmentPlan,
  gradedSegmentPlan,
  type OrientationPreset,
  type Orientation,
  orientationVector,
  resolveGradedSegmentBreakpoints,
  type BuildGradedLegWiresOptions,
  buildGradedLegWires,
  type GradedStraightWireParams,
  buildGradedStraightWires,
} from './geometry/common';

export {
  type InvertedVWiresParams,
  calcInvertedVPoints,
  buildInvertedVWires,
  type SlopingVWiresParams,
  slopingVFeedSetback,
  slopingVBridgeLength,
  slopingVLegLength,
  createSlopingVLegPointCalculator,
  buildSlopingVWires,
} from './geometry/vAntennas';

export {
  type VerticalWhipWiresParams,
  buildVerticalWhipWires,
  type InvertedLWiresParams,
  buildInvertedLWires,
} from './geometry/verticals';

export {
  type DipoleWiresParams,
  oddRound,
  buildDipoleWires,
} from './geometry/dipole';

export {
  type FeedlineShield,
  type DeltaLoopWiresParams,
  calcSegs,
  calcApexSplit,
  type FeedlineShieldWireOptions,
  appendFeedlineShieldWires,
  calcDeltaLoopGeometry,
  buildDeltaLoopWires,
  type TerminatedDeltaWiresParams,
  calcTerminatedDeltaPoints,
  type TerminatedDeltaLegWiresOptions,
  buildTerminatedDeltaLegWires,
  buildTerminatedDeltaWires,
  calcFoldedAntennaPoints,
  calcFoldedTargetSegLen,
  calcFoldedLegSegs,
  calcFoldedAntennaSegments,
  type FoldedAntennaWiresParams,
  buildFoldedAntennaWires,
} from './geometry/loops';
