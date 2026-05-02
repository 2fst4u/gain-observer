import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdaptiveLOD } from '../src/hooks/useAdaptiveLOD';

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
});
