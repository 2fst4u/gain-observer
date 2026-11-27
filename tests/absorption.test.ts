import { describe, expect, it } from 'vitest';
import { D_REGION_HEIGHT_KM, hopAbsorptionDb, incidenceAtHeightDeg, winterAnomalyFactor } from '../src/physics/absorption';
import { decimalYear, dipoleLatitudeDeg, geomagneticField, gyrofrequencyMHz } from '../src/physics/ionosphere/igrf';

const base = { sunspotNumber: 100, solarZenithDeg: 0, elevationDeg: 90, frequencyMHz: 7, longitudinalGyroMHz: 1 };

describe('Davies (1965) eq. 5.19: La = 430 (1 + 0.0035R) cos^0.75 χ sec φD (f + fL)^-2', () => {
  it('evaluates the published formula', () => {
    // Overhead sun, vertical ray: 430 × 1.35 / 64.
    expect(hopAbsorptionDb(base)).toBeCloseTo(430 * 1.35 / 64, 10);
    // χ = 60°, R = 0, f + fL = 4 MHz, 30° elevation.
    const phi = incidenceAtHeightDeg(30, D_REGION_HEIGHT_KM) * Math.PI / 180;
    expect(hopAbsorptionDb({ ...base, sunspotNumber: 0, solarZenithDeg: 60, elevationDeg: 30, frequencyMHz: 3, longitudinalGyroMHz: 1 }))
      .toBeCloseTo(430 * 0.5 ** 0.75 / Math.cos(phi) / 16, 10);
  });

  it('falls with frequency as (f + fL)^-2 and rises with obliquity and sunspots', () => {
    const at = (overrides: Partial<typeof base>) => hopAbsorptionDb({ ...base, ...overrides });
    expect(at({ frequencyMHz: 15 }) / at({ frequencyMHz: 7 })).toBeCloseTo(64 / 256, 10);
    expect(at({ elevationDeg: 10 })).toBeGreaterThan(at({ elevationDeg: 60 }));
    expect(at({ sunspotNumber: 200 })).toBeGreaterThan(at({ sunspotNumber: 0 }));
  });

  it('is zero with the sun at or below the horizon', () => {
    expect(hopAbsorptionDb({ ...base, solarZenithDeg: 90 })).toBe(0);
    expect(hopAbsorptionDb({ ...base, solarZenithDeg: 120 })).toBe(0);
  });

  it('applies the table 5.1 winter-anomaly factors in dipole latitudes 40°–70°', () => {
    expect([11, 12, 1, 2, 3, 6].map((m) => winterAnomalyFactor(m, 55))).toEqual([1.2, 1.5, 1.5, 1.2, 1, 1]);
    expect([5, 6, 7, 8, 12].map((m) => winterAnomalyFactor(m, -55))).toEqual([1.2, 1.5, 1.5, 1.2, 1]);
    expect(winterAnomalyFactor(1, 30)).toBe(1);
    expect(winterAnomalyFactor(1, 75)).toBe(1);
    expect(hopAbsorptionDb({ ...base, winterFactor: 1.5 })).toBeCloseTo(1.5 * hopAbsorptionDb(base), 10);
  });

  it('uses the curved-Earth angle of incidence at the D region', () => {
    expect(incidenceAtHeightDeg(90, 90)).toBeCloseTo(0, 10);
    const sin = 6371 * Math.cos(10 * Math.PI / 180) / (6371 + 90);
    expect(incidenceAtHeightDeg(10, 90)).toBeCloseTo(Math.asin(sin) * 180 / Math.PI, 10);
  });
});

describe('geomagnetic helpers', () => {
  const year = decimalYear(2026, 6, 15);

  it('places the dipole pole near 80.7°N, 72.7°W (IGRF epoch 2020–2025)', () => {
    expect(dipoleLatitudeDeg(year, 80.7, -72.7)).toBeGreaterThan(89.5);
    expect(dipoleLatitudeDeg(year, -80.7, 107.3)).toBeLessThan(-89.5);
  });

  it('gives a mid-latitude gyrofrequency near 1.4 MHz at 100 km', () => {
    const field = geomagneticField(year, -0.1, 51.5, 100); // London
    expect(field.totalNt).toBeGreaterThan(45_000);
    expect(field.totalNt).toBeLessThan(52_000);
    expect(gyrofrequencyMHz(field.totalNt)).toBeCloseTo(2.8e-5 * field.totalNt, 12);
    expect(field.inclinationDeg).toBeGreaterThan(60);
  });
});
