import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../store/antennaStore';

const STORAGE_KEY = 'gv.units';

export function useUnitsPersistence(): void {
  // ⚡ Bolt: Group multiple store selections into a single useShallow block
  const { units, setUnits } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    setUnits: s.setUnits,
  })));

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'metric' || stored === 'imperial') {
        setUnits(stored);
      }
    } catch {
      // Ignore localStorage access errors (e.g. strict privacy settings)
    }
  }, [setUnits]);

  useEffect(() => {
    try {
      if (units === 'metric' || units === 'imperial') {
        window.localStorage.setItem(STORAGE_KEY, units);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, [units]);
}
