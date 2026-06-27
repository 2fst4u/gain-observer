import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
    const originalGetItem = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('Access denied'); };

    // Initializing hook while mock is active should not crash
    expect(() => {
      renderHook(() => useUnitsPersistence());
    }).not.toThrow();

    window.localStorage.getItem = originalGetItem;
  });

  it('handles localStorage.setItem throwing an error gracefully', () => {
    useAntennaStore.setState({ units: 'imperial' });
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error('Quota exceeded'); };

    // Changing state while mock is active should not crash
    expect(() => {
      renderHook(() => useUnitsPersistence());
    }).not.toThrow();

    window.localStorage.setItem = originalSetItem;
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
});
