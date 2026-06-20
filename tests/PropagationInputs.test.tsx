import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { hourToHHmm, HHmmToHour, PropagationInputs } from '../src/components/Panel/Propagation/PropagationInputs';
import { useAntennaStore } from '../src/store/antennaStore';

import { useGeolocation } from '../src/hooks/useGeolocation';

// Mock useGeolocation
vi.mock('../src/hooks/useGeolocation', () => {
  return {
    useGeolocation: vi.fn(),
  };
});

describe('PropagationInputs UI component', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      tIndex: 50,
      latitudeDeg: null,
      monthOverride: null,
      utcHourOverride: null,
    });
    vi.mocked(useGeolocation).mockReturnValue({
      status: 'idle',
      requestLocation: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('handles T-index input focus, change, and blur', () => {
    render(<PropagationInputs />);
    const tIndexInput = screen.getByLabelText('Ionospheric T-index') as HTMLInputElement;

    fireEvent.focus(tIndexInput);
    fireEvent.change(tIndexInput, { target: { value: '100' } });

    expect(tIndexInput.value).toBe('100');
    expect(useAntennaStore.getState().tIndex).toBe(100);

    // Test invalid input
    fireEvent.change(tIndexInput, { target: { value: '' } }); // number input type rejects non-numbers, rendering as empty string
    expect(tIndexInput.value).toBe('');
    expect(useAntennaStore.getState().tIndex).toBe(100); // Should not update state with invalid number

    fireEvent.blur(tIndexInput);
    expect(tIndexInput.value).toBe('100'); // Resets to store value
  });

  it('handles Latitude input focus, change, and blur', () => {
    render(<PropagationInputs />);
    const latInput = screen.getByLabelText('Latitude in degrees') as HTMLInputElement;

    fireEvent.focus(latInput);
    fireEvent.change(latInput, { target: { value: '45.5' } });

    expect(latInput.value).toBe('45.5');
    expect(useAntennaStore.getState().latitudeDeg).toBe(45.5);

    // Test empty input (invalid number parsing to NaN sets it to null)
    fireEvent.change(latInput, { target: { value: '' } });
    expect(latInput.value).toBe('');
    expect(useAntennaStore.getState().latitudeDeg).toBe(null);

    // Simulate change in store
    useAntennaStore.setState({ latitudeDeg: 12.3 });
    // Since input is focused, local state should NOT update to store state immediately
    expect(latInput.value).toBe('');

    fireEvent.blur(latInput);
    // After blur, it syncs to store state
    expect(latInput.value).toBe('12.3');
  });

  it('handles "Use my location" button click', () => {
    const mockRequestLocation = vi.fn();
    vi.mocked(useGeolocation).mockReturnValue({
      status: 'idle',
      requestLocation: mockRequestLocation,
    });

    render(<PropagationInputs />);
    const button = screen.getByRole('button', { name: /Use my location/i });

    fireEvent.click(button);

    expect(mockRequestLocation).toHaveBeenCalled();
  });

  it('handles Month select change', () => {
    render(<PropagationInputs />);
    const monthSelect = screen.getByLabelText('Month override') as HTMLSelectElement;

    fireEvent.change(monthSelect, { target: { value: '1' } });
    expect(useAntennaStore.getState().monthOverride).toBe(1);

    fireEvent.change(monthSelect, { target: { value: '' } });
    expect(useAntennaStore.getState().monthOverride).toBe(null);
  });

  it('handles UTC Hour input focus, change, and blur', () => {
    render(<PropagationInputs />);
    const utcHourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;

    fireEvent.focus(utcHourInput);
    fireEvent.change(utcHourInput, { target: { value: '12:30' } });

    expect(utcHourInput.value).toBe('12:30');
    expect(useAntennaStore.getState().utcHourOverride).toBe(12.5);

    // Test invalid input
    fireEvent.change(utcHourInput, { target: { value: 'invalid' } });
    expect(utcHourInput.value).toBe('invalid');
    expect(useAntennaStore.getState().utcHourOverride).toBe(12.5); // Should not update state with invalid time

    fireEvent.blur(utcHourInput);
    expect(utcHourInput.value).toBe('12:30'); // Resets to format of store value

    // Update store to trigger re-render
    useAntennaStore.setState({ utcHourOverride: 14.75 });

    // Test that the local buffer correctly takes the value from the store when not focused
    // After re-rendering with new state, it should be 14:45
    // But testing that purely from outside React in Vitest doesn't always synchronously rerender.
    // We can manually trigger a re-render using testing-library to be safe:
    cleanup();
    render(<PropagationInputs />);
    const newUtcHourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;
    expect(newUtcHourInput.value).toBe('14:45');
  });

  it('handles "Auto" button for UTC Hour', () => {
    useAntennaStore.setState({ utcHourOverride: 12.5 });
    render(<PropagationInputs />);

    const button = screen.getByRole('button', { name: 'Auto' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    expect(useAntennaStore.getState().utcHourOverride).toBe(null);
    expect(button.disabled).toBe(true);
  });

  it('renders geoStatus messages correctly', () => {
    const { rerender } = render(<PropagationInputs />);

    // Idle state, no location
    expect(screen.getByText(/Defaults to 0° \(equator\) until set/)).toBeDefined();

    // Idle state, manual location
    useAntennaStore.setState({ latitudeDeg: 10 });
    rerender(<PropagationInputs />);
    expect(screen.getByText(/Manual entry. Click "Use my location" to replace from the browser/)).toBeDefined();

    // Requesting
    vi.mocked(useGeolocation).mockReturnValue({ status: 'requesting', requestLocation: vi.fn() });
    rerender(<PropagationInputs />);
    expect(screen.getByText(/Asking the browser for your location/)).toBeDefined();

    // Granted
    vi.mocked(useGeolocation).mockReturnValue({ status: 'granted', requestLocation: vi.fn() });
    rerender(<PropagationInputs />);
    expect(screen.getByText(/Location obtained from the browser/)).toBeDefined();

    // Denied
    vi.mocked(useGeolocation).mockReturnValue({ status: 'denied', requestLocation: vi.fn() });
    rerender(<PropagationInputs />);
    expect(screen.getByText(/Permission denied/)).toBeDefined();

    // Unsupported
    vi.mocked(useGeolocation).mockReturnValue({ status: 'unsupported', requestLocation: vi.fn() });
    rerender(<PropagationInputs />);
    expect(screen.getByText(/Browser geolocation is unavailable/)).toBeDefined();

    // Error
    vi.mocked(useGeolocation).mockReturnValue({ status: 'error', requestLocation: vi.fn() });
    rerender(<PropagationInputs />);
    expect(screen.getByText(/Could not obtain location/)).toBeDefined();
  });

  it('renders initial state correctly', () => {
    render(<PropagationInputs />);

    const tIndexInput = screen.getByLabelText('Ionospheric T-index') as HTMLInputElement;
    expect(tIndexInput.value).toBe('50');

    const latInput = screen.getByLabelText('Latitude in degrees') as HTMLInputElement;
    expect(latInput.value).toBe('');

    const monthSelect = screen.getByLabelText('Month override') as HTMLSelectElement;
    expect(monthSelect.value).toBe('');

    const utcHourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;
    expect(utcHourInput.value).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('PropagationInputs time parsers', () => {
  describe('hourToHHmm', () => {
    it('converts integer hours correctly', () => {
      expect(hourToHHmm(0)).toBe('00:00');
      expect(hourToHHmm(12)).toBe('12:00');
      expect(hourToHHmm(23)).toBe('23:00');
    });

    it('converts fractional hours to minutes correctly', () => {
      expect(hourToHHmm(1.5)).toBe('01:30');
      expect(hourToHHmm(14.25)).toBe('14:15');
      expect(hourToHHmm(9.75)).toBe('09:45');
      expect(hourToHHmm(10.1)).toBe('10:06');
    });

    it('rounds minutes correctly', () => {
      // 10.333... hours is 10 hours and 20 minutes
      expect(hourToHHmm(10.333333333333334)).toBe('10:20');
      // 10.123 hours is 10 hours and 7.38 minutes -> 10:07
      expect(hourToHHmm(10.123)).toBe('10:07');
    });
  });

  describe('HHmmToHour', () => {
    it('converts valid HH:mm strings to fractional hours', () => {
      expect(HHmmToHour('00:00')).toBe(0);
      expect(HHmmToHour('12:00')).toBe(12);
      expect(HHmmToHour('23:00')).toBe(23);
      expect(HHmmToHour('01:30')).toBe(1.5);
      expect(HHmmToHour('14:15')).toBe(14.25);
      expect(HHmmToHour('09:45')).toBe(9.75);
    });

    it('converts valid HHmm strings (without colon) to fractional hours', () => {
      expect(HHmmToHour('0000')).toBe(0);
      expect(HHmmToHour('1200')).toBe(12);
      expect(HHmmToHour('2300')).toBe(23);
      expect(HHmmToHour('0130')).toBe(1.5);
      expect(HHmmToHour('1415')).toBe(14.25);
      expect(HHmmToHour('0945')).toBe(9.75);
    });

    it('handles extra characters by stripping them out', () => {
      // '12:30 PM' will have non-digits stripped to '1230', which converts to 12.5
      expect(HHmmToHour('12:30 PM')).toBe(12.5);
      expect(HHmmToHour('  09:45  ')).toBe(9.75);
      expect(HHmmToHour('a01b30c')).toBe(1.5);
    });

    it('returns null for invalid lengths', () => {
      expect(HHmmToHour('1')).toBe(null);
      expect(HHmmToHour('12')).toBe(null);
      expect(HHmmToHour('123')).toBe(null);
      expect(HHmmToHour('12345')).toBe(null);
    });

    it('returns null for out-of-bounds hours or minutes', () => {
      expect(HHmmToHour('24:00')).toBe(null); // h=24 is invalid
      expect(HHmmToHour('25:00')).toBe(null);
      expect(HHmmToHour('12:60')).toBe(null); // m=60 is invalid
      expect(HHmmToHour('12:61')).toBe(null);
      expect(HHmmToHour('-1:00')).toBe(null); // -1 becomes 100 which is length 3, fails
    });
  });
});
