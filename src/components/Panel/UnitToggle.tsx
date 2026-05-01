import { useAntennaStore } from '../../store/antennaStore';

export function UnitToggle() {
  const units = useAntennaStore((s) => s.units);
  const setUnits = useAntennaStore((s) => s.setUnits);
  return (
    <div className="button-group" role="group" aria-label="Unit system">
      <button
        className={units === 'metric' ? 'active' : ''}
        onClick={() => setUnits('metric')}
        aria-pressed={units === 'metric'}
        aria-label="Meters"
      >m</button>
      <button
        className={units === 'imperial' ? 'active' : ''}
        onClick={() => setUnits('imperial')}
        aria-pressed={units === 'imperial'}
        aria-label="Feet"
      >ft</button>
    </div>
  );
}
