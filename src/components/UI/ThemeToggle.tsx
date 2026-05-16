import { useAntennaStore } from '../../store/antennaStore';

export function ThemeToggle() {
  const theme = useAntennaStore((s) => s.theme);
  const toggle = useAntennaStore((s) => s.toggleTheme);
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
