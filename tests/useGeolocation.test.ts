import { renderHook, act, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from '../src/hooks/useGeolocation';
import { useAntennaStore } from '../src/store/antennaStore';

describe('useGeolocation', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      geolocationStatus: 'idle',
      latitudeDeg: null,
      longitudeDeg: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('handles unsupported geolocation', async () => {
    const originalNavigator = global.navigator;
    Object.defineProperty(global, 'navigator', {
      value: { ...originalNavigator, geolocation: undefined },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    let res;
    await act(async () => {
      res = await result.current.requestLocation();
    });

    expect(res).toEqual({ ok: false, reason: 'unsupported' });
    expect(useAntennaStore.getState().geolocationStatus).toBe('unsupported');

    // Restore navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('handles successful geolocation', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 51.5074,
            longitude: -0.1278,
          },
        });
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    let res;
    await act(async () => {
      res = await result.current.requestLocation();
    });

    expect(res).toEqual({ ok: true, latitudeDeg: 51.5074, longitudeDeg: -0.1278 });
    expect(useAntennaStore.getState().geolocationStatus).toBe('granted');
    expect(useAntennaStore.getState().latitudeDeg).toBe(51.5074);
    expect(useAntennaStore.getState().longitudeDeg).toBe(-0.1278);
  });

  it('handles permission denied', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
        error({ code: 1, message: 'User denied geolocation prompt' });
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    let res;
    await act(async () => {
      res = await result.current.requestLocation();
    });

    expect(res).toEqual({ ok: false, reason: 'denied' });
    expect(useAntennaStore.getState().geolocationStatus).toBe('denied');
  });

  it('handles timeout error', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
        error({ code: 3, message: 'Timeout' });
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    let res;
    await act(async () => {
      res = await result.current.requestLocation();
    });

    expect(res).toEqual({ ok: false, reason: 'timeout' });
    expect(useAntennaStore.getState().geolocationStatus).toBe('error');
  });

  it('handles unknown/other error', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
        error({ code: 2, message: 'Position unavailable' });
      }),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    let res;
    await act(async () => {
      res = await result.current.requestLocation();
    });

    expect(res).toEqual({ ok: false, reason: 'error' });
    expect(useAntennaStore.getState().geolocationStatus).toBe('error');
  });
});
