import { describe, expect, it, vi, afterEach } from 'vitest';
import { adaptiveSweep, runScan, clampSpan } from '../src/physics/sweep';
import type { SimulationInput } from '../src/physics/types';
import { SWEEP_F_MIN_MHZ, SWEEP_F_MAX_MHZ } from '../src/physics/constants';

describe('sweep functions', () => {
  // adaptiveSweep/runScan pass `input` straight through to the solver
  // callback without inspecting it, so a minimal valid deck is enough.
  const dummyInput: SimulationInput = {
    frequencyMHz: 14.150,
    wires: [
      { start: [-5, 0, 10], end: [5, 0, 10], radius: 0.001, segments: 11, tag: 1 },
    ],
    ground: { type: 'free' },
    excitation: { wireTag: 1, segment: 6 },
    patternResolution: { thetaSteps: 19, phiSteps: 36 },
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('clampSpan', () => {
    it('computes symmetric span when within limits', () => {
      const result = clampSpan(14, 0.1);
      expect(result.start).toBeCloseTo(13.3, 6);
      expect(result.end).toBeCloseTo(14.7, 6);
    });

    it('clamps start to SWEEP_F_MIN_MHZ', () => {
      const result = clampSpan(1.05, 0.2); // +/- 0.105 -> min is 0.945
      expect(result.start).toBe(SWEEP_F_MIN_MHZ);
      expect(result.end).toBeCloseTo(1.155, 6);
    });

    it('clamps end to SWEEP_F_MAX_MHZ', () => {
      const result = clampSpan(29.5, 0.1); // +/- 1.475 -> max is 30.975
      expect(result.start).toBeCloseTo(28.025, 6);
      expect(result.end).toBe(SWEEP_F_MAX_MHZ);
    });

    it('handles zero spanFraction', () => {
      const result = clampSpan(7.1, 0);
      expect(result.start).toBe(7.1);
      expect(result.end).toBe(7.1);
    });

    it('clamps to min/max HF bounds', () => {
      expect(clampSpan(1, 1).start).toBe(SWEEP_F_MIN_MHZ);
      expect(clampSpan(30, 1).end).toBe(SWEEP_F_MAX_MHZ);
    });

    it('results in start > end for negative spanFraction', () => {
      const result = clampSpan(14, -0.1);
      expect(result.start).toBeGreaterThan(result.end);
      expect(result.start).toBeCloseTo(14.7, 6);
      expect(result.end).toBeCloseTo(13.3, 6);
    });
  });

  describe('runScan', () => {
    it('throws if impedance is missing', async () => {
      const mockCb = vi.fn().mockResolvedValue([{ impedance: null, power: null }]);
      await expect(runScan(mockCb, dummyInput, 14, 15, 1)).rejects.toThrow(/missing impedance/);
    });

    it('returns valid sweep points for n > 1', async () => {
      const mockCb = vi.fn().mockResolvedValue([
        { impedance: { R: 50, X: 0 }, power: 1 },
        { impedance: { R: 50, X: 0 }, power: 1 },
      ]);
      const res = await runScan(mockCb, dummyInput, 14, 15, 2);
      expect(res).toHaveLength(2);
      expect(res[0].frequencyMHz).toBe(14);
      expect(res[1].frequencyMHz).toBe(15);
      expect(res[0].R).toBe(50);
      expect(mockCb).toHaveBeenCalledWith(dummyInput, 2, 14, 1);
    });
  });

  describe('adaptiveSweep', () => {
    it('returns immediately if first scan has >2:1 on both sides', async () => {
      const mockCb = vi.fn().mockImplementation((input, n) => {
        const arr = [];
        for (let i=0; i<n; i++) {
            if (i === 0 || i === n - 1) {
                arr.push({ impedance: { R: 150, X: 0 }, power: 1 });
            } else {
                arr.push({ impedance: { R: 50, X: 0 }, power: 1 });
            }
        }
        return Promise.resolve(arr);
      });

      const res = await adaptiveSweep(mockCb, dummyInput, 15, 1, { charPoints: 3, skipBroadScan: true });
      expect(res).toHaveLength(15);
      expect(mockCb).toHaveBeenCalledTimes(2); // 1 char scan, 1 final sweep
    });

    it('expands if edges are < 2:1 and hits limit without 2:1 edges', async () => {
      const mockCb = vi.fn().mockImplementation((input, n) => {
        return Promise.resolve(Array(n).fill({ impedance: { R: 50, X: 0 }, power: 1 }));
      });
      const res = await adaptiveSweep(mockCb, dummyInput, 15, 1, { maxIter: 5, skipBroadScan: true });
      expect(res).toHaveLength(15);
    });

    it('handles empty bands if SWR is > 2 everywhere', async () => {
      const mockCb = vi.fn().mockImplementation((input, n) => {
        return Promise.resolve(Array(n).fill({ impedance: { R: 150, X: 0 }, power: 1 }));
      });
      const res = await adaptiveSweep(mockCb, dummyInput, 10, 1, { skipBroadScan: true });
      expect(res).toHaveLength(10);
    });

    it('performs broad scan and does not merge distant band if it would undersample operating band', async () => {
      const mockCb = vi.fn().mockImplementation((input, n, startFreq, step) => {
        const arr = [];
        for (let i=0; i<n; i++) {
            const freq = n === 1 ? startFreq : startFreq + step * i;
            let R = 150;
            if (Math.abs(freq - 14.150) < 0.2) R = 50;
            if (Math.abs(freq - 28.0) < 0.2) R = 50;
            arr.push({ impedance: { R, X: 0 }, power: 1 });
        }
        return Promise.resolve(arr);
      });

      const res = await adaptiveSweep(mockCb, dummyInput, 15, 1, { charPoints: 5, maxIter: 2, skipBroadScan: false });

      expect(res).toHaveLength(15);
      const endF = res[res.length - 1].frequencyMHz;
      expect(endF).toBeLessThan(20);
    });

    it('performs broad scan and merges distant band if operating band remains well sampled', async () => {
      const mockCb = vi.fn().mockImplementation((input, n, startFreq, step) => {
        const arr = [];
        for (let i=0; i<n; i++) {
            const freq = n === 1 ? startFreq : startFreq + step * i;
            let R = 150;
            if (Math.abs(freq - 14.150) < 0.2) R = 50;
            if (Math.abs(freq - 28.0) < 1.0) R = 50;
            arr.push({ impedance: { R, X: 0 }, power: 1 });
        }
        return Promise.resolve(arr);
      });

      const res = await adaptiveSweep(mockCb, dummyInput, 500, 1, { charPoints: 5, maxIter: 2, skipBroadScan: false });

      expect(res).toHaveLength(500);
      const endF = res[res.length - 1].frequencyMHz;
      expect(endF).toBeGreaterThan(28.0);
    });

    it('merges distant band if there is no operating frequency band', async () => {
       const mockCb = vi.fn().mockImplementation((input, n, startFreq, step) => {
        const arr = [];
        for (let i=0; i<n; i++) {
            const freq = n === 1 ? startFreq : startFreq + step * i;
            let R = 150;
            if (Math.abs(freq - 28.0) < 1.0) R = 50;
            arr.push({ impedance: { R, X: 0 }, power: 1 });
        }
        return Promise.resolve(arr);
      });

      const res = await adaptiveSweep(mockCb, dummyInput, 15, 1, { charPoints: 5, maxIter: 2, skipBroadScan: false });

      const endF = res[res.length - 1].frequencyMHz;
      expect(endF).toBeGreaterThan(28.0);
    });

    it('handles single-point sweeps correctly', async () => {
      const mockCb = vi.fn().mockImplementation((input, n) => {
        return Promise.resolve(Array(n).fill({ impedance: { R: 50, X: 0 }, power: 1 }));
      });
      const res = await adaptiveSweep(mockCb, dummyInput, 1, 1, { skipBroadScan: false });
      expect(res).toHaveLength(1);
    });

    it('forces winEnd = winStart + 0.1 if winEnd is not > winStart', async () => {
      const mockCb = vi.fn().mockImplementation((input, n) => {
        return Promise.resolve(Array(n).fill({ impedance: { R: 150, X: 0 }, power: 1 }));
      });
      const res = await adaptiveSweep(mockCb, dummyInput, 2, 1, { charPoints: 1, maxIter: 1, skipBroadScan: true });
      expect(res).toHaveLength(2);
    });

    it('finds bestDistance for operatingBandWidth', async () => {
      const mockCb = vi.fn().mockImplementation((input, n, startFreq, step) => {
        const arr = [];
        for (let i=0; i<n; i++) {
            const freq = n === 1 ? startFreq : startFreq + step * i;
            let R = 150;
            if (Math.abs(freq - 10.0) < 0.2) R = 50; // band 1
            if (Math.abs(freq - 28.0) < 0.2) R = 50; // band 2
            arr.push({ impedance: { R, X: 0 }, power: 1 });
        }
        return Promise.resolve(arr);
      });

      const res = await adaptiveSweep(mockCb, dummyInput, 15, 1, { charPoints: 15, maxIter: 2, skipBroadScan: false });
      expect(res).toHaveLength(15);
    });
  });
});
