// Binds the Zustand theme state to a data-theme attribute on <html> so CSS
// variables kick in. Also restores theme from localStorage on first load.

import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../store/antennaStore';

const STORAGE_KEY = 'gv.theme';

export function useTheme(): void {
  // ⚡ Bolt: Group multiple store selections into a single useShallow block
  const { theme, setTheme } = useAntennaStore(useShallow((s) => ({
    theme: s.theme,
    setTheme: s.setTheme,
  })));

  // Restore on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      }
    } catch {
      // Ignore localStorage access errors (e.g. strict privacy settings)
    }
  }, [setTheme]);

  // Apply + persist.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      if (theme === 'dark' || theme === 'light') {
        window.localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, [theme]);
}
