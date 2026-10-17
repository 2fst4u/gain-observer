import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../../physics/units';
import { FOLDED_DIPOLE_MAX_APERTURE_M } from '../../../physics/constants';
import { calculateTfdZ0 } from './geometryUtils';

export function ApertureControl() {
  const { units, antennaType, foldedDipoleAperture, wireRadius, setFoldedDipoleAperture } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    antennaType: s.antennaType,
    foldedDipoleAperture: s.foldedDipoleAperture,
    wireRadius: s.wireRadius,
    setFoldedDipoleAperture: s.setFoldedDipoleAperture,
  })));

  if (antennaType !== 'folded-dipole') {
    return null;
  }

  const unit = displayLengthUnit(units);
  const dispAperture = toDisplayLength(foldedDipoleAperture, units);
  const minApertureDisp = toDisplayLength(0.02, units);
  const maxApertureDisp = toDisplayLength(FOLDED_DIPOLE_MAX_APERTURE_M, units);
  const tfdZ0 = calculateTfdZ0(foldedDipoleAperture, wireRadius);

  return (
    <>
      <label htmlFor="folded-dipole-aperture" style={{ marginTop: 10 }}>
        Conductor spacing / aperture ({unit}) — {dispAperture.toFixed(2)}
      </label>
      <input
        id="folded-dipole-aperture"
        type="range"
        min={minApertureDisp}
        max={maxApertureDisp}
        step={units === 'metric' ? 0.01 : 0.05}
        value={dispAperture}
        aria-label="Folded dipole conductor spacing"
        aria-valuetext={`${dispAperture.toFixed(2)} ${unit}`}
        aria-describedby="folded-dipole-aperture-hint"
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val)) return;
          setFoldedDipoleAperture(fromDisplayLength(val, units));
        }}
      />
      <div id="folded-dipole-aperture-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Vertical spacing between the bottom (fed) and top (un-fed) conductors. The fed conductor is at the antenna height; the top conductor is aperture above it. For equal-diameter wires the feedpoint stays ~4× a plain dipole (~300 Ω) regardless of spacing; wider spacing raises Z₀ of the two-wire line (currently Z₀ ≈ {tfdZ0} Ω), requiring a higher terminating resistor for a broadband T2FD match. Capped at {maxApertureDisp.toFixed(2)} {unit} — beyond a realistic folded-dipole spacing the structure morphs toward a loop and no longer solves reliably as two close parallel wires.
      </div>
    </>
  );
}
