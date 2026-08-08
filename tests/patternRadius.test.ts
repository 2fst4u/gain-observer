// The 3D bubble is a gain surface: its radius in a direction is the linear
// power gain there. Getting the dB→linear conversion wrong (the /20 field
// exponent instead of /10) halves every lobe ratio the surface is supposed to
// show, so the law is pinned here rather than left to the render path.

import { describe, expect, it } from 'vitest';
import { DB_TO_LINEAR_POWER, radiusScaleForPattern } from '../src/components/Scene/patternRadius';

const radiusAt = (gainDb: number, peakDb: number, dbRange: number, scale = 1) => {
  const { floorDb, factor } = radiusScaleForPattern(peakDb, dbRange, scale);
  return Math.exp(Math.max(gainDb, floorDb) * DB_TO_LINEAR_POWER) * factor;
};

describe('pattern radius law', () => {
  it('converts dB to linear power, not field amplitude', () => {
    // 10 dB down is a factor of 10 in power. The field-amplitude law would
    // give √10 ≈ 3.16.
    const peak = radiusAt(0, 0, 40);
    const tenDown = radiusAt(-10, 0, 40);
    expect(peak / tenDown).toBeCloseTo(10, 6);

    // 3 dB is a factor of 2.
    expect(radiusAt(0, 0, 40) / radiusAt(-3.0103, 0, 40)).toBeCloseTo(2, 4);
  });

  it('scales the whole surface with absolute gain, so two antennas compare', () => {
    // A 6 dBi antenna is four times the radius of a 0 dBi one at the same
    // pattern scale — comparison mode reads absolute gain off bubble size.
    expect(radiusAt(6, 6, 40) / radiusAt(0, 0, 40)).toBeCloseTo(10 ** 0.6, 6);
  });

  it('is linear in the user pattern scale', () => {
    expect(radiusAt(6, 6, 40, 2)).toBeCloseTo(2 * radiusAt(6, 6, 40, 1), 6);
  });

  it('floors nulls relative to the peak, keeping shape at any gain level', () => {
    // A hopeless antenna: peak −40 dBi, 20 dB of structure in the pattern.
    // The peak-relative floor keeps that structure visible; the old fixed
    // −25 dBi floor clamped every one of these directions to the same radius.
    const weakPeak = radiusAt(-40, -40, 30);
    const weakDown10 = radiusAt(-50, -40, 30);
    expect(weakPeak / weakDown10).toBeCloseTo(10, 6);

    // Below the dynamic range everything clamps together, as the colours do.
    expect(radiusAt(-999, -40, 30)).toBeCloseTo(radiusAt(-70, -40, 30), 12);
  });

  it('keeps a very weak pattern visible without distorting it', () => {
    const { factor } = radiusScaleForPattern(-40, 30, 1);
    const peak = Math.exp(-40 * DB_TO_LINEAR_POWER) * factor;
    // Boosted to a visible size…
    expect(peak).toBeGreaterThan(0.3);
    // …by a uniform factor, so lobe ratios are untouched.
    expect(radiusAt(-40, -40, 30) / radiusAt(-46, -40, 30)).toBeCloseTo(10 ** 0.6, 6);
  });

  it('leaves normal patterns at their true scale', () => {
    // 6 dBi at 1×: ~5 m peak radius, well above the minimum-size guard.
    expect(radiusAt(6, 6, 40)).toBeCloseTo(10 ** 0.6 * 1.25, 6);
  });
});
