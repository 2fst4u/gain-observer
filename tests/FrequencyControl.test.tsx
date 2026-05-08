import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { FrequencyControl } from '../src/components/Panel/FrequencyControl';
import { useAntennaStore } from '../src/store/antennaStore';
import { HF_BAND_PRESETS, halfWaveLength } from '../src/physics/constants';

describe('FrequencyControl', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      frequency: 14.150,
      length: halfWaveLength(14.150)
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with the current frequency', () => {
    render(<FrequencyControl />);
    const input = screen.getByLabelText('Frequency in MHz') as HTMLInputElement;
    expect(input.value).toBe('14.150');
  });

  it('updates local state on change but syncs with store on blur', () => {
    render(<FrequencyControl />);
    const input = screen.getByLabelText('Frequency in MHz') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '14.2' } });

    expect(useAntennaStore.getState().frequency).toBe(14.2);
    expect(input.value).toBe('14.2');

    fireEvent.blur(input);
    expect(input.value).toBe('14.200');
  });

  it('handles clicking a band preset', () => {
    render(<FrequencyControl />);

    // Find the button for a specific preset, e.g., '10m'
    const preset10m = HF_BAND_PRESETS.find(b => b.name === '10m')!;
    const bandButton = screen.getByText('10m');
    fireEvent.click(bandButton);

    expect(useAntennaStore.getState().frequency).toBe(preset10m.mhz);
    expect(useAntennaStore.getState().length).toBe(halfWaveLength(preset10m.mhz));
  });

  it('syncs localVal when store frequency changes externally', () => {
    const { rerender } = render(<FrequencyControl />);

    useAntennaStore.setState({ frequency: 28.5 });

    rerender(<FrequencyControl />);

    const input = screen.getByLabelText('Frequency in MHz') as HTMLInputElement;
    expect(input.value).toBe('28.500');
  });

  it('ignores invalid number input', () => {
    render(<FrequencyControl />);
    const input = screen.getByLabelText('Frequency in MHz') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });

    // Frequency should remain the original value 14.150
    expect(useAntennaStore.getState().frequency).toBe(14.150);
    expect(input.value).toBe('');

    fireEvent.blur(input);
    expect(input.value).toBe('14.150');
  });
});
