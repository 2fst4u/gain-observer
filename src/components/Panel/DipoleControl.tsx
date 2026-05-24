import { GeometryStatus } from './GeometryStatus';
import { useState } from 'react';
import { useAntennaStore, legMultipleFromLength } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';
import {
  type OrientationPreset,
  type AntennaType,
} from '../../store/antennaStore';
import { TransformerControl } from './TransformerControl';

export function DipoleControl() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    units,
    antennaType,
    length,
    height,
    frequency,
    orientation,
    vAngle,
    terminatingResistor,
    whipCounterpoise,
    setAntennaType,
    setLength,
    setHalfWaveLength,
    setLegLengthMultiple,
    setHeight,
    setOrientation,
    setVAngle,
    setTerminatingResistor,
    setWhipCounterpoise,
  } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    antennaType: s.antennaType,
    length: s.length,
    height: s.height,
    frequency: s.frequency,
    orientation: s.orientation,
    vAngle: s.vAngle,
    terminatingResistor: s.terminatingResistor,
    whipCounterpoise: s.whipCounterpoise,
    setAntennaType: s.setAntennaType,
    setLength: s.setLength,
    setHalfWaveLength: s.setHalfWaveLength,
    setLegLengthMultiple: s.setLegLengthMultiple,
    setHeight: s.setHeight,
    setOrientation: s.setOrientation,
    setVAngle: s.setVAngle,
    setTerminatingResistor: s.setTerminatingResistor,
    setWhipCounterpoise: s.setWhipCounterpoise,
  })));

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

  const [localResistor, setLocalResistor] = useState(terminatingResistor.toString());
  const [isResistorFocused, setIsResistorFocused] = useState(false);

  const [prevResistor, setPrevResistor] = useState(terminatingResistor);
  if (terminatingResistor !== prevResistor) {
    setPrevResistor(terminatingResistor);
    if (!isResistorFocused) {
      setLocalResistor(terminatingResistor.toString());
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

  const isTravelingWave = antennaType === 'sloping-v';
  const currentLegMultiple = isTravelingWave ? legMultipleFromLength(length, frequency) : 1;
  const lambda = 299.792458 / frequency;

  const resonateLabels: Record<AntennaType, string> = {
    'dipole': '½λ',
    'inverted-v': '½λ',
    'delta-loop': '1λ',
    'sloping-v': '1λ/leg',
    'terminated-delta': '1λ',
    'vertical-whip': '¼λ',
    'inverted-l': '¼λ',
  };

  const resonateTitles: Record<AntennaType, string> = {
    'dipole': 'Half-wave resonant length: ~73 Ω feedpoint — close to a direct 50 Ω coax match with no ATU needed. ~2.15 dBi gain. The most practical starting point for most installations.',
    'inverted-v': 'Set length to resonant ½λ',
    'delta-loop': 'Set perimeter to resonant 1λ',
    'sloping-v': 'Set total length to 2λ (1λ per leg)',
    'terminated-delta': 'Set perimeter to 1λ',
    'vertical-whip': 'Set whip length to resonant ¼λ',
    'inverted-l': 'Set total wire length (vertical + horizontal) to resonant ¼λ. The horizontal section makes up any length the mast height falls short of a full quarter-wave.',
  };

  const isVerticalWhip = antennaType === 'vertical-whip';
  const isInvertedL = antennaType === 'inverted-l';
  const isGroundMountedVertical = isVerticalWhip || isInvertedL;

  const lengthLabel = isVerticalWhip
    ? `Whip length (${unit})`
    : isInvertedL
      ? `Total wire length — vertical + horizontal (${unit})`
      : `Length (${unit})`;

  const heightLabel = isVerticalWhip
    ? `Base height above ground (${unit}) — ${dispHeight.toFixed(1)}`
    : isInvertedL
      ? `Mast / bend-point height (${unit}) — ${dispHeight.toFixed(1)}`
      : `Height above ground (${unit}) — ${dispHeight.toFixed(1)}`;

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Antenna</h2>

      <label htmlFor="antenna-type">Type</label>
      <select
        id="antenna-type"
        value={antennaType}
        onChange={(e) => setAntennaType(e.target.value as AntennaType)}
        style={{ marginBottom: 12 }}
      >
        <option value="dipole">Horizontal Dipole</option>
        <option value="inverted-v">Inverted V</option>
        <option value="sloping-v">Sloping V</option>
        <option value="delta-loop">Delta Loop</option>
        <option value="terminated-delta">Terminated Delta</option>
        <option value="vertical-whip">Vertical Whip</option>
        <option value="inverted-l">Inverted-L</option>
      </select>

      <label htmlFor="dipole-length" style={{ marginTop: 10 }}>{lengthLabel}</label>
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
        {!isTravelingWave && (
          <button
            onClick={setHalfWaveLength}
            title={resonateTitles[antennaType]}
            aria-label={`${resonateLabels[antennaType]} (Resonate antenna length)`}
          >
            {resonateLabels[antennaType]}
          </button>
        )}
        {antennaType === 'dipole' && (
          <button
            onClick={() => setLength(lambda * 1.25)}
            title="Extended Double Zepp length: 3–4 dB more gain than ½λ by using a longer wire aperture — narrower broadside lobes. Trade-off: feedpoint rises to ~1000 Ω, requiring a wide-range ATU or open-wire feedline. Very low heights can push the impedance toward zero, making matching harder."
            aria-label="1.25λ Extended Double Zepp preset length"
          >
            1.25λ
          </button>
        )}
      </div>

      {isTravelingWave && (
        <div className="button-group" role="group" aria-label="Leg length in wavelengths">
          {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((n) => (
            <button
              key={n}
              className={currentLegMultiple === n ? 'active' : ''}
              onClick={() => setLegLengthMultiple(n)}
              title={`Set each leg to ${n}λ — ${(n * 2 * lambda).toFixed(1)} m total`}
              aria-pressed={currentLegMultiple === n}
            >
              {n}λ
            </button>
          ))}
        </div>
      )}

      <label htmlFor="dipole-height" style={{ marginTop: 10 }}>{heightLabel}</label>
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

      {(antennaType === 'sloping-v' || antennaType === 'inverted-v') && (
        <>
          <label htmlFor="sloping-v-angle" style={{ marginTop: 10 }}>V opening angle (°) — {vAngle}°</label>
          <input
            id="sloping-v-angle"
            type="range"
            min={10}
            max={180}
            step={1}
            value={vAngle}
            aria-label="V opening angle in degrees"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setVAngle(val);
            }}
          />
        </>
      )}

      {(antennaType === 'sloping-v' || antennaType === 'terminated-delta') && (
        <>
          <label htmlFor="terminating-resistor" style={{ marginTop: 10 }}>
            Termination resistance (Ω)
          </label>
          <div className="row">
            <input
              id="terminating-resistor"
              type="number"
              min={0}
              step={10}
              value={localResistor}
              aria-describedby="terminating-resistor-hint"
              onFocus={() => setIsResistorFocused(true)}
              onChange={(e) => {
                const s = e.target.value;
                setLocalResistor(s);
                const val = parseFloat(s);
                if (!isNaN(val)) setTerminatingResistor(val);
              }}
              onBlur={() => {
                setIsResistorFocused(false);
                setLocalResistor(terminatingResistor.toString());
              }}
            />
            <button
              onClick={() => setTerminatingResistor(0)}
              disabled={terminatingResistor === 0}
              title={terminatingResistor === 0 ? 'Termination is already off' : 'Remove termination (unterminated antenna)'}
              aria-label="Turn off termination resistor"
              style={{ flex: '0 0 auto' }}
            >
              Off
            </button>
          </div>
          <div id="terminating-resistor-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {terminatingResistor === 0
              ? 'Unterminated: travelling wave reflects, creating a standing-wave pattern. Use this mode to check whether the antenna structure resonates at the design frequency.'
              : antennaType === 'sloping-v'
                ? `${terminatingResistor} Ω resistors at each tip (to ground). Click Off to remove termination and inspect resonance. Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`
                : `${terminatingResistor} Ω resistors at each inner half-base end (to ground via short stubs). Click Off to remove termination and inspect resonance. Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`}
          </div>
        </>
      )}

      {isGroundMountedVertical && (
        <>
          <label
            htmlFor="whip-counterpoise"
            style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: '10px 0 0 0', fontSize: 12 }}
          >
            <input
              id="whip-counterpoise"
              type="checkbox"
              checked={whipCounterpoise}
              onChange={(e) => setWhipCounterpoise(e.target.checked)}
              aria-describedby="whip-counterpoise-hint"
            />
            Add ¼λ counterpoise radials
          </label>
          <div id="whip-counterpoise-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {whipCounterpoise
              ? '4 horizontal ¼λ radials fan out from the base, giving the source a proper low-loss return path (canonical ground-plane vertical).'
              : 'No counterpoise. NEC will report the high reactance and poor SWR that a radial-less base-fed antenna actually exhibits — switch the toggle on to model a proper ground-plane antenna.'}
          </div>
        </>
      )}

      <GeometryStatus />

      {!isGroundMountedVertical && (
        <>
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
        </>
      )}

      {isInvertedL && (
        <>
          <label htmlFor="inverted-l-orientation" style={{ marginTop: 10 }}>Horizontal section direction (°)</label>
          <div className="row">
            <input
              id="inverted-l-orientation"
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

          <div className="button-group" role="group" aria-label="Horizontal section direction presets">
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
        </>
      )}

      {/* Transformer / balun: hidden for base-fed monopole-style antennas —
          the transformer model assumes a balanced two-terminal feedpoint. */}
      {!isGroundMountedVertical && <TransformerControl />}
    </section>
  );
}

