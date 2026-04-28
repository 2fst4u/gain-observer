import { useAntennaStore } from '../../store/antennaStore';

export function ThemeToggle() {
  const theme = useAntennaStore((s) => s.theme);
  const toggle = useAntennaStore((s) => s.toggleTheme);
  return (
    <button onClick={toggle} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
