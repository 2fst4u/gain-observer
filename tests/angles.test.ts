import { describe, expect, it } from 'vitest';
import { bearingToPhiDeg, normalizeDeg, phiToBearingDeg } from '../src/physics/angles';
import { orientationVector } from '../src/store/antennaGeometry';

describe('azimuth conventions', () => {
  it('wraps angles into [0, 360)', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(450)).toBe(90);
  });

  it('maps the cardinal directions between NEC φ and compass bearing', () => {
    // φ is measured from +X toward +Y; the geometry puts East on +X and
    // North on +Y (docs/antenna-spec.md §1.3).
    expect(phiToBearingDeg(0)).toBe(90); // +X → East
    expect(phiToBearingDeg(90)).toBe(0); // +Y → North
    expect(phiToBearingDeg(180)).toBe(270); // −X → West
    expect(phiToBearingDeg(270)).toBe(180); // −Y → South
  });

  it('round-trips: the mapping is its own inverse', () => {
    for (let a = 0; a < 360; a += 7) {
      expect(bearingToPhiDeg(phiToBearingDeg(a))).toBeCloseTo(a, 10);
      expect(phiToBearingDeg(bearingToPhiDeg(a))).toBeCloseTo(a, 10);
    }
  });

  it('agrees with the geometry builder for every preset orientation', () => {
    // orientationVector takes a compass heading and returns the wire axis in
    // NEC (x, y). Converting that axis back to a bearing must return the
    // heading it was built from — this is the invariant the display layers
    // rely on when they turn a heading into a pattern column.
    for (const heading of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const [x, y] = orientationVector(heading);
      const phi = normalizeDeg((Math.atan2(y, x) * 180) / Math.PI);
      expect(phiToBearingDeg(phi)).toBeCloseTo(heading, 6);
    }
  });
});
