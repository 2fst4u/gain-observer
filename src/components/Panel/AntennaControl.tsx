import { useState } from 'react';
import { useAntennaStore, type AntennaType } from '../../store/antennaStore';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';
import {
  type OrientationPreset,
} from '../../store/antennaStore';

export function AntennaControl() {
  const units = useAntennaStore((s) => s.units);
  const type = useAntennaStore((s) => s.type);
  const length = useAntennaStore((s) => s.length);
  const vAngle = useAntennaStore((s) => s.vAngle);
  const legSlope = useAntennaStore((s) => s.legSlope);
  const terminatedEnabled = useAntennaStore((s) => s.terminatedEnabled);
  const terminatingResistor = useAntennaStore((s) => s.terminatingResistor);
  const height = useAntennaStore((s) => s.height);
  const orientation = useAntennaStore((s) => s.orientation);
  const setType = useAntennaStore((s) => s.setType);
  const setLength = useAntennaStore((s) => s.setLength);
  const setVAngle = useAntennaStore((s) => s.setVAngle);
  const setLegSlope = useAntennaStore((s) => s.setLegSlope);
  const setTerminatedEnabled = useAntennaStore((s) => s.setTerminatedEnabled);
  const setTerminatingResistor = useAntennaStore((s) => s.setTerminatingResistor);
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

  const [localVAngle, setLocalVAngle] = useState(vAngle.toString());
  const [isVAngleFocused, setIsVAngleFocused] = useState(false);
  const [prevVAngle, setPrevVAngle] = useState(vAngle);
  if (vAngle !== prevVAngle) {
    setPrevVAngle(vAngle);
    if (!isVAngleFocused) setLocalVAngle(vAngle.toString());
  }

  const [localLegSlope, setLocalLegSlope] = useState(legSlope.toString());
  const [isLegSlopeFocused, setIsLegSlopeFocused] = useState(false);
  const [prevLegSlope, setPrevLegSlope] = useState(legSlope);
  if (legSlope !== prevLegSlope) {
    setPrevLegSlope(legSlope);
    if (!isLegSlopeFocused) setLocalLegSlope(legSlope.toString());
  }

  const [localTerminator, setLocalTerminator] = useState(terminatingResistor.toString());
  const [isTerminatorFocused, setIsTerminatorFocused] = useState(false);
  const [prevTerminator, setPrevTerminator] = useState(terminatingResistor);
  if (terminatingResistor !== prevTerminator) {
    setPrevTerminator(terminatingResistor);
    if (!isTerminatorFocused) setLocalTerminator(terminatingResistor.toString());
  }

  return (
    <div className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Antenna</h2>

      <label htmlFor="antenna-type">Type</label>
      <select
        id="antenna-type"
        value={type}
        onChange={(e) => setType(e.target.value as AntennaType)}
      >
        <option value="dipole">Dipole</option>
        <option value="inverted-v">Inverted V</option>
        <option value="sloping-v">Sloping V</option>
        <option value="delta-loop">Delta Loop</option>
      </select>

      <label htmlFor="dipole-length" style={{ marginTop: 10 }}>
        {type === 'delta-loop' ? `Perimeter (${unit})` : `Total wire length (${unit})`}
      </label>
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
          title={
            type === 'delta-loop'
              ? 'Set perimeter to one full wavelength (resonant 1λ loop)'
              : type === 'sloping-v'
                ? 'Set total wire length to two wavelengths (about 1λ per leg for vee-beam directionality)'
              : 'Set length to resonant ½λ'
          }
          aria-label={
            type === 'delta-loop'
              ? 'Set perimeter to one wavelength'
              : type === 'sloping-v'
                ? 'Set total wire length to two wavelengths'
              : 'Set length to resonant half wavelength'
          }
        >
          {type === 'delta-loop' ? '1λ' : type === 'sloping-v' ? '2λ' : '½λ'}
        </button>
      </div>

      {(type === 'inverted-v' || type === 'sloping-v') && (
        <>
          <label htmlFor="v-angle" style={{ marginTop: 10 }}>V-Angle (°)</label>
          <input
            id="v-angle"
            type="number"
            min={10}
            max={180}
            step={1}
            value={localVAngle}
            onFocus={() => setIsVAngleFocused(true)}
            onChange={(e) => {
              setLocalVAngle(e.target.value);
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setVAngle(val);
            }}
            onBlur={() => {
              setIsVAngleFocused(false);
              setLocalVAngle(vAngle.toString());
            }}
          />
        </>
      )}

      {type === 'sloping-v' && (
        <>
          <label htmlFor="leg-slope" style={{ marginTop: 10 }}>Leg Slope (°)</label>
          <input
            id="leg-slope"
            type="number"
            min={0}
            max={90}
            step={1}
            value={localLegSlope}
            onFocus={() => setIsLegSlopeFocused(true)}
            onChange={(e) => {
              setLocalLegSlope(e.target.value);
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setLegSlope(val);
            }}
            onBlur={() => {
              setIsLegSlopeFocused(false);
              setLocalLegSlope(legSlope.toString());
            }}
          />
        </>
      )}

      <div className="row" style={{ marginTop: 10, alignItems: 'center' }}>
        <input
          id="terminated-enabled"
          type="checkbox"
          checked={terminatedEnabled}
          onChange={(e) => setTerminatedEnabled(e.target.checked)}
        />
        <label htmlFor="terminated-enabled" style={{ marginLeft: 8, marginTop: 0, cursor: 'pointer', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>Terminated</label>
      </div>

      {terminatedEnabled && (
        <>
          <label htmlFor="terminating-resistor" style={{ marginTop: 10 }}>Terminator (Ω)</label>
          <input
            id="terminating-resistor"
            type="number"
            min={1}
            step={1}
            value={localTerminator}
            onFocus={() => setIsTerminatorFocused(true)}
            onChange={(e) => {
              setLocalTerminator(e.target.value);
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setTerminatingResistor(val);
            }}
            onBlur={() => {
              setIsTerminatorFocused(false);
              setLocalTerminator(terminatingResistor.toString());
            }}
          />
        </>
      )}

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
