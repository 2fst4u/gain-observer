import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { NumericInput } from '../src/components/UI/NumericInput';

function TestWrapper({ initialValue = 10, formatValue }: { initialValue?: number; formatValue?: (v: number) => string }) {
  const [val, setVal] = useState(initialValue);
  return (
    <NumericInput
      value={val}
      onChange={setVal}
      formatValue={formatValue}
      aria-label="numeric input"
    />
  );
}

describe('NumericInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders default formatted value to string', () => {
    render(<NumericInput value={42} onChange={vi.fn()} aria-label="numeric input" />);
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('42');
  });

  it('uses formatValue prop when provided', () => {
    render(
      <NumericInput
        value={10.5}
        onChange={vi.fn()}
        formatValue={(v) => v.toFixed(2)}
        aria-label="numeric input"
      />
    );
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;
    expect(input.value).toBe('10.50');
  });

  it('passes HTML input attributes to the input element', () => {
    render(
      <NumericInput
        value={5}
        onChange={vi.fn()}
        min={0}
        max={10}
        step={0.5}
        className="custom-class"
        aria-label="numeric input"
      />
    );
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;
    expect(input.min).toBe('0');
    expect(input.max).toBe('10');
    expect(input.step).toBe('0.5');
    expect(input.className).toBe('custom-class');
  });

  it('calls onChange with parsed number on valid input change', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={0} onChange={handleChange} aria-label="numeric input" />);
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '14.2' } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(14.2);
    expect(input.value).toBe('14.2');
  });

  it('does not call onChange when input value is invalid or empty (NaN)', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={10} onChange={handleChange} aria-label="numeric input" />);
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });

    expect(handleChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('handles focus and calls onFocus prop if provided', () => {
    const handleFocus = vi.fn();
    render(
      <NumericInput
        value={10}
        onChange={vi.fn()}
        onFocus={handleFocus}
        aria-label="numeric input"
      />
    );
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;

    fireEvent.focus(input);

    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('formats value on blur when used with state wrapper', () => {
    render(<TestWrapper initialValue={10} formatValue={(v) => v.toFixed(2)} />);
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25.5' } });
    expect(input.value).toBe('25.5');

    fireEvent.blur(input);

    expect(input.value).toBe('25.50');
  });

  it('resets local value to formatted value on blur and calls onBlur prop', () => {
    const handleBlur = vi.fn();
    render(
      <NumericInput
        value={10}
        onChange={vi.fn()}
        formatValue={(v) => v.toFixed(2)}
        onBlur={handleBlur}
        aria-label="numeric input"
      />
    );
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;

    fireEvent.focus(input);
    act(() => {
      fireEvent.blur(input);
    });

    expect(handleBlur).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('10.00');
  });

  it('updates local value from value prop changes when not focused', () => {
    const { rerender } = render(
      <NumericInput value={10} onChange={vi.fn()} aria-label="numeric input" />
    );
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;
    expect(input.value).toBe('10');

    rerender(<NumericInput value={25} onChange={vi.fn()} aria-label="numeric input" />);

    expect(input.value).toBe('25');
  });

  it('does not overwrite local value from value prop changes when focused', () => {
    const { rerender } = render(
      <NumericInput value={10} onChange={vi.fn()} aria-label="numeric input" />
    );
    const input = screen.getByLabelText('numeric input') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '15' } });

    // Parent re-renders with new value prop while input is still focused
    rerender(<NumericInput value={15} onChange={vi.fn()} aria-label="numeric input" />);

    expect(input.value).toBe('15');

    // Also test when parent passes a different prop value while still focused
    rerender(<NumericInput value={30} onChange={vi.fn()} aria-label="numeric input" />);

    expect(input.value).toBe('15');
  });
});
