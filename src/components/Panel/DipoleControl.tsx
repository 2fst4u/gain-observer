import { useState } from 'react';
import { useAntennaStore, legMultipleFromLength } from '../../store/antennaStore';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';
import {
  type OrientationPreset,
  type AntennaType,
} from '../../store/antennaStore';
import { FEED_BRIDGE_LENGTH_M, SLOPING_V_MIN_TIP_Z_M } from '../../physics/constants';

export function DipoleControl() {
  const units = useAntennaStore((s) => s.units);
  const antennaType = useAntennaStore((s) => s.antennaType);
  const length = useAntennaStore((s) => s.length);
  const height = useAntennaStore((s) => s.height);
  const frequency = useAntennaStore((s) => s.frequency);
  const orientation = useAntennaStore((s) => s.orientation);
  const vAngle = useAntennaStore((s) => s.vAngle);
  const terminatingResistor = useAntennaStore((s) => s.terminatingResistor);
  const setAntennaType = useAntennaStore((s) => s.setAntennaType);
  const setLength = useAntennaStore((s) => s.setLength);
  const setHalfWaveLength = useAntennaStore((s) => s.setHalfWaveLength);
  const setLegLengthMultiple = useAntennaStore((s) => s.setLegLengthMultiple);
  const setHeight = useAntennaStore((s) => s.setHeight);
  const setOrientation = useAntennaStore((s) => s.setOrientation);
  const setVAngle = useAntennaStore((s) => s.setVAngle);
  const setTerminatingResistor = useAntennaStore((s) => s.setTerminatingResistor);

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
  };

  const resonateTitles: Record<AntennaType, string> = {
    'dipole': 'Set length to resonant ½λ',
    'inverted-v': 'Set length to resonant ½λ',
    'delta-loop': 'Set perimeter to resonant 1λ',
    'sloping-v': 'Set total length to 2λ (1λ per leg)',
  };

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
      </select>

      <label htmlFor="dipole-length" style={{ marginTop: 10 }}>Length ({unit})</label>
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
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setVAngle(val);
            }}
          />
        </>
      )}

      {(antennaType === 'sloping-v' || antennaType === 'delta-loop') && (
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
              title="Remove termination (unterminated antenna)"
              style={{ flex: '0 0 auto' }}
            >
              Off
            </button>
          </div>
          <div id="terminating-resistor-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {terminatingResistor === 0
              ? 'Unterminated: travelling wave reflects, creating a standing-wave pattern.'
              : antennaType === 'sloping-v'
                ? `${terminatingResistor} Ω resistors at each tip (to ground). Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`
                : `${terminatingResistor} Ω load at the base centre. Affects gain, directivity, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`}
          </div>
        </>
      )}

      <GeometryStatus />

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
    </section>
  );
}

function GeometryStatus() {
  const antennaType = useAntennaStore((s) => s.antennaType);
  const length = useAntennaStore((s) => s.length);
  const height = useAntennaStore((s) => s.height);
  const vAngle = useAntennaStore((s) => s.vAngle);
  const units = useAntennaStore((s) => s.units);

  if (antennaType !== 'sloping-v' && antennaType !== 'inverted-v') return null;

  const unit = displayLengthUnit(units);

  if (antennaType === 'sloping-v') {
    // Sloping V: tips always at the ground floor; slope is fully determined
    // by mast height and leg length.
    const legLen = Math.max(0.01, (length - FEED_BRIDGE_LENGTH_M) / 2);
    const sinSlope = Math.max(0, height - SLOPING_V_MIN_TIP_Z_M) / legLen;
    const slopeRad = Math.asin(Math.max(0, Math.min(1, sinSlope)));
    const slopeDeg = (slopeRad * 180) / Math.PI;
    const tipZ = height - legLen * Math.sin(slopeRad);

    return (
      <div style={{
        marginTop: 12,
        padding: '8px 10px',
        fontSize: 12,
        borderRadius: 4,
        background: 'var(--bg-accent)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Geometry</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Slope angle:</span>
          <span>{slopeDeg.toFixed(1)}°</span>
          <span style={{ color: 'var(--text-muted)' }}>Tip height:</span>
          <span>{toDisplayLength(tipZ, units).toFixed(2)} {unit}</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, fontStyle: 'italic', lineHeight: 1.3, color: 'var(--text-muted)' }}>
          Slope auto-snaps so tips sit at the ground floor for the current mast height and leg length.
        </div>
      </div>
    );
  }

  // Inverted V: slope is derived from vAngle and may be clamped by mast height.
  const half = length / 2;
  const maxSin = half > 0 ? (height - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const maxSlopeDeg = (maxSlopeRad * 180) / Math.PI;

  const requestedSlopeDeg = (180 - vAngle) / 2;
  const effectiveSlopeDeg = Math.min(requestedSlopeDeg, maxSlopeDeg);
  const effectiveSlopeRad = (effectiveSlopeDeg * Math.PI) / 180;
  const tipZ = height - half * Math.sin(effectiveSlopeRad);
  const isClamped = requestedSlopeDeg > maxSlopeDeg + 0.1;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginTop: 12,
        padding: '8px 10px',
        fontSize: 12,
        borderRadius: 4,
        background: isClamped ? 'rgba(255, 107, 107, 0.1)' : 'var(--bg-accent)',
        border: `1px solid ${isClamped ? '#ff6b6b' : 'var(--border)'}`,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4, color: isClamped ? '#ff6b6b' : 'inherit' }}>
        {isClamped ? '⚠️ Geometry Clamped' : 'Geometry Status'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Max slope:</span>
        <span>{maxSlopeDeg.toFixed(1)}°</span>

        <span style={{ color: 'var(--text-muted)' }}>Effective slope:</span>
        <span style={{ color: isClamped ? '#ff6b6b' : 'inherit', fontWeight: isClamped ? 600 : 400 }}>
          {effectiveSlopeDeg.toFixed(1)}°
        </span>

        <span style={{ color: 'var(--text-muted)' }}>Tip height:</span>
        <span>{toDisplayLength(tipZ, units).toFixed(2)} {unit}</span>
      </div>
      {isClamped && (
        <div style={{ marginTop: 6, fontSize: 11, fontStyle: 'italic', lineHeight: 1.3 }}>
          Slope reduced to keep tips at least {toDisplayLength(SLOPING_V_MIN_TIP_Z_M, units).toFixed(2)} {unit} above ground.
        </div>
      )}
    </div>
  );
}
