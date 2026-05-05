import { describe, expect, it } from 'vitest';
import {
  estimateFoF2MHz,
  estimateHmF2Km,
  estimateLUFMHz,
  estimateMUFMHz,
  hopRangeKm,
  predictPropagation,
  solarDeclinationDeg,
  solarZenithDeg,
} from '../src/physics/propagation';

describe('solarDeclinationDeg', () => {
  it('is near +23° in late June', () => {
    expect(solarDeclinationDeg(6)).toBeGreaterThan(20);
    expect(solarDeclinationDeg(6)).toBeLessThan(24);
  });
  it('is near -23° in late December', () => {
    expect(solarDeclinationDeg(12)).toBeLessThan(-20);
    expect(solarDeclinationDeg(12)).toBeGreaterThan(-24);
  });
  it('is near 0 at the equinoxes (March, September)', () => {
    expect(Math.abs(solarDeclinationDeg(3))).toBeLessThan(5);
    expect(Math.abs(solarDeclinationDeg(9))).toBeLessThan(5);
  });
});

describe('solarZenithDeg', () => {
  it('sun is overhead at the equator at local noon, equinox', () => {
    // March 21 UTC noon, lon=0, lat=0 → sun nearly overhead.
    const chi = solarZenithDeg(0, 0, 3, 12);
    expect(chi).toBeLessThan(5);
  });
  it('sun is below horizon at the equator at local midnight', () => {
    const chi = solarZenithDeg(0, 0, 6, 0);
    expect(chi).toBeGreaterThan(90);
  });
  it('higher latitude in winter is dim at noon', () => {
    // 60°N, December noon → sun very low.
    const chi = solarZenithDeg(60, 0, 12, 12);
    expect(chi).toBeGreaterThan(75);
  });
});

describe('estimateFoF2MHz', () => {
  it('is monotonic in T-index at fixed time/lat', () => {
    const args = [6, 12, 30, 0] as const;
    const a = estimateFoF2MHz(-50, ...args);
    const b = estimateFoF2MHz(0, ...args);
    const c = estimateFoF2MHz(100, ...args);
    const d = estimateFoF2MHz(200, ...args);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(d);
  });
  it('is higher at noon than at midnight', () => {
    const noon = estimateFoF2MHz(50, 6, 12, 30, 0);
    const midnight = estimateFoF2MHz(50, 6, 0, 30, 0);
    expect(noon).toBeGreaterThan(midnight);
  });
  it('returns a sensible HF value (3..30 MHz) for typical inputs', () => {
    const v = estimateFoF2MHz(50, 6, 12, 30, 0);
    expect(v).toBeGreaterThan(3);
    expect(v).toBeLessThan(30);
  });
  it('never falls below the 1.5 MHz floor', () => {
    const v = estimateFoF2MHz(-100, 12, 0, 89, 0);
    expect(v).toBeGreaterThanOrEqual(1.5);
  });
  it('is reduced at very high latitudes', () => {
    const equator = estimateFoF2MHz(50, 6, 12, 0, 0);
    const polar = estimateFoF2MHz(50, 6, 12, 80, 0);
    expect(polar).toBeLessThan(equator);
  });
});

describe('estimateHmF2Km', () => {
  it('returns daytime height lower than night-time height', () => {
    const day = estimateHmF2Km(50, 6, 12, 30, 0);
    const night = estimateHmF2Km(50, 6, 0, 30, 0);
    expect(day).toBeLessThan(night);
  });
  it('stays in physically plausible bounds 220..420 km', () => {
    for (const tIdx of [-50, 0, 100, 200]) {
      for (const hour of [0, 6, 12, 18]) {
        const h = estimateHmF2Km(tIdx, 6, hour, 30, 0);
        expect(h).toBeGreaterThanOrEqual(220);
        expect(h).toBeLessThanOrEqual(420);
      }
    }
  });
});

describe('hopRangeKm', () => {
  it('range increases as take-off elevation decreases (shallower → longer)', () => {
    const high = hopRangeKm(60, 300);
    const mid = hopRangeKm(20, 300);
    const low = hopRangeKm(5, 300);
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
  });
  it('one hop at ~10° take-off, hmF2=300km is in the canonical 2000–3500 km range', () => {
    const r = hopRangeKm(10, 300);
    expect(r).toBeGreaterThan(2000);
    expect(r).toBeLessThan(3500);
  });
  it('vertical incidence (90°) gives near-zero range', () => {
    const r = hopRangeKm(89, 300);
    expect(r).toBeLessThan(15);
  });
  it('grazing (0.5°) gives a long but finite range', () => {
    const r = hopRangeKm(0.5, 300);
    expect(r).toBeGreaterThan(3500);
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe('estimateMUFMHz', () => {
  it('MUF >= foF2 for all non-vertical incidence', () => {
    const fof2 = 8;
    for (const eps of [0.5, 5, 10, 30, 60, 89]) {
      expect(estimateMUFMHz(fof2, eps, 300)).toBeGreaterThanOrEqual(fof2 - 1e-6);
    }
  });
  it('MUF approaches foF2 at near-vertical take-off', () => {
    const fof2 = 8;
    const muf = estimateMUFMHz(fof2, 89, 300);
    expect(muf).toBeLessThan(fof2 * 1.2);
  });
  it('MUF is much higher than foF2 at low take-off', () => {
    const fof2 = 8;
    const muf = estimateMUFMHz(fof2, 5, 300);
    expect(muf).toBeGreaterThan(fof2 * 2);
  });
});

describe('estimateLUFMHz', () => {
  it('is higher at local noon than at midnight', () => {
    const noon = estimateLUFMHz(50, 6, 12, 30, 0);
    const night = estimateLUFMHz(50, 6, 0, 30, 0);
    expect(noon).toBeGreaterThan(night);
  });
  it('rises with T-index at fixed time', () => {
    const quiet = estimateLUFMHz(0, 6, 12, 30, 0);
    const active = estimateLUFMHz(150, 6, 12, 30, 0);
    expect(active).toBeGreaterThan(quiet);
  });
  it('stays in physical bounds 1..12 MHz', () => {
    for (const tIdx of [-50, 0, 100, 200]) {
      for (const hour of [0, 6, 12, 18]) {
        const v = estimateLUFMHz(tIdx, 6, hour, 30, 0);
        expect(v).toBeGreaterThanOrEqual(1.0);
        expect(v).toBeLessThanOrEqual(12.0);
      }
    }
  });
});

describe('predictPropagation', () => {
  const baseInput = {
    frequencyMHz: 14.150,
    tIndex: 50,
    takeoffElevationDeg: 15,
    month: 6,
    utcHour: 12,
    latitudeDeg: 30,
    longitudeDeg: 0,
  };

  it('returns three hops with strictly increasing range', () => {
    const p = predictPropagation(baseInput);
    expect(p.hops.length).toBe(3);
    expect(p.hops[1].rangeKm).toBeGreaterThan(p.hops[0].rangeKm);
    expect(p.hops[2].rangeKm).toBeGreaterThan(p.hops[1].rangeKm);
  });

  it('marks hops as closed when frequency far exceeds MUF', () => {
    const p = predictPropagation({ ...baseInput, frequencyMHz: 50 });
    for (const h of p.hops) {
      expect(h.status).toBe('closed');
      expect(h.reason).toMatch(/> MUF/);
    }
  });

  it('marks hops as closed when frequency is below LUF (daytime, active)', () => {
    const p = predictPropagation({
      ...baseInput,
      frequencyMHz: 1.9,
      tIndex: 200,
    });
    expect(p.hops[0].status).toBe('closed');
    expect(p.hops[0].reason).toMatch(/< LUF/);
  });

  it('marks hops as open between LUF and MUF for a typical 20m daytime path', () => {
    const p = predictPropagation(baseInput);
    expect(p.foF2MHz).toBeGreaterThan(5);
    expect(p.mufMHz).toBeGreaterThan(p.foF2MHz);
    // At 14.15 MHz, midday, T=50, mid-latitudes: usually open.
    if (p.mufMHz > baseInput.frequencyMHz && p.lufMHz < baseInput.frequencyMHz) {
      expect(p.hops[0].status).toMatch(/open|marginal/);
    }
  });

  it('flips hops from closed to open as T-index rises', () => {
    // Pick a frequency above the quiet-sun MUF for our geometry.
    const probe = { ...baseInput, frequencyMHz: 18, tIndex: -50 };
    const quiet = predictPropagation(probe);
    const active = predictPropagation({ ...probe, tIndex: 200 });
    // foF2 must rise with T-index.
    expect(active.foF2MHz).toBeGreaterThan(quiet.foF2MHz);
    // MUF must rise with T-index.
    expect(active.mufMHz).toBeGreaterThan(quiet.mufMHz);
    // If quiet was closed at this frequency, active should be at least marginal.
    if (quiet.hops[0].status === 'closed' && active.mufMHz >= probe.frequencyMHz) {
      expect(active.hops[0].status).not.toBe('closed');
    }
  });

  it('handles edge inputs without throwing or producing NaN', () => {
    const cases = [
      { ...baseInput, tIndex: -50, latitudeDeg: -90, takeoffElevationDeg: 0.5 },
      { ...baseInput, tIndex: 200, latitudeDeg: 90, takeoffElevationDeg: 89.5 },
      { ...baseInput, frequencyMHz: 1.8 },
      { ...baseInput, frequencyMHz: 30 },
      { ...baseInput, utcHour: 0 },
      { ...baseInput, utcHour: 23.99 },
    ];
    for (const c of cases) {
      const p = predictPropagation(c);
      expect(Number.isFinite(p.foF2MHz)).toBe(true);
      expect(Number.isFinite(p.hmF2Km)).toBe(true);
      expect(Number.isFinite(p.mufMHz)).toBe(true);
      expect(Number.isFinite(p.lufMHz)).toBe(true);
      for (const h of p.hops) {
        expect(Number.isFinite(h.rangeKm)).toBe(true);
        expect(h.rangeKm).toBeGreaterThan(0);
      }
    }
  });

  it('calculates azimuthalHops when a pattern is provided', () => {
    const pattern = {
      data: new Float32Array(37 * 72).fill(-20),
      thetaSteps: 37,
      phiSteps: 72,
      dTheta: 5,
      dPhi: 5,
    };
    // Set a peak at 30 deg elevation (theta=60, index 12) for phi=0
    pattern.data[12 * 72 + 0] = 10;
    // Set a peak at 60 deg elevation (theta=30, index 6) for phi=1 (5 deg)
    pattern.data[6 * 72 + 1] = 10;

    const p = predictPropagation({ ...baseInput, frequencyMHz: 7.1, pattern });
    expect(p.azimuthalHops).toBeDefined();
    expect(p.azimuthalHops?.length).toBeGreaterThan(0);

    const hop0 = p.azimuthalHops?.[0];
    expect(hop0?.phiDeg).toBe(0);
    expect(hop0?.takeoffElevationDeg).toBeCloseTo(30);

    const hop1 = p.azimuthalHops?.[1];
    expect(hop1?.phiDeg).toBe(5);
    expect(hop1?.takeoffElevationDeg).toBeCloseTo(60);
    // Higher elevation should have shorter range
    expect(hop1!.rangeKm[0]).toBeLessThan(hop0!.rangeKm[0]);
  });

  it('uses antenna support to choose a relevant ray without changing hop geometry', () => {
    const pattern = {
      data: new Float32Array(37 * 72).fill(-20),
      thetaSteps: 37,
      phiSteps: 72,
      dTheta: 5,
      dPhi: 5,
    };
    // Peak at zenith (10 dBi), drops to USEFUL_SIGNAL_DBI (-5) at 45 deg (ti=9)
    // and stays below USEFUL_SIGNAL_DBI after that.
    for (let ti = 0; ti <= 9; ti++) {
      for (let pi = 0; pi < 72; pi++) {
        pattern.data[ti * 72 + pi] = 10 - (ti * (15 / 9));
      }
    }

    // Global takeoff is zenith (90)
    const pZenith = predictPropagation({ ...baseInput, takeoffElevationDeg: 90 });
    // With pattern, best elevation should be 45 deg (ti=9)
    const pPattern = predictPropagation({ ...baseInput, takeoffElevationDeg: 90, pattern });

    expect(pPattern.hops[0].rangeKm).toBeGreaterThan(pZenith.hops[0].rangeKm);
    // 45 deg hop range is significantly larger than vertical hop (< 15km)
    expect(pPattern.hops[0].rangeKm).toBeGreaterThan(500);
  });

  it('reports SWR mismatch as link quality without changing geometric range', () => {
    const pattern = {
      data: new Float32Array(37 * 72).fill(-20),
      thetaSteps: 37,
      phiSteps: 72,
      dTheta: 5,
      dPhi: 5,
    };
    // Only one useful spot at 15 deg elevation: 0 dBi
    pattern.data[15 * 72 + 0] = 0;

    // Normal case (SWR=1): useful (0 >= -5)
    const pGood = predictPropagation({ ...baseInput, pattern, swr: 1 });
    expect(pGood.hops[0].rangeKm).toBeGreaterThan(0);
    expect(pGood.hops[0].linkQuality).toBe('useful');

    // High SWR (e.g. 10:1): mismatch loss ≈ 4.8 dB.
    // 0 - 4.8 = -4.8 >= -5. Still useful.
    const pBad = predictPropagation({ ...baseInput, pattern, swr: 10 });
    expect(pBad.hops[0].rangeKm).toBeCloseTo(pGood.hops[0].rangeKm);
    expect(pBad.hops[0].linkQuality).toBe('useful');

    // Extremely high SWR (e.g. 20:1): mismatch loss ≈ 8.3 dB.
    // 0 - 8.3 = -8.3 < -5. The path geometry remains the same, but the
    // signal quality degrades instead of forcing the skip distance to zero.
    const pTerrible = predictPropagation({ ...baseInput, pattern, swr: 20 });
    expect(pTerrible.hops[0].rangeKm).toBeCloseTo(pGood.hops[0].rangeKm);
    expect(pTerrible.hops[0].linkQuality).toBe('weak');
  });
});
