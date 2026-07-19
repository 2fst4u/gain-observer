import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../../store/antennaStore';

export function ThemeToggle() {
  // ⚡ Bolt: Group multiple store selections into a single useShallow block
  const { theme, toggleTheme: toggle } = useAntennaStore(useShallow((s) => ({
    theme: s.theme,
    toggleTheme: s.toggleTheme,
  })));
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light (T)' : 'Switch to dark (T)'}
      aria-keyshortcuts="t"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
