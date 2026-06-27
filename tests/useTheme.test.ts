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

  it('ignores errors when localStorage.getItem throws on mount', () => {
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Access denied');
    });

    expect(() => {
      renderHook(() => useTheme());
    }).not.toThrow();

    expect(useAntennaStore.getState().theme).toBe('dark');

    getItemSpy.mockRestore();
  });

  it('ignores errors when localStorage.setItem throws', () => {
    renderHook(() => useTheme());

    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Access denied');
    });

    expect(() => {
      act(() => {
        useAntennaStore.getState().setTheme('light');
      });
    }).not.toThrow();

    expect(document.documentElement.dataset.theme).toBe('light');

    setItemSpy.mockRestore();
  });

  it('does not save to localStorage if theme is invalid', () => {
    renderHook(() => useTheme());

    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');

    act(() => {
      useAntennaStore.setState({ theme: 'invalid-theme' as any });
    });

    expect(document.documentElement.dataset.theme).toBe('invalid-theme');
    expect(setItemSpy).not.toHaveBeenCalledWith('gv.theme', 'invalid-theme');

    setItemSpy.mockRestore();
  });
});
