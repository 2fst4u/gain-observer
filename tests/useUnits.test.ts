import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useUnitsPersistence } from '../src/hooks/useUnits';
import { useAntennaStore } from '../src/store/antennaStore';

const STORAGE_KEY = 'gv.units';

describe('useUnitsPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    useAntennaStore.setState({ units: 'metric' });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('reads metric from localStorage on mount and sets it in the store', () => {
    localStorage.setItem(STORAGE_KEY, 'metric');
    useAntennaStore.setState({ units: 'imperial' });

    renderHook(() => useUnitsPersistence());

    expect(useAntennaStore.getState().units).toBe('metric');
  });

  it('reads imperial from localStorage on mount and sets it in the store', () => {
    localStorage.setItem(STORAGE_KEY, 'imperial');
    useAntennaStore.setState({ units: 'metric' });

    renderHook(() => useUnitsPersistence());

    expect(useAntennaStore.getState().units).toBe('imperial');
  });

  it('ignores unknown values in localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'unknown-value');
    useAntennaStore.setState({ units: 'metric' });

    renderHook(() => useUnitsPersistence());

    expect(useAntennaStore.getState().units).toBe('metric');
  });

  it('does not change units when localStorage is empty', () => {
    useAntennaStore.setState({ units: 'metric' });

    renderHook(() => useUnitsPersistence());

    expect(useAntennaStore.getState().units).toBe('metric');
  });

  it('persists current units to localStorage on mount', () => {
    useAntennaStore.setState({ units: 'metric' });

    renderHook(() => useUnitsPersistence());

    expect(localStorage.getItem(STORAGE_KEY)).toBe('metric');
  });

  it('persists imperial units to localStorage on mount', () => {
    useAntennaStore.setState({ units: 'imperial' });

    renderHook(() => useUnitsPersistence());

    expect(localStorage.getItem(STORAGE_KEY)).toBe('imperial');
  });

  it('handles localStorage.getItem throwing an error gracefully', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('Access denied');
    });

    useAntennaStore.setState({ units: 'metric' });

    expect(() => {
      renderHook(() => useUnitsPersistence());
    }).not.toThrow();

    expect(useAntennaStore.getState().units).toBe('metric');
  });

  it('updates localStorage when units change in the store', () => {
    useAntennaStore.setState({ units: 'metric' });

    renderHook(() => useUnitsPersistence());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('metric');

    act(() => {
      useAntennaStore.getState().setUnits('imperial');
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe('imperial');
  });
  it('handles localStorage.setItem throwing an error gracefully', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('Storage quota exceeded');
    });

    useAntennaStore.setState({ units: 'metric' });

    expect(() => {
      renderHook(() => useUnitsPersistence());
      act(() => {
        useAntennaStore.getState().setUnits('imperial');
      });
    }).not.toThrow();

    expect(useAntennaStore.getState().units).toBe('imperial');
  });

  it('handles window.localStorage getter throwing an error gracefully', () => {
    const getterSpy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    useAntennaStore.setState({ units: 'metric' });

    expect(() => {
      renderHook(() => useUnitsPersistence());
    }).not.toThrow();

    expect(useAntennaStore.getState().units).toBe('metric');
    getterSpy.mockRestore();
  });

  it('does not save invalid unit to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    renderHook(() => useUnitsPersistence());
    setItemSpy.mockClear();

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useAntennaStore.getState().setUnits('invalid-unit' as any);
    });

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
