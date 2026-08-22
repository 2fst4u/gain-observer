import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdaptiveLOD, detectLODLevel, LOD_TABLE } from '../src/hooks/useAdaptiveLOD';
import type { LODLevel } from '../src/hooks/useAdaptiveLOD';

describe('useAdaptiveLOD', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns medium level when navigator is undefined', () => {
    // Save the original navigator to restore it later
    const originalNavigator = global.navigator;

    // Create a property descriptor that allows overriding
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useAdaptiveLOD());
    expect(result.current.level).toBe('medium');
    expect(result.current.thetaSegments).toBe(48);
    expect(result.current.phiSegments).toBe(96);

    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe('Desktop', () => {
    it('returns high level when cores >= 8', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        hardwareConcurrency: 8,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('high');
      expect(result.current.thetaSegments).toBe(72);
      expect(result.current.phiSegments).toBe(144);
    });

    it('returns high level when cores > 8', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        hardwareConcurrency: 10,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('high');
    });

    it('returns medium level when cores < 8', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        hardwareConcurrency: 4,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('medium');
    });

    it('returns medium level when hardwareConcurrency is undefined', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        // hardwareConcurrency is intentionally omitted
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('medium');
    });
  });

  describe('Mobile', () => {
    it('returns medium level when mobile device has >= 6 cores', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)', // "Android" matches
        hardwareConcurrency: 8,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('medium');
    });

    it('returns low level when mobile device has < 6 cores', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)', // "iPhone" matches
        hardwareConcurrency: 4,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('low');
      expect(result.current.thetaSegments).toBe(32);
      expect(result.current.phiSegments).toBe(64);
    });

    it('matches Mobi in user agent', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Android 10; Mobile; rv:85.0)', // "Mobi" matches
        hardwareConcurrency: 2,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('low');
    });

    it('matches iPad in user agent', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X)', // "iPad" matches
        hardwareConcurrency: 8,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('medium');
    });
  });

  describe('detectLODLevel', () => {
    it('returns medium level when navigator is undefined', () => {
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(detectLODLevel()).toBe('medium');

      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('returns low level on desktop when deviceMemory <= 2 even with >= 8 cores', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        hardwareConcurrency: 8,
        deviceMemory: 2,
      });
      expect(detectLODLevel()).toBe('low');
    });

    it('returns ultra-low on mobile when deviceMemory <= 1', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        hardwareConcurrency: 8,
        deviceMemory: 1,
      });
      expect(detectLODLevel()).toBe('ultra-low');
    });

    it('returns low on mobile when deviceMemory > 1 and cores < 6', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        hardwareConcurrency: 4,
        deviceMemory: 2,
      });
      expect(detectLODLevel()).toBe('low');
    });

    it('returns medium on mobile when deviceMemory is absent and cores >= 6', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Android',
        hardwareConcurrency: 6,
      });
      expect(detectLODLevel()).toBe('medium');
    });

    it('returns high on desktop when memory is undefined and cores >= 8', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Windows',
        hardwareConcurrency: 8,
      });
      expect(detectLODLevel()).toBe('high');
    });

    it('returns medium on desktop when memory is undefined and cores < 8', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Windows',
        hardwareConcurrency: 4,
      });
      expect(detectLODLevel()).toBe('medium');
    });
  });

  describe('ultra-low', () => {
    it('returns ultra-low when mobile has deviceMemory <= 1', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 10; Mobile)',
        hardwareConcurrency: 4,
        deviceMemory: 1,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('ultra-low');
      expect(result.current.thetaSegments).toBe(16);
      expect(result.current.phiSegments).toBe(32);
    });

    it('returns ultra-low when mobile has deviceMemory < 1', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 9; Mobile)',
        hardwareConcurrency: 4,
        deviceMemory: 0.5,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('ultra-low');
    });

    it('returns low (not ultra-low) for mobile when deviceMemory is 2', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (Linux; Android 12; Mobile)',
        hardwareConcurrency: 4,
        deviceMemory: 2,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('low');
    });

    it('returns low (not ultra-low) when deviceMemory is absent on mobile', () => {
      vi.stubGlobal('navigator', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        hardwareConcurrency: 4,
      });

      const { result } = renderHook(() => useAdaptiveLOD());
      expect(result.current.level).toBe('low');
    });
  });

  describe('LOD_TABLE', () => {
    // Ordered most to least capable. Every tier must cost no more than the
    // tier above it, or a device that detects "low" would do more work than
    // one that detects "high".
    const DESCENDING: LODLevel[] = ['high', 'medium', 'low', 'ultra-low'];

    it('defines exactly one config per LOD level', () => {
      expect(new Set(Object.keys(LOD_TABLE))).toEqual(new Set(DESCENDING));
    });

    it('tags each config with the level it is keyed under', () => {
      for (const level of DESCENDING) {
        expect(LOD_TABLE[level].level).toBe(level);
      }
    });

    it('uses positive integer mesh and sweep tuning throughout', () => {
      for (const level of DESCENDING) {
        const c = LOD_TABLE[level];
        for (const n of [
          c.thetaSegments,
          c.phiSegments,
          c.patternResolution.thetaSteps,
          c.patternResolution.phiSteps,
          c.sweepPoints,
          c.charPoints,
          c.maxAdaptiveIter,
        ]) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThan(0);
        }
      }
    });

    it('sweeps an odd number of points so the centre frequency is sampled', () => {
      for (const level of DESCENDING) {
        expect(LOD_TABLE[level].sweepPoints % 2).toBe(1);
        expect(LOD_TABLE[level].charPoints % 2).toBe(1);
      }
    });

    it('wraps twice as many phi segments as theta segments', () => {
      // The 3-D mesh spans 180° of theta against 360° of phi, so equal
      // angular resolution needs double the phi segments.
      for (const level of DESCENDING) {
        expect(LOD_TABLE[level].phiSegments).toBe(LOD_TABLE[level].thetaSegments * 2);
      }
    });

    it('never increases cost as the level degrades', () => {
      for (let i = 1; i < DESCENDING.length; i++) {
        const richer = LOD_TABLE[DESCENDING[i - 1]!]!;
        const poorer = LOD_TABLE[DESCENDING[i]!]!;

        expect(poorer.thetaSegments).toBeLessThan(richer.thetaSegments);
        expect(poorer.phiSegments).toBeLessThan(richer.phiSegments);
        expect(poorer.patternResolution.thetaSteps).toBeLessThanOrEqual(richer.patternResolution.thetaSteps);
        expect(poorer.patternResolution.phiSteps).toBeLessThanOrEqual(richer.patternResolution.phiSteps);
        expect(poorer.sweepPoints).toBeLessThanOrEqual(richer.sweepPoints);
        expect(poorer.charPoints).toBeLessThanOrEqual(richer.charPoints);
        expect(poorer.maxAdaptiveIter).toBeLessThanOrEqual(richer.maxAdaptiveIter);
      }
    });

    it('only skips the broad scan on the most constrained tier', () => {
      for (const level of DESCENDING) {
        expect(LOD_TABLE[level].skipBroadScan).toBe(level === 'ultra-low');
      }
    });
  });

});
