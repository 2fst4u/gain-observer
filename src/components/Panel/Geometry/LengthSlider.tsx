import type { UnitSystem } from '../../../physics/units';
import { toDisplayLength, fromDisplayLength, displayLengthUnit } from '../../../physics/units';

/**
 * Range slider for a wire length held in metres and shown in the user's units.
 * The range always contains the current value, so a length typed outside the
 * slider's usual span stays representable.
 */
export function LengthSlider({ id, label, valueM, minM, maxM, units, onChange }: {
  id: string;
  label: string;
  valueM: number;
  minM: number;
  maxM: number;
  units: UnitSystem;
  onChange: (meters: number) => void;
}) {
  const unit = displayLengthUnit(units);
  const step = units === 'metric' ? 0.01 : 0.05;
  const snap = (v: number, f: (x: number) => number) => f(v / step) * step;
  const value = toDisplayLength(valueM, units);
  const min = snap(Math.min(toDisplayLength(minM, units), value), Math.floor);
  const max = snap(Math.max(toDisplayLength(maxM, units), value), Math.ceil);
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      aria-valuetext={`${value.toFixed(2)} ${unit}`}
      style={{ marginTop: 4 }}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(fromDisplayLength(v, units));
      }}
    />
  );
}
