import { useState } from 'react';
import { useAntennaStore, type OrientationPreset } from '../../store/antennaStore';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';
import type { AntennaType } from '../../physics/types';
import { SLOPING_V_MIN_TIP_Z_M } from '../../physics/constants';

export function DipoleControl() {
  const units = useAntennaStore((s) => s.units);
  const antennaType = useAntennaStore((s) => s.antennaType);
  const length = useAntennaStore((s) => s.length);
  const height = useAntennaStore((s) => s.height);
  const orientation = useAntennaStore((s) => s.orientation);
  const vAngle = useAntennaStore((s) => s.vAngle);
  const slope = useAntennaStore((s) => s.slope);

  const setAntennaType = useAntennaStore((s) => s.setAntennaType);
  const setLength = useAntennaStore((s) => s.setLength);
  const setHalfWaveLength = useAntennaStore((s) => s.setHalfWaveLength);
  const setHeight = useAntennaStore((s) => s.setHeight);
  const setOrientation = useAntennaStore((s) => s.setOrientation);
  const setVAngle = useAntennaStore((s) => s.setVAngle);
  const setSlope = useAntennaStore((s) => s.setSlope);

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

  const resonateLabels: Record<import('../../physics/types').AntennaType, string> = {
    'dipole': '½λ',
    'inverted-v': '½λ',
    'delta-loop': '1λ',
    'sloping-v': '1λ/leg',
    'v-beam': '1λ/leg',
  };

  const resonateTitles: Record<import('../../physics/types').AntennaType, string> = {
    'dipole': 'Set length to resonant ½λ',
    'inverted-v': 'Set length to resonant ½λ',
    'delta-loop': 'Set perimeter to resonant 1λ',
    'sloping-v': 'Set total length to 2λ (1λ per leg)',
    'v-beam': 'Set total length to 2λ (1λ per leg)',
  };

  return (
    <div className="panel-section">
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
        <option value="v-beam">V-Beam</option>
        <option value="delta-loop">Delta Loop</option>
      </select>

      <div id="antenna-type-group" className="button-group" role="group" aria-label="Antenna type" style={{ marginBottom: 12 }}>
        <button
          className={antennaType === 'dipole' ? 'active' : ''}
          onClick={() => setAntennaType('dipole')}
          aria-pressed={antennaType === 'dipole'}
        >
          Dipole
        </button>
        <button
          className={antennaType === 'sloping-v' ? 'active' : ''}
          onClick={() => setAntennaType('sloping-v')}
          aria-pressed={antennaType === 'sloping-v'}
        >
          Sloping V
        </button>
      </div>

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
        <button
          onClick={setHalfWaveLength}
          title={resonateTitles[antennaType]}
          aria-label={`${resonateLabels[antennaType]} (Resonate antenna length)`}
        >
          {resonateLabels[antennaType]}
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

      {(antennaType === 'sloping-v' || antennaType === 'inverted-v') && (
        <>
          <label htmlFor="sloping-v-slope" style={{ marginTop: 10 }}>Slope angle (°) — {slope.toFixed(1)}°</label>
          <input
            id="sloping-v-slope"
            type="range"
            min={0}
            max={90}
            step={1}
            value={slope}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setSlope(val);
            }}
          />

          <label htmlFor="sloping-v-angle" style={{ marginTop: 10 }}>V opening angle (°) — {vAngle.toFixed(1)}°</label>
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
    </div>
  );
}

function GeometryStatus() {
  const antennaType = useAntennaStore((s) => s.antennaType);
  const length = useAntennaStore((s) => s.length);
  const height = useAntennaStore((s) => s.height);
  const requestedSlope = useAntennaStore((s) => s.slope);
  const vAngle = useAntennaStore((s) => s.vAngle);
  const units = useAntennaStore((s) => s.units);

  if (antennaType !== 'sloping-v' && antennaType !== 'inverted-v') return null;

  const half = length / 2;
  const isInvertedV = antennaType === 'inverted-v';

  // For Inverted V, slope is coupled to apex angle.
  const slopeDeg = isInvertedV ? (180 - vAngle) / 2 : requestedSlope;

  // Compute max allowable slope: h - half * sin(slope) >= SLOPING_V_MIN_TIP_Z_M
  const maxSin = half > 0 ? (height - SLOPING_V_MIN_TIP_Z_M) / half : 0;
  const maxSlopeRad = Math.asin(Math.max(0, Math.min(1, maxSin)));
  const maxSlopeDeg = (maxSlopeRad * 180) / Math.PI;

  const effectiveSlopeDeg = Math.min(slopeDeg, maxSlopeDeg);
  const effectiveSlopeRad = (effectiveSlopeDeg * Math.PI) / 180;
  const tipZ = height - half * Math.sin(effectiveSlopeRad);

  const isClamped = slopeDeg > maxSlopeDeg + 0.1;
  const unit = displayLengthUnit(units);

  return (
    <div style={{
      marginTop: 12,
      padding: '8px 10px',
      fontSize: 12,
      borderRadius: 4,
      background: isClamped ? 'rgba(255, 107, 107, 0.1)' : 'var(--bg-accent)',
      border: `1px solid ${isClamped ? '#ff6b6b' : 'var(--border)'}`,
    }}>
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
