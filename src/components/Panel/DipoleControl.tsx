import { useEffect, useState } from 'react';
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

  const [localLen, setLocalLen] = useState(dispLen.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalLen(dispLen.toString());
    }
  }, [dispLen, isFocused]);
  const maxHeight = units === 'metric' ? 40 : 131;

  const orientations: Orientation[] = ['EW', 'NS', 'NE-SW', 'NW-SE'];

  return (
    <div className="panel-section">
      <h3>Dipole</h3>

      <label htmlFor="dipole-length">Length ({unit})</label>
      <div className="row">
        <input
          id="dipole-length"
          type="number"
          min={0.1}
          step={0.1}
          value={localLen}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalLen(s);
            const val = parseFloat(s);
            if (!isNaN(val)) {
              setLength(fromDisplayLength(val, units));
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            setLocalLen(dispLen.toString());
          }}
        />
        <button
          onClick={setHalfWaveLength}
          title="Set length to resonant ½λ"
          aria-label="Set length to resonant half wavelength"
        >
          ½λ
        </button>
      </div>

      <label htmlFor="dipole-height" style={{ marginTop: 10 }}>Height above ground ({unit}) — {dispHeight.toFixed(1)}</label>
      <input
        id="dipole-height"
        type="range"
        min={0}
        max={maxHeight}
        step={units === 'metric' ? 0.5 : 1}
        value={dispHeight}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) setHeight(fromDisplayLength(val, units));
        }}
      />

      <label id="dipole-orientation" style={{ marginTop: 10 }}>Orientation</label>
      <div className="button-group" role="group" aria-labelledby="dipole-orientation">
        {orientations.map((o) => (
          <button
            key={o}
            className={orientation === o ? 'active' : ''}
            onClick={() => setOrientation(o)}
            aria-pressed={orientation === o}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
