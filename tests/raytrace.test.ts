import { describe, expect, it } from 'vitest';
import { maxReturningFrequencyMHz, sampleProfile, traceFan, traceRay } from '../src/physics/ionosphere/raytrace';
import { hopRangeKm } from '../src/physics/propagation';

const R = 6371;

// A thin, dense slab at 300 km: below it free space, at it a step to fc.
function slab(fcMHz: number, heightKm = 300) {
  return sampleProfile((h) => (h >= heightKm ? fcMHz : 0), 50, 1000, 0.05);
}

describe('ray tracing through a spherically stratified ionosphere', () => {
  it('reduces to specular reflection from a shell for a thin dense layer', () => {
    const profile = slab(50);
    for (const elevation of [0, 5, 15, 30, 60, 85]) {
      const ray = traceRay(profile, 7, elevation);
      expect(ray.returns).toBe(true);
      expect(ray.apexKm!).toBeCloseTo(300, 0);
      // Within the 0.05 km sampling of the step.
      expect(ray.rangeKm!).toBeCloseTo(hopRangeKm(elevation, ray.apexKm!), 0);
    }
  });

  it('returns at vertical incidence with zero range', () => {
    const ray = traceRay(slab(5), 4, 90);
    expect(ray.returns).toBe(true);
    expect(ray.rangeKm).toBe(0);
  });

  it('obeys the secant law on a curved Earth for a thin layer', () => {
    // A ray returns from a thin layer iff f < fc / sin(i'), where i' is the
    // elevation at the layer: cos i' = R cos β / (R + h).
    const profile = slab(5);
    for (const elevation of [10, 30, 60]) {
      const atLayer = Math.acos(R * Math.cos(elevation * Math.PI / 180) / (R + 300));
      const limit = 5 / Math.sin(atLayer);
      expect(traceRay(profile, limit * 0.99, elevation).returns).toBe(true);
      expect(traceRay(profile, limit * 1.01, elevation).returns).toBe(false);
      expect(maxReturningFrequencyMHz(profile, elevation)).toBeCloseTo(limit, 1);
    }
  });

  it('turns a vertical ray where the plasma frequency equals the wave frequency', () => {
    // Parabolic layer: fN² = fc² (1 − ((h − hm)/ym)²).
    const fc = 6, hm = 300, ym = 100;
    const profile = sampleProfile((h) => Math.sqrt(Math.max(0, fc * fc * (1 - ((h - hm) / ym) ** 2))));
    for (const f of [2, 4, 5.9]) {
      const expected = hm - ym * Math.sqrt(1 - (f / fc) ** 2);
      expect(traceRay(profile, f, 90).apexKm!).toBeCloseTo(expected, 0);
    }
    expect(traceRay(profile, 6.1, 90).returns).toBe(false);
  });

  it('opens a skip zone above the critical frequency', () => {
    const fc = 6, hm = 300, ym = 100;
    const profile = sampleProfile((h) => Math.sqrt(Math.max(0, fc * fc * (1 - ((h - hm) / ym) ** 2))));
    const below = traceFan(profile, 5, 1);
    expect(below.every((ray) => ray.returns)).toBe(true);
    const above = traceFan(profile, 10, 1);
    const returning = above.filter((ray) => ray.returns);
    expect(above[90]!.returns).toBe(false);
    expect(returning.length).toBeGreaterThan(0);
    // The nearest landing point (skip distance) is well away from the antenna.
    expect(Math.min(...returning.map((ray) => ray.rangeKm!))).toBeGreaterThan(400);
  });

  it('escapes when there is no ionosphere', () => {
    expect(traceRay(sampleProfile(() => 0), 7, 45).returns).toBe(false);
  });
});
