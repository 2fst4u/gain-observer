import { useState } from 'react';
import {
  toDisplayLength,
  fromDisplayLength,
} from '../../../physics/units';

export interface SyncedLengthInputProps {
  id: string;
  label: React.ReactNode;
  value: number;
  units: 'metric' | 'imperial';
  maxMetric: number;
  maxImperial: number;
  onChange: (val: number) => void;
  ariaDescribedBy?: string;
}

export function SyncedLengthInput({
  id,
  label,
  value,
  units,
  maxMetric,
  maxImperial,
  onChange,
  ariaDescribedBy,
}: SyncedLengthInputProps) {
  const dispVal = toDisplayLength(value, units);
  const [localVal, setLocalVal] = useState(dispVal.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);
  const [prevDispVal, setPrevDispVal] = useState(dispVal);

  if (dispVal !== prevDispVal) {
    setPrevDispVal(dispVal);
    if (!isFocused) {
      setLocalVal(dispVal.toFixed(2));
    }
  }

  return (
    <>
      <label htmlFor={id} style={{ marginTop: 10 }}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={units === 'metric' ? maxMetric : maxImperial}
        step={units === 'metric' ? 0.5 : 1}
        value={localVal}
        aria-describedby={ariaDescribedBy}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => {
          const s = e.target.value;
          setLocalVal(s);
          const val = parseFloat(s);
          if (isNaN(val)) return;
          onChange(fromDisplayLength(val, units));
        }}
        onBlur={() => {
          setIsFocused(false);
          setLocalVal(dispVal.toFixed(2));
        }}
      />
    </>
  );
}
