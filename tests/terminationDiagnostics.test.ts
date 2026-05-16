import { describe, it, expect } from 'vitest';
import {
  computeCurrentRippleByTag,
  computeFrontBackDb,
  computeTerminationDiagnostics,
} from '../src/physics/terminationDiagnostics';
import type { SegmentCurrent, GainPattern, PowerBudget } from '../src/physics/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCurrent(segNo: number, tagNo: number, magnitude: number): SegmentCurrent {
  return { segNo, tagNo, x: 0, y: 0, z: 0, magnitude, phase: 0 };
}

function makePattern(data: number[], thetaSteps: number, phiSteps: number): GainPattern {
  return {
    data: new Float32Array(data),
    thetaSteps,
    phiSteps,
    dTheta: 180 / (thetaSteps - 1),
    dPhi: 360 / phiSteps,
  };
}

// ---------------------------------------------------------------------------
// computeCurrentRippleByTag
// ---------------------------------------------------------------------------

describe('computeCurrentRippleByTag', () => {
  it('returns empty array when no currents supplied', () => {
    expect(computeCurrentRippleByTag([])).toEqual([]);
  });

  it('excludes tags with fewer than 2 segments', () => {
    const currents = [makeCurrent(1, 5, 1e-3)];
    const ripples = computeCurrentRippleByTag(currents);
    expect(ripples).toHaveLength(0);
  });

  it('computes ripple = 1.0 (0 dB) for uniform current', () => {
    const currents = [
      makeCurrent(1, 1, 1e-3),
      makeCurrent(2, 1, 1e-3),
      makeCurrent(3, 1, 1e-3),
    ];
    const [r] = computeCurrentRippleByTag(currents);
    expect(r!.ripple).toBeCloseTo(1, 10);
    expect(r!.rippleDb).toBeCloseTo(0, 10);
  });

  it('computes ripple = 2.0 (6.02 dB) for 2:1 current variation', () => {
    const currents = [
      makeCurrent(1, 1, 2e-3),
      makeCurrent(2, 1, 1e-3),
    ];
    const [r] = computeCurrentRippleByTag(currents);
    expect(r!.ripple).toBeCloseTo(2, 10);
    expect(r!.rippleDb).toBeCloseTo(20 * Math.log10(2), 5);
  });

  it('handles multiple tags independently', () => {
    const currents = [
      makeCurrent(1, 1, 4e-3),
      makeCurrent(2, 1, 2e-3),  // tag 1 ripple = 2
      makeCurrent(1, 2, 3e-3),
      makeCurrent(2, 2, 1e-3),  // tag 2 ripple = 3
    ];
    const ripples = computeCurrentRippleByTag(currents);
    expect(ripples).toHaveLength(2);
    const r1 = ripples.find((r) => r.tagNo === 1)!;
    const r2 = ripples.find((r) => r.tagNo === 2)!;
    expect(r1.ripple).toBeCloseTo(2, 10);
    expect(r2.ripple).toBeCloseTo(3, 10);
  });

  it('returns tags in ascending order', () => {
    const currents = [
      makeCurrent(1, 3, 1e-3), makeCurrent(2, 3, 2e-3),
      makeCurrent(1, 1, 1e-3), makeCurrent(2, 1, 1e-3),
    ];
    const tags = computeCurrentRippleByTag(currents).map((r) => r.tagNo);
    expect(tags).toEqual([1, 3]);
  });

  it('returns Infinity ripple when min current is zero', () => {
    const currents = [
      makeCurrent(1, 1, 1e-3),
      makeCurrent(2, 1, 0),
    ];
    const [r] = computeCurrentRippleByTag(currents);
    expect(r!.ripple).toBe(Infinity);
    expect(r!.rippleDb).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// computeFrontBackDb
// ---------------------------------------------------------------------------

describe('computeFrontBackDb', () => {
  it('returns null for single phi step', () => {
    const pattern = makePattern([5.0], 1, 1);
    expect(computeFrontBackDb(pattern, 30, 0)).toBeNull();
  });

  it('returns 0 dB for symmetric pattern (same gain front and back)', () => {
    // 1 theta step (at horizon), 4 phi steps (0, 90, 180, 270)
    const pattern = makePattern([2.0, 2.0, 2.0, 2.0], 1, 4);
    const fb = computeFrontBackDb(pattern, 0, 0);
    expect(fb).toBeCloseTo(0, 10);
  });

  it('returns positive dB when forward gain exceeds rear', () => {
    // 1 theta step, 4 phi steps: front (phi=0) = 5 dBi, rear (phi=180) = -5 dBi
    const pattern = makePattern([5.0, 2.0, -5.0, 2.0], 1, 4);
    // takeoffAzimuth=0° → front=index 0, back=index 2 (180°)
    const fb = computeFrontBackDb(pattern, 0, 0);
    expect(fb).toBeCloseTo(10, 5); // 5 - (-5) = 10 dB
  });

  it('looks up the correct theta row based on elevation', () => {
    // 3 theta steps (0°, 90°, 180°), 2 phi steps (0°, 180°)
    // Row theta=0° (zenith): [1.0, 1.0]
    // Row theta=90° (horizon): [8.0, 2.0]  ← this is elevation=0°
    // Row theta=180°: [1.0, 1.0]
    const pattern = makePattern([1.0, 1.0, 8.0, 2.0, 1.0, 1.0], 3, 2);
    const fb = computeFrontBackDb(pattern, 0, 0); // elevation=0 → theta=90°
    expect(fb).toBeCloseTo(6, 5); // 8 - 2 = 6 dB
  });

  it('returns null when theta index is out of bounds', () => {
    // 2 theta steps (theta=0°, theta=180°), dTheta=180°.
    // elevation=200° → thetaDeg=-110° → ti=round(-110/180)=-1 → out of bounds.
    const pattern = makePattern([2.0, 2.0, 2.0, 2.0], 2, 2);
    expect(computeFrontBackDb(pattern, 200, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeTerminationDiagnostics
// ---------------------------------------------------------------------------

describe('computeTerminationDiagnostics', () => {
  const currents: SegmentCurrent[] = [
    makeCurrent(1, 1, 2e-3), makeCurrent(2, 1, 1e-3),
    makeCurrent(1, 2, 1.5e-3), makeCurrent(2, 2, 0.5e-3),
  ];
  const budget: PowerBudget = {
    inputW: 0.01,
    radiatedW: 0.006,
    structureLossW: 0.0005,
    networkLossW: 0.0035,
    efficiencyPct: 60,
  };
  // 1 theta step (elevation=0, theta=90°), 4 phi steps
  const pattern = makePattern([5.0, 0.0, -3.0, 0.0], 1, 4);

  it('assembles all diagnostic fields', () => {
    const d = computeTerminationDiagnostics(currents, budget, pattern, 0, 0);
    expect(d.currentRippleByTag).toHaveLength(2);
    expect(d.powerBudget).toBe(budget);
    expect(d.frontBackDb).toBeCloseTo(8, 5); // 5 - (-3) = 8 dB
  });

  it('passes null powerBudget through unchanged', () => {
    const d = computeTerminationDiagnostics(currents, null, pattern, 0, 0);
    expect(d.powerBudget).toBeNull();
  });

  it('networkLossW represents termination resistor dissipation', () => {
    const d = computeTerminationDiagnostics(currents, budget, pattern, 0, 0);
    expect(d.powerBudget!.networkLossW).toBeCloseTo(0.0035, 10);
  });

  it('lower ripple for more uniform (travelling-wave-like) current', () => {
    const uniform: SegmentCurrent[] = [
      makeCurrent(1, 1, 1.0e-3), makeCurrent(2, 1, 1.0e-3), makeCurrent(3, 1, 1.0e-3),
    ];
    const rippled: SegmentCurrent[] = [
      makeCurrent(1, 1, 2.0e-3), makeCurrent(2, 1, 1.0e-3), makeCurrent(3, 1, 0.5e-3),
    ];
    const dUniform = computeTerminationDiagnostics(uniform, null, pattern, 0, 0);
    const dRippled = computeTerminationDiagnostics(rippled, null, pattern, 0, 0);
    const uniformRipple = dUniform.currentRippleByTag[0]!.rippleDb;
    const rippledRipple = dRippled.currentRippleByTag[0]!.rippleDb;
    expect(uniformRipple).toBeLessThan(rippledRipple);
    expect(uniformRipple).toBeCloseTo(0, 10);
  });
});
