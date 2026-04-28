import { useAntennaStore } from '../../store/antennaStore';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';
import type { Orientation } from '../../store/antennaStore';

export function DipoleControl() {
  const units = useAntennaStore((s) => s.units);
  const length = useAntennaStore((s) => s.length);
  const height = useAntennaStore((s) => s.height);
  const orientation = useAntennaStore((s) => s.orientation);
  const setLength = useAntennaStore((s) => s.setLength);
  const setHalfWaveLength = useAntennaStore((s) => s.setHalfWaveLength);
  const setHeight = useAntennaStore((s) => s.setHeight);
  const setOrientation = useAntennaStore((s) => s.setOrientation);

  const unit = displayLengthUnit(units);
  const dispLen = toDisplayLength(length, units);
  const dispHeight = toDisplayLength(height, units);
  const maxHeight = units === 'metric' ? 40 : 131;

  const orientations: Orientation[] = ['EW', 'NS', 'NE-SW', 'NW-SE'];

  return (
    <div className="panel-section">
      <h3>Dipole</h3>

      <label>Length ({unit})</label>
      <div className="row">
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={dispLen.toFixed(2)}
          onChange={(e) => setLength(fromDisplayLength(parseFloat(e.target.value), units))}
        />
        <button onClick={setHalfWaveLength} title="Set length to resonant ½λ">½λ</button>
      </div>

      <label style={{ marginTop: 10 }}>Height above ground ({unit}) — {dispHeight.toFixed(1)}</label>
      <input
        type="range"
        min={0}
        max={maxHeight}
        step={units === 'metric' ? 0.5 : 1}
        value={dispHeight}
        onChange={(e) => setHeight(fromDisplayLength(parseFloat(e.target.value), units))}
      />

      <label style={{ marginTop: 10 }}>Orientation</label>
      <div className="button-group">
        {orientations.map((o) => (
          <button
            key={o}
            className={orientation === o ? 'active' : ''}
            onClick={() => setOrientation(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
