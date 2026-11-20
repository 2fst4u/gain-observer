import { NumericInput } from '../../UI/NumericInput';
import { useAntennaStore, type AntennaType } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../../physics/units';
import { resonateTitles } from './constants';
import { yagiDimensions } from '../../../physics/constants';

export function LengthControl() {
  const {
    units,
    antennaType,
    length,
    frequency,
    setLength,
    setHalfWaveLength,
  } = useAntennaStore(
    useShallow((s) => ({
      units: s.units,
      antennaType: s.antennaType,
      length: s.length,
      frequency: s.frequency,
      setLength: s.setLength,
      setHalfWaveLength: s.setHalfWaveLength,
    }))
  );

  const unit = displayLengthUnit(units);
  const dispLen = toDisplayLength(length, units);

  const lambda = 299.792458 / frequency;

  const resonateLabels: Record<AntennaType, string> = {
    'dipole': '½λ',
    'inverted-v': '½λ',
    'delta-loop': '1λ',
    'sloping-v': '1λ/leg',
    'terminated-delta': '1λ',
    'vertical-whip': '¼λ',
    'inverted-l': '¼λ',
    'folded-dipole': '½λ',
    'yagi': '½λ',
  };

  const isVerticalWhip = antennaType === 'vertical-whip';
  const isInvertedL = antennaType === 'inverted-l';
  const isFoldedDipole = antennaType === 'folded-dipole';
  const isYagi = antennaType === 'yagi';
  const yagi = isYagi ? yagiDimensions(length) : null;
  const fmt = (m: number) => `${toDisplayLength(m, units).toFixed(2)} ${unit}`;

  const lengthLabel = isVerticalWhip
    ? `Whip length (${unit})`
    : isInvertedL
      ? `Total wire length — vertical + horizontal (${unit})`
      : isFoldedDipole
        ? `Conductor length — ½λ each (${unit})`
        : isYagi
          ? `Driven element length (${unit})`
          : `Length (${unit})`;

  return (
    <>
      <label htmlFor="dipole-length" style={{ marginTop: 10 }}>{lengthLabel}</label>
      <div className="row">
        <NumericInput
          id="dipole-length"
          min={0.1}
          step={0.1}
          value={dispLen}
          onChange={(val) => setLength(fromDisplayLength(val, units))}
          formatValue={(v) => v.toFixed(2)}
        />
        {antennaType !== 'sloping-v' && (
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
      {yagi && (
        <div id="yagi-dimensions" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Reflector {fmt(yagi.reflectorM)} · director {fmt(yagi.directorM)}<br />
          Spacing {fmt(yagi.spacingM)} each side (boom {fmt(yagi.boomM)})<br />
          Lengths are for bare wire. Insulation makes wire electrically longer
          (typically 2–4%), so these lengths are slightly long for insulated wire:
          trim the driven element to resonance in place, then shorten the reflector
          and director by the same percentage.
        </div>
      )}
    </>
  );
}
