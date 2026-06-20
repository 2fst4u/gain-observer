import { useEffect } from 'react';
import { useAntennaStore } from '../store/antennaStore';

const STORAGE_KEY = 'gv.units';

export function useUnitsPersistence(): void {
  const units = useAntennaStore((s) => s.units);
  const setUnits = useAntennaStore((s) => s.setUnits);

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
