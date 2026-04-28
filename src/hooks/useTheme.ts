// Binds the Zustand theme state to a data-theme attribute on <html> so CSS
// variables kick in. Also restores theme from localStorage on first load.

import { useEffect } from 'react';
import { useAntennaStore } from '../store/antennaStore';

const STORAGE_KEY = 'gv.theme';

export function useTheme(): void {
  const theme = useAntennaStore((s) => s.theme);
  const setTheme = useAntennaStore((s) => s.setTheme);

  // Restore on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    }
  }, [setTheme]);

  // Apply + persist.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
}
