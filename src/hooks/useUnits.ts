import { useEffect } from 'react';
import { useAntennaStore } from '../store/antennaStore';

const STORAGE_KEY = 'gv.units';

export function useUnitsPersistence(): void {
  const units = useAntennaStore((s) => s.units);
  const setUnits = useAntennaStore((s) => s.setUnits);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'metric' || stored === 'imperial') {
      setUnits(stored);
    }
  }, [setUnits]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, units);
  }, [units]);
}
