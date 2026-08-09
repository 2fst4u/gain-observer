// Angle conventions shared by the physics layer and every display surface.
//
// Two different azimuth conventions are in play and they are NOT the same
// number, so every boundary between them has to convert explicitly:
//
//   NEC azimuth φ — the angle the NEC-2 RP card sweeps. Measured in the
//     horizontal plane from the +X axis toward the +Y axis (mathematical /
//     counter-clockwise seen from above). This is what `GainPattern` is
//     indexed by and what `SimulationResult.takeoffAzimuthDeg` reports.
//
//   Compass bearing — what the user reads. 0° = North, increasing clockwise
//     (90° = East). Per docs/antenna-spec.md §1.3 the geometry builder puts
//     North on +Y and East on +X, so φ = 0 is due East and φ = 90 is due
//     North.
//
// Substituting those two anchors into a linear map gives
//
//     bearing = 90° − φ   (mod 360)
//
// which is its own inverse — the same expression converts back — because the
// two conventions differ by both a 90° rotation and a handedness flip.
//
// Getting this wrong is not a cosmetic label problem: it rotates the whole
// azimuth pattern by 90° and mirrors it, which (for example) makes a
// north–south dipole look as though it radiates north and south instead of
// broadside to east and west.

/** Wrap an angle in degrees into [0, 360). */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * NEC azimuth φ (0° = +X = East, increasing toward +Y = North) → compass
 * bearing (0° = North, increasing clockwise toward East).
 */
export function phiToBearingDeg(phiDeg: number): number {
  return normalizeDeg(90 - phiDeg);
}

/**
 * Compass bearing (0° = North, clockwise) → NEC azimuth φ (0° = +X = East,
 * counter-clockwise). Identical expression to `phiToBearingDeg`: the mapping
 * is an involution.
 */
export function bearingToPhiDeg(bearingDeg: number): number {
  return normalizeDeg(90 - bearingDeg);
}
