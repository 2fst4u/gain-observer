import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../../store/antennaStore';

export function UnitToggle() {
  // ⚡ Bolt: Group multiple store selections into a single useShallow block
  const { units, setUnits } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    setUnits: s.setUnits,
  })));
  return (
    <div className="button-group" role="group" aria-label="Unit system">
      <button
        className={units === 'metric' ? 'active' : ''}
        onClick={() => setUnits('metric')}
        aria-pressed={units === 'metric'}
        title="Meters (U)"
        aria-keyshortcuts="u"
        aria-label="m (Meters)"
      >m</button>
      <button
        className={units === 'imperial' ? 'active' : ''}
        onClick={() => setUnits('imperial')}
        aria-pressed={units === 'imperial'}
        title="Feet (U)"
        aria-keyshortcuts="u"
        aria-label="ft (Feet)"
      >ft</button>
    </div>
  );
}
