import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SyncedLengthInput } from '../src/components/Panel/Feedline/SyncedLengthInput';

describe('SyncedLengthInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly with metric units', () => {
    render(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={10.5} // meters
        units="metric"
        maxMetric={100}
        maxImperial={300}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Test Length') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.value).toBe('10.50');
    expect(input.max).toBe('100');
    expect(input.step).toBe('0.5');
  });

  it('renders correctly with imperial units', () => {
    render(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={10.5} // meters
        units="imperial"
        maxMetric={100}
        maxImperial={300}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Test Length') as HTMLInputElement;
    // 10.5 meters = 10.5 / 0.3048 = 34.4488...
    expect(input.max).toBe('300');
    expect(input.step).toBe('1');
    expect(parseFloat(input.value)).toBeCloseTo(34.45);
  });

  it('calls onChange with correctly converted value when changed', () => {
    const handleChange = vi.fn();
    render(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={10.5}
        units="imperial"
        maxMetric={100}
        maxImperial={300}
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('Test Length') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });

    // 50 feet = 50 * 0.3048 = 15.24 meters
    expect(handleChange).toHaveBeenCalledWith(15.24);
  });

  it('does not update displayed value from props if input is focused', () => {
    const { rerender } = render(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={10.5}
        units="metric"
        maxMetric={100}
        maxImperial={300}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Test Length') as HTMLInputElement;
    expect(input.value).toBe('10.50');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '20' } });

    // Parent re-renders with new value because of onChange
    rerender(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={20}
        units="metric"
        maxMetric={100}
        maxImperial={300}
        onChange={vi.fn()}
      />
    );

    // The input value should remain what the user typed since it's focused
    expect(input.value).toBe('20');
  });

  it('updates local value from props if input is NOT focused', () => {
    const { rerender } = render(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={10.5}
        units="metric"
        maxMetric={100}
        maxImperial={300}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Test Length') as HTMLInputElement;
    expect(input.value).toBe('10.50');

    // Parent updates value externally
    rerender(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={30}
        units="metric"
        maxMetric={100}
        maxImperial={300}
        onChange={vi.fn()}
      />
    );

    // Input should reflect the new value
    expect(input.value).toBe('30.00');
  });

  it('formats value to 2 decimal places on blur', () => {
    render(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={10.5}
        units="metric"
        maxMetric={100}
        maxImperial={300}
        onChange={vi.fn()}
      />
    );

    const input = screen.getByLabelText('Test Length') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '20.1234' } });

    expect(input.value).toBe('20.1234');

    fireEvent.blur(input);

    // On blur, it should format the original passed-in prop value (which is still 10.5 since we didn't rerender here,
    // wait - actually in real life parent rerenders. But in this isolated test, `dispVal` is from `value=10.5`,
    // so on blur it resets to `dispVal.toFixed(2)` = 10.50).
    // Let's actually test that it resets correctly based on the prop value.
    expect(input.value).toBe('10.50');
  });

  it('ignores invalid number input', () => {
    const handleChange = vi.fn();
    render(
      <SyncedLengthInput
        id="test-input"
        label="Test Length"
        value={10.5}
        units="metric"
        maxMetric={100}
        maxImperial={300}
        onChange={handleChange}
      />
    );

    const input = screen.getByLabelText('Test Length') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    expect(handleChange).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });
});
