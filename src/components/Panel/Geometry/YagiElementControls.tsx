import { NumericInput } from '../../UI/NumericInput';
import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { toDisplayLength, fromDisplayLength, displayLengthUnit } from '../../../physics/units';
import { YAGI_DIRECTOR_RATIO, YAGI_REFLECTOR_RATIO, yagiDimensions } from '../../../physics/constants';

/**
 * Reflector and director lengths for the wire Yagi. Each is stored as a ratio
 * of the driven element, so editing the driven length still rescales the whole
 * array while these edits change the parasitic elements on their own.
 */
export function YagiElementControls() {
  const {
    antennaType, units, length, reflectorRatio, directorRatio,
    setYagiReflectorLength, setYagiDirectorLength, resetYagiElements,
  } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    units: s.units,
    length: s.length,
    reflectorRatio: s.yagiReflectorRatio,
    directorRatio: s.yagiDirectorRatio,
    setYagiReflectorLength: s.setYagiReflectorLength,
    setYagiDirectorLength: s.setYagiDirectorLength,
    resetYagiElements: s.resetYagiElements,
  })));
  if (antennaType !== 'yagi') return null;

  const unit = displayLengthUnit(units);
  const d = yagiDimensions(length, reflectorRatio, directorRatio);
  const isDesign = Math.abs(reflectorRatio - YAGI_REFLECTOR_RATIO) < 1e-9
    && Math.abs(directorRatio - YAGI_DIRECTOR_RATIO) < 1e-9;
  const pct = (ratio: number, design: number) => {
    const p = (ratio / design - 1) * 100;
    return Math.abs(p) < 0.05 ? 'design' : `${p > 0 ? '+' : ''}${p.toFixed(1)}% vs design`;
  };

  return (
    <>
      <label htmlFor="yagi-reflector-length" style={{ marginTop: 10 }}>
        Reflector length ({unit}) — ×{reflectorRatio.toFixed(3)} driven, {pct(reflectorRatio, YAGI_REFLECTOR_RATIO)}
      </label>
      <NumericInput
        id="yagi-reflector-length"
        min={0.1}
        step={0.05}
        value={toDisplayLength(d.reflectorM, units)}
        onChange={(v) => setYagiReflectorLength(fromDisplayLength(v, units))}
        formatValue={(v) => v.toFixed(2)}
      />
      <label htmlFor="yagi-director-length" style={{ marginTop: 10 }}>
        Director length ({unit}) — ×{directorRatio.toFixed(3)} driven, {pct(directorRatio, YAGI_DIRECTOR_RATIO)}
      </label>
      <div className="row">
        <NumericInput
          id="yagi-director-length"
          min={0.1}
          step={0.05}
          value={toDisplayLength(d.directorM, units)}
          onChange={(v) => setYagiDirectorLength(fromDisplayLength(v, units))}
          formatValue={(v) => v.toFixed(2)}
        />
        <button
          onClick={resetYagiElements}
          disabled={isDesign}
          title={`Restore the optimised reflector (×${YAGI_REFLECTOR_RATIO}) and director (×${YAGI_DIRECTOR_RATIO}) lengths`}
        >
          Reset
        </button>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Kept as ratios of the driven element, so they rescale with it. A long director or a
        short reflector collapses front/back and raises SWR; the opposite errors are mild.
        Use Compare to view a modified array against the design.
      </div>
    </>
  );
}
