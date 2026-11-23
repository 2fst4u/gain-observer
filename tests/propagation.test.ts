import { describe, expect, it } from 'vitest';
import { HALF_POWER_DB, halfPowerElevationSpan, hopRangeKm, predictPropagation, refinePeakElevation, solarDeclinationDeg, solarZenithDeg } from '../src/physics/propagation';
import type { GainPattern } from '../src/physics/types';

const base = {
  takeoffElevationDeg: 15,
  shellHeightKm: 300,
  month: 6,
  utcHour: 12,
  latitudeDeg: 30,
  longitudeDeg: 0,
};

function pattern(): GainPattern {
  const result = { data: new Float32Array(37 * 72).fill(-30), thetaSteps: 37, phiSteps: 72, dTheta: 5, dPhi: 5 };
  result.data[12 * 72] = 8; // East: peak elevation 30°.
  result.data[6 * 72 + 18] = 10; // North: peak elevation 60°.
  return result;
}

describe('solar geometry', () => {
  it('uses mid-month northern and southern solstice declinations', () => {
    expect(solarDeclinationDeg(6)).toBeCloseTo(23.3, 0);
    expect(solarDeclinationDeg(12)).toBeCloseTo(-23.3, 0);
  });

  it('has exact zenith at the subsolar latitude and local mean noon', () => {
    const latitude = solarDeclinationDeg(6);
    expect(solarZenithDeg(latitude, 150, 6, 2)).toBeCloseTo(0, 6);
    expect(solarZenithDeg(-latitude, 150, 6, 14)).toBeCloseTo(180, 6);
  });

  it('is invariant when longitude and UTC hour describe the same solar time', () => {
    expect(solarZenithDeg(45, 90, 3, 6)).toBeCloseTo(solarZenithDeg(45, 0, 3, 12), 10);
    expect(solarZenithDeg(45, -90, 3, 18)).toBeCloseTo(solarZenithDeg(45, 0, 3, 12), 10);
  });

  it('does not silently use Greenwich for a manually specified longitude', () => {
    const greenwich = predictPropagation({ ...base, latitudeDeg: 0 });
    const east = predictPropagation({ ...base, latitudeDeg: 0, longitudeDeg: 150 });
    expect(greenwich.solarZenithDeg).toBeLessThan(25);
    expect(east.solarZenithDeg).toBeGreaterThan(140);
  });
});

describe('ideal shell geometry', () => {
  it('returns exact zero ground arc for vertical incidence', () => {
    expect(hopRangeKm(90, 300)).toBe(0);
    expect(predictPropagation({ ...base, takeoffElevationDeg: 90 }).hops.every((hop) => hop.rangeKm === 0)).toBe(true);
  });

  it('matches the independently derived horizon-to-horizon spherical arc', () => {
    const radius = 6371;
    expect(hopRangeKm(0, 300)).toBeCloseTo(2 * radius * Math.acos(radius / (radius + 300)), 9);
  });

  it('matches straight-line intersection and spherical central angle', () => {
    const radius = 6371;
    for (const elevation of [1, 10, 30, 60, 89]) {
      const angle = elevation * Math.PI / 180;
      const slant = -radius * Math.sin(angle) + Math.sqrt((radius + 300) ** 2 - radius ** 2 * Math.cos(angle) ** 2);
      const x = slant * Math.cos(angle);
      const z = radius + slant * Math.sin(angle);
      const expected = 2 * radius * Math.atan2(x, z);
      expect(hopRangeKm(elevation, 300)).toBeCloseTo(expected, 8);
    }
  });

  it('multiplies ideal ground arcs without claiming availability or signal quality', () => {
    const prediction = predictPropagation(base);
    expect(prediction.hops.map((hop) => hop.rangeKm)).toEqual([1, 2, 3].map((n) => n * hopRangeKm(15, 300)));
    expect(prediction).not.toHaveProperty('lufMHz');
    expect(prediction).not.toHaveProperty('foF2MHz');
    expect(prediction.hops[0]).not.toHaveProperty('linkQuality');
    expect(prediction.hops[0]).not.toHaveProperty('status');
  });
});

describe('antenna lobes and feed-system gain', () => {
  it('uses each bearing’s strongest upper-hemisphere lobe and correct compass bearing', () => {
    const prediction = predictPropagation({ ...base, pattern: pattern() });
    const east = prediction.azimuthalHops!.find((hop) => hop.phiDeg === 0)!;
    const north = prediction.azimuthalHops!.find((hop) => hop.phiDeg === 90)!;
    expect(east.bearingDeg).toBe(90);
    expect(east.takeoffElevationDeg).toBe(30);
    expect(north.bearingDeg).toBe(0);
    expect(north.takeoffElevationDeg).toBe(60);
    expect(prediction.selectedTakeoffElevationDeg).toBe(60);
  });

  it('applies the realized gain offset to every ray without changing selected lobes or arcs', () => {
    const antenna = pattern();
    const original = predictPropagation({ ...base, pattern: antenna, realizedGainOffsetDb: -0.2 });
    const lossy = predictPropagation({ ...base, pattern: antenna, realizedGainOffsetDb: -40 });
    expect(original.hops[0]!.realizedGainDbi).toBeCloseTo(9.8, 10);
    expect(lossy.hops[0]!.realizedGainDbi).toBe(-30);
    expect(lossy.selectedTakeoffElevationDeg).toBe(original.selectedTakeoffElevationDeg);
    for (let i = 0; i < original.azimuthalHops!.length; i++) {
      expect(lossy.azimuthalHops![i]!.rangeKm).toEqual(original.azimuthalHops![i]!.rangeKm);
      expect(lossy.azimuthalHops![i]!.realizedGainDbi! - original.azimuthalHops![i]!.realizedGainDbi!).toBeCloseTo(-39.8, 10);
    }
  });

  it('keeps unavailable and zero-delivered-power gains distinct', () => {
    const unavailable = predictPropagation({ ...base, pattern: pattern() });
    expect(unavailable.hops[0]!.realizedGainDbi).toBeUndefined();
    const zero = predictPropagation({ ...base, pattern: pattern(), realizedGainOffsetDb: -Infinity });
    expect(zero.hops[0]!.realizedGainDbi).toBe(-Infinity);
    expect(zero.hops[0]!.rangeKm).toBe(unavailable.hops[0]!.rangeKm);
  });

  it('does not choose missing or nonfinite pattern entries as strong lobes', () => {
    const antenna = pattern();
    antenna.data[0] = NaN;
    antenna.data[1] = -Infinity;
    expect(predictPropagation({ ...base, pattern: antenna }).selectedTakeoffElevationDeg).toBe(60);
  });
});

describe('sub-grid lobe elevation', () => {
  // One bearing, 2° rows, a smooth lobe peaking between rows (parabolic in dB).
  function lobe(peakElevationDeg: number): GainPattern {
    const thetaSteps = 91;
    const data = new Float32Array(thetaSteps).fill(-999);
    for (let ti = 0; ti <= 45; ti++) {
      const elevation = 90 - 2 * ti;
      if (elevation > 0) data[ti] = 7 - 0.01 * (elevation - peakElevationDeg) ** 2;
    }
    return { data, thetaSteps, phiSteps: 1, dTheta: 2, dPhi: 360 };
  }

  it('recovers a lobe peak lying between pattern rows', () => {
    const prediction = predictPropagation({ ...base, pattern: lobe(27.3) });
    expect(prediction.selectedTakeoffElevationDeg).toBeCloseTo(27.3, 1);
    expect(prediction.hops[0]!.rangeKm).toBeCloseTo(hopRangeKm(27.3, 300), -1);
    // The reported gain remains the solved sample, not an extrapolated peak.
    expect(prediction.hops[0]!.antennaGainDbi).toBeCloseTo(7 - 0.01 * 0.7 ** 2, 5);
  });

  it('keeps the sampled elevation at the zenith and beside a null', () => {
    expect(refinePeakElevation(lobe(27.3), 0, 90)).toBe(90);
    const nearHorizon = lobe(2);
    // Row at 0° elevation is the below-ground sentinel: no parabola through it.
    expect(refinePeakElevation(nearHorizon, 0, 2)).toBe(2);
  });
});

describe('half-power beam', () => {
  // Inverted-V-like NVIS beam on 5° rows: peak at the zenith on every bearing,
  // falling slowly along the wire (phi 0) and faster across it (phi 90),
  // with a lobe at 65° on phi 90 a fraction of a dB above the zenith.
  function nvis(): GainPattern {
    const thetaSteps = 37, phiSteps = 72;
    const data = new Float32Array(thetaSteps * phiSteps).fill(-100);
    for (let ti = 0; ti < 18; ti++) {
      const elevation = 90 - 5 * ti;
      for (let pi = 0; pi < phiSteps; pi++) {
        const across = Math.abs(Math.sin(pi * 5 * Math.PI / 180));
        data[ti * phiSteps + pi] = 5 - (90 - elevation) * (0.18 - 0.08 * across);
      }
    }
    data[5 * phiSteps + 18] = 5.1;
    return { data, thetaSteps, phiSteps, dTheta: 5, dPhi: 5 };
  }

  it('reaches every bearing for a high-angle beam even when one ray narrowly wins', () => {
    const prediction = predictPropagation({ ...base, pattern: nvis() });
    const zeroPeakRay = prediction.azimuthalHops!.filter((hop) => hop.rangeKm[0] === 0);
    expect(zeroPeakRay.length).toBeGreaterThan(60);
    for (const hop of prediction.azimuthalHops!) {
      expect(hop.halfPowerElevationDeg!.highDeg).toBe(90);
      expect(hop.halfPowerRangeKm!.nearKm).toBe(0);
      expect(hop.halfPowerRangeKm!.farKm).toBeGreaterThan(150);
    }
  });

  it('interpolates the edge between rows against the pattern peak', () => {
    const prediction = predictPropagation({ ...base, pattern: nvis() });
    const alongWire = prediction.azimuthalHops!.find((hop) => hop.phiDeg === 0)!;
    // 5 − 0.18·(90 − e) = 5.1 − 3 → e = 90 − 2.9 / 0.18
    const expected = 90 - (5 - (5.1 - HALF_POWER_DB)) / 0.18;
    // Float32 pattern samples limit agreement to a few micro-degrees.
    expect(alongWire.halfPowerElevationDeg!.lowDeg).toBeCloseTo(expected, 4);
    expect(alongWire.halfPowerRangeKm!.farKm).toBeCloseTo(hopRangeKm(expected, 300), 2);
  });

  it('omits bearings with no ray within half power and spans separate lobes', () => {
    const antenna = pattern();
    const span = halfPowerElevationSpan(antenna, 18, 10 - HALF_POWER_DB);
    expect(span?.highDeg).toBeGreaterThan(55);
    expect(span?.lowDeg).toBeLessThan(65);
    const prediction = predictPropagation({ ...base, pattern: antenna });
    // East's 8 dBi lobe is within 3 dB of the 10 dBi peak; North-east has none.
    const east = prediction.azimuthalHops!.find((hop) => hop.phiDeg === 0)!.halfPowerElevationDeg!;
    expect(east.lowDeg).toBeCloseTo(30 - 5 / 38, 8);
    expect(east.highDeg).toBeCloseTo(30 + 5 / 38, 8);
    expect(prediction.azimuthalHops!.find((hop) => hop.phiDeg === 45)!.halfPowerRangeKm).toBeUndefined();

    const twoLobes = { data: new Float32Array([0, 10, 0, 0, 10, 0, -100]), thetaSteps: 7, phiSteps: 1, dTheta: 15, dPhi: 360 };
    const lobes = halfPowerElevationSpan(twoLobes, 0, 7)!;
    expect(lobes.highDeg).toBeCloseTo(75 + 15 * 0.3, 8);
    expect(lobes.lowDeg).toBeCloseTo(30 - 15 * 0.3, 8);
  });
});
