import { useState, type InputHTMLAttributes } from 'react';

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

export function NumericInput({ value, onChange, formatValue, ...props }: NumericInputProps) {
  const format = formatValue ?? ((v: number) => v.toString());

  const [localValue, setLocalValue] = useState(format(value));
  const [isFocused, setIsFocused] = useState(false);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!isFocused) {
      setLocalValue(format(value));
    }
  }

  return (
    <input
      type="number"
      value={localValue}
      onFocus={(e) => {
        setIsFocused(true);
        props.onFocus?.(e);
      }}
      onChange={(e) => {
        const s = e.target.value;
        setLocalValue(s);
        const val = parseFloat(s);
        if (isNaN(val)) return;
        onChange(val);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        setLocalValue(format(value));
        props.onBlur?.(e);
      }}
      {...props}
    />
  );
}
