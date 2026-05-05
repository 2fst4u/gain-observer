import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { PropagationControl } from '../src/components/Panel/PropagationControl';
import { useAntennaStore } from '../src/store/antennaStore';

// Mock the store
vi.mock('../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

// Mock the radar component to avoid deep rendering issues
vi.mock('../src/components/Charts/PropagationRadar', () => ({
  PropagationRadar: () => <div data-testid="radar" />,
}));

describe('PropagationControl - T-index Input Bug', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('fails to allow clearing the T-index input when directly bound', () => {
    const setTIndex = vi.fn();
    let currentTIndex = 30;

    // We simulate the store behavior: when setTIndex is called, the component re-renders with the new value.
    // If the input is directly bound to `tIndex`, and `parseFloat('')` is NaN,
    // then `setTIndex` might not be called, and the input `value={tIndex}` will still show '30'.

    vi.mocked(useAntennaStore).mockImplementation((selector: any) => {
      const state = {
        frequency: 7.1,
        tIndex: currentTIndex,
        setTIndex: (v: number) => {
          currentTIndex = v;
          setTIndex(v);
        },
        latitudeDeg: null,
        longitudeDeg: null,
        setLatitude: vi.fn(),
        monthOverride: null,
        utcHourOverride: null,
        setMonthOverride: vi.fn(),
        setUtcHourOverride: vi.fn(),
        result: null,
        units: 'metric',
      };
      return selector(state);
    });

    const { rerender } = render(<PropagationControl />);
    const tInput = document.getElementById('t-index-input') as HTMLInputElement;

    expect(tInput.value).toBe('30');

    // Simulate user backspacing to clear the input
    fireEvent.change(tInput, { target: { value: '' } });

    // In the current broken implementation, if the input is value={tIndex},
    // and onChange does nothing for empty string (isNaN(v) is true),
    // then the input value remains '30' because of the value={tIndex} binding.
    // Wait, if fireEvent.change is called, does the DOM element value update before React re-render?
    // In a controlled component, it should stick to the prop value.

    // Actually, if it's value={tIndex}, and we do fireEvent.change(tInput, { target: { value: '' } }),
    // Now with the fix, it SHOULD be empty because we use a local buffer.
    fireEvent.focus(tInput);
    fireEvent.change(tInput, { target: { value: '' } });

    expect(tInput.value).toBe('');
  });

  it('allows clearing the T-index input with the local buffer pattern', () => {
    const setTIndex = vi.fn();
    let currentTIndex = 30;

    vi.mocked(useAntennaStore).mockImplementation((selector: any) => {
      const state = {
        frequency: 7.1,
        tIndex: currentTIndex,
        setTIndex: (v: number) => {
          currentTIndex = v;
          setTIndex(v);
        },
        latitudeDeg: null,
        longitudeDeg: null,
        setLatitude: vi.fn(),
        monthOverride: null,
        utcHourOverride: null,
        setMonthOverride: vi.fn(),
        setUtcHourOverride: vi.fn(),
        result: null,
        units: 'metric',
      };
      return selector(state);
    });

    render(<PropagationControl />);
    const tInput = document.getElementById('t-index-input') as HTMLInputElement;

    expect(tInput.value).toBe('30');

    // Focus first
    fireEvent.focus(tInput);
    // Simulate user backspacing to clear the input
    fireEvent.change(tInput, { target: { value: '' } });

    // Now it should be empty
    expect(tInput.value).toBe('');

    // Store should not have been updated with NaN
    expect(setTIndex).not.toHaveBeenCalledWith(NaN);

    // On blur, it should snap back to the store value
    fireEvent.blur(tInput);
    expect(tInput.value).toBe('30');
  });
});
