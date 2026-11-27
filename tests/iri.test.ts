import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  bracketingMonths,
  electronDensity,
  f107ToIg12,
  ionosphereParameters,
  loadMonthCoefficients,
  type MonthCoefficients,
} from '../src/physics/ionosphere/iri';
import { inclinationDeg, modipDeg } from '../src/physics/ionosphere/igrf';

interface ReferenceCase {
  year: number; month: number; day: number; ut: number; lat: number; lon: number; f107: number;
  foF2: number; hmF2: number; bF2Bot: number; bF2Top: number; m3000: number;
  foF1: number | null; hmF1: number | null; bF1Bot: number | null; foE: number; modip: number;
  edp: number[];
}

const reference = JSON.parse(readFileSync('tests/fixtures/pyiri-reference.json', 'utf8')) as {
  alts: number[]; cases: ReferenceCase[];
};

const months: Record<number, MonthCoefficients> = {};
for (let m = 1; m <= 12; m++) months[m] = await loadMonthCoefficients(m);

function expectClose(actual: number, expected: number | null, label: string) {
  if (expected === null) {
    expect(Number.isNaN(actual), label).toBe(true);
    return;
  }
  expect(Math.abs(actual - expected) / Math.max(1e-12, Math.abs(expected)), label).toBeLessThan(1e-9);
}

describe('IRI monthly-median port', () => {
  it('reproduces PyIRI layer parameters and electron density', () => {
    expect(reference.cases.length).toBeGreaterThan(30);
    for (const c of reference.cases) {
      const hour = Math.trunc(c.ut);
      const date = new Date(Date.UTC(c.year, c.month - 1, c.day, hour, Math.round((c.ut - hour) * 60)));
      const p = ionosphereParameters((m) => months[m]!, { date, latitudeDeg: c.lat, longitudeDeg: c.lon, f107: c.f107 });
      const at = `${c.year}-${c.month}-${c.day} ${c.ut}h ${c.lat},${c.lon} F10.7 ${c.f107}`;
      expectClose(p.foF2, c.foF2, `foF2 ${at}`);
      expectClose(p.hmF2, c.hmF2, `hmF2 ${at}`);
      expectClose(p.bF2Bot, c.bF2Bot, `B_bot ${at}`);
      expectClose(p.bF2Top, c.bF2Top, `B_top ${at}`);
      expectClose(p.m3000, c.m3000, `M3000 ${at}`);
      expectClose(p.foF1, c.foF1, `foF1 ${at}`);
      expectClose(p.hmF1, c.hmF1, `hmF1 ${at}`);
      expectClose(p.foE, c.foE, `foE ${at}`);
      expectClose(p.modipDeg, c.modip, `modip ${at}`);
      reference.alts.forEach((h, i) => expectClose(electronDensity(p, h), c.edp[i]!, `Ne(${h} km) ${at}`));
    }
  });

  it('includes cases with and without an F1 layer', () => {
    expect(reference.cases.some((c) => c.foF1 === null)).toBe(true);
    expect(reference.cases.some((c) => c.foF1 !== null)).toBe(true);
  });

  it('centres monthly medians on the 15th', () => {
    expect(bracketingMonths(2026, 6, 15)).toMatchObject({ before: { month: 6 }, after: { month: 7 }, weightBefore: 1, weightAfter: 0 });
    const early = bracketingMonths(2026, 1, 5);
    expect(early.before).toEqual({ year: 2025, month: 12 });
    expect(early.after).toEqual({ year: 2026, month: 1 });
    expect(early.weightBefore + early.weightAfter).toBeCloseTo(1, 12);
  });

  it('maps solar flux onto the ionosonde index the maps are tabulated at', () => {
    expect(f107ToIg12(63.75)).toBeCloseTo(-11.5634, 4); // R12 = 0
    expect(f107ToIg12(150)).toBeGreaterThan(80);
  });

  it('has the expected geomagnetic dip: steep near the poles, level near the dip equator', () => {
    const decimal = 2026.5;
    expect(inclinationDeg(decimal, -75, 40)).toBeGreaterThan(60); // eastern USA, dips down
    expect(inclinationDeg(decimal, 151.2, -33.9)).toBeLessThan(-55); // Sydney, dips up
    expect(Math.abs(inclinationDeg(decimal, 77, 9))).toBeLessThan(10); // southern India, dip equator
    expect(modipDeg(90, 0)).toBeCloseTo(57.52, 1);
  });
});
