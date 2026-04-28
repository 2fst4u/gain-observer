import { useAntennaStore } from '../../store/antennaStore';

export function UnitToggle() {
  const units = useAntennaStore((s) => s.units);
  const setUnits = useAntennaStore((s) => s.setUnits);
  return (
    <div className="button-group" role="group" aria-label="Unit system">
      <button
        className={units === 'metric' ? 'active' : ''}
        onClick={() => setUnits('metric')}
      >m</button>
      <button
        className={units === 'imperial' ? 'active' : ''}
        onClick={() => setUnits('imperial')}
      >ft</button>
    </div>
  );
}
