import { useAntennaStore, MIN_REAL_GROUND_HEIGHT_M } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../../physics/units';

export function HeightControl() {
  const { units, antennaType, height, groundId, setHeight } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    antennaType: s.antennaType,
    height: s.height,
    groundId: s.groundId,
    setHeight: s.setHeight,
  })));

  const unit = displayLengthUnit(units);
  const dispHeight = toDisplayLength(height, units);
  const maxHeight = units === 'metric' ? 40 : 131;

  const isVerticalWhip = antennaType === 'vertical-whip';
  const isInvertedL = antennaType === 'inverted-l';
  const isFoldedDipole = antennaType === 'folded-dipole';

  const heightLabel = isVerticalWhip
    ? `Base height above ground (${unit}) — ${dispHeight.toFixed(1)}`
    : isInvertedL
      ? `Mast / bend-point height (${unit}) — ${dispHeight.toFixed(1)}`
      : isFoldedDipole
        ? `Bottom conductor height / feedpoint (${unit}) — ${dispHeight.toFixed(1)}`
        : `Height above ground (${unit}) — ${dispHeight.toFixed(1)}`;

  return (
    <>
      <label htmlFor="dipole-height" style={{ marginTop: 10 }}>{heightLabel}</label>
      <input
        id="dipole-height"
        type="range"
        min={0}
        max={maxHeight}
        step={units === 'metric' ? 0.5 : 1}
        value={dispHeight}
        aria-label={isVerticalWhip ? 'Base height above ground' : isInvertedL ? 'Mast / bend-point height' : isFoldedDipole ? 'Bottom conductor height / feedpoint' : 'Height above ground'}
        aria-valuetext={`${dispHeight.toFixed(1)} ${unit}`}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val)) return;
          setHeight(fromDisplayLength(val, units));
        }}
      />
      {(isVerticalWhip || isInvertedL) && groundId !== 'free' && groundId !== 'perfect' && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          Modelled base and radials are at least {toDisplayLength(MIN_REAL_GROUND_HEIGHT_M, units).toFixed(2)} {unit} above real soil. This is an elevated ground-system model.
        </div>
      )}
    </>
  );
}
