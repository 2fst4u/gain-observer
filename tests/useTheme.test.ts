import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../src/hooks/useTheme';
import { useAntennaStore } from '../src/store/antennaStore';

describe('useTheme hook', () => {
  beforeEach(() => {
    // Reset DOM and store before each test
    document.documentElement.dataset.theme = '';
    window.localStorage.clear();
    useAntennaStore.setState({ theme: 'dark' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies the initial theme to document and localStorage', () => {
    renderHook(() => useTheme());

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('gv.theme')).toBe('dark');
  });

  it('restores theme from localStorage on mount if valid', () => {
    window.localStorage.setItem('gv.theme', 'light');

    renderHook(() => useTheme());

    // It should have called setTheme('light'), which updates the store and then applies it
    expect(useAntennaStore.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('ignores invalid theme in localStorage', () => {
    window.localStorage.setItem('gv.theme', 'invalid-theme');

    renderHook(() => useTheme());

    // Should remain 'dark'
    expect(useAntennaStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('updates document and localStorage when theme changes in store', () => {
    renderHook(() => useTheme());

    act(() => {
      useAntennaStore.getState().setTheme('light');
    });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('gv.theme')).toBe('light');
  });

  it('handles localStorage.getItem errors gracefully', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied');
    });

    renderHook(() => useTheme());

    expect(useAntennaStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    getItemSpy.mockRestore();
  });

  it('handles localStorage.setItem errors gracefully', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    renderHook(() => useTheme());

    act(() => {
      useAntennaStore.getState().setTheme('light');
    });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(useAntennaStore.getState().theme).toBe('light');

    setItemSpy.mockRestore();
  });


  it('handles window.localStorage getter throwing an error gracefully', () => {
    const getterSpy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => {
      renderHook(() => useTheme());
    }).not.toThrow();

    expect(useAntennaStore.getState().theme).toBe('dark');
    getterSpy.mockRestore();
  });

  it('does not save invalid theme to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    renderHook(() => useTheme());
    setItemSpy.mockClear();

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useAntennaStore.getState().setTheme('invalid-theme' as any);
    });

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
