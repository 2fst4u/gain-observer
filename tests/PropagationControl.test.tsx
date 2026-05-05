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

interface MockPropagationState {
  frequency: number;
  tIndex: number;
  setTIndex: (v: number) => void;
  latitudeDeg: number | null;
  longitudeDeg: number | null;
  setLatitude: (v: number | null) => void;
  monthOverride: number | null;
  utcHourOverride: number | null;
  setMonthOverride: (v: number | null) => void;
  setUtcHourOverride: (v: number | null) => void;
  result: unknown | null;
  units: 'metric' | 'imperial';
}

describe('PropagationControl - T-index Input Bug', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('allows clearing the T-index input (via local buffer)', () => {
    const setTIndex = vi.fn();
    let currentTIndex = 30;

    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockPropagationState) => unknown) => {
      const state: MockPropagationState = {
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

    const { getByLabelText } = render(<PropagationControl />);
    const tInput = getByLabelText('Ionospheric T-index') as HTMLInputElement;

    expect(tInput.value).toBe('30');

    // Focus and clear
    fireEvent.focus(tInput);
    fireEvent.change(tInput, { target: { value: '' } });

    expect(tInput.value).toBe('');

    // Store should not have been updated with NaN
    expect(setTIndex).not.toHaveBeenCalledWith(NaN);

    // On blur, it should snap back to the store value
    fireEvent.blur(tInput);
    expect(tInput.value).toBe('30');
  });

  it('syncs local buffer with store when store changes externally (and not focused)', () => {
    const setTIndex = vi.fn();
    let currentTIndex = 30;

    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockPropagationState) => unknown) => {
      const state: MockPropagationState = {
        frequency: 7.1,
        tIndex: currentTIndex,
        setTIndex,
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

    const { getByLabelText, rerender } = render(<PropagationControl />);
    const tInput = getByLabelText('Ionospheric T-index') as HTMLInputElement;
    expect(tInput.value).toBe('30');

    // Simulate external store update
    currentTIndex = 45;
    rerender(<PropagationControl />);

    expect(tInput.value).toBe('45');
  });
});
