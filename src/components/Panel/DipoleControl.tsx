import { useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';
import {
  type OrientationPreset,
} from '../../store/antennaStore';

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

  const [localLen, setLocalLen] = useState(dispLen.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  const [prevDispLen, setPrevDispLen] = useState(dispLen);
  if (dispLen !== prevDispLen) {
    setPrevDispLen(dispLen);
    if (!isFocused) {
      setLocalLen(dispLen.toFixed(2));
    }
  }

  const orientations: OrientationPreset[] = ['NS', 'EW', 'NE-SW', 'NW-SE'];
  const PRESET_DEGREES: Record<OrientationPreset, number> = {
    'NS': 0,
    'EW': 90,
    'NE-SW': 45,
    'NW-SE': 315,
  };

  const currentDegrees = typeof orientation === 'number' ? orientation : PRESET_DEGREES[orientation];
  const [localOrient, setLocalOrient] = useState(currentDegrees.toString());
  const [isOrientFocused, setIsOrientFocused] = useState(false);

  const [prevOrient, setPrevOrient] = useState(orientation);
  if (orientation !== prevOrient) {
    setPrevOrient(orientation);
    if (!isOrientFocused) {
      setLocalOrient(currentDegrees.toString());
    }
  }

  const maxHeight = units === 'metric' ? 40 : 131;

  return (
    <div className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Dipole</h2>

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
            setLocalLen(dispLen.toFixed(2));
          }}
        />
        <button
          onClick={setHalfWaveLength}
          title="Set length to resonant ½λ"
          aria-label="½λ (Set length to resonant half wavelength)"
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

      <label htmlFor="dipole-orientation" style={{ marginTop: 10 }}>Orientation (°)</label>
      <div className="row">
        <input
          id="dipole-orientation"
          type="number"
          min={0}
          max={359}
          step={1}
          value={localOrient}
          onFocus={() => setIsOrientFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalOrient(s);
            const val = parseFloat(s);
            if (!isNaN(val)) {
              setOrientation(val);
            }
          }}
          onBlur={() => {
            setIsOrientFocused(false);
            setLocalOrient(currentDegrees.toString());
          }}
        />
      </div>

      <div className="button-group" role="group" aria-label="Orientation presets">
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
