import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PropagationControl } from '../src/components/Panel/PropagationControl';
import { mockAntennaStore, type MockAntennaState } from './helpers/mockStore';

// Mock the store
vi.mock('../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

// Mock PropagationRadar since it might involve complex rendering
vi.mock('../src/components/Charts/PropagationRadar', () => ({
  PropagationRadar: () => <div data-testid="propagation-radar" />,
}));

type MockState = MockAntennaState;

describe('PropagationControl - time override visibility', () => {
  const mockSetMonthOverride = vi.fn();
  const mockSetUtcHourOverride = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const setupMockStore = (overrides: Partial<MockState> = {}) => {
    mockAntennaStore({
        frequency: 7.1,
        tIndex: 30,
        latitudeDeg: null,
        longitudeDeg: null,
        monthOverride: null,
        utcHourOverride: null,
        units: 'metric',
        result: null,
        setTIndex: vi.fn(),
        setLatitude: vi.fn(),
        setMonthOverride: mockSetMonthOverride,
        setUtcHourOverride: mockSetUtcHourOverride,
        geolocationStatus: 'idle',
        ...overrides,
      });
  };

  it('renders Month and UTC Hour inputs by default', () => {
    setupMockStore();
    render(<PropagationControl />);

    expect(screen.getByLabelText('Month override')).toBeDefined();
    expect(screen.getByLabelText('UTC hour override')).toBeDefined();
  });

  it('updates month override when select changes', () => {
    setupMockStore();
    render(<PropagationControl />);

    const monthSelect = screen.getByLabelText('Month override') as HTMLSelectElement;
    fireEvent.change(monthSelect, { target: { value: '5' } });

    expect(mockSetMonthOverride).toHaveBeenCalledWith(5);
  });

  it('updates UTC hour override when input changes to HH:mm format', () => {
    setupMockStore();
    render(<PropagationControl />);

    const hourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;
    fireEvent.change(hourInput, { target: { value: '14:30' } });

    expect(mockSetUtcHourOverride).toHaveBeenCalledWith(14.5);
  });

  it('updates UTC hour override when input changes to HHmm format (no colon)', () => {
    setupMockStore();
    render(<PropagationControl />);

    const hourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;
    fireEvent.change(hourInput, { target: { value: '1430' } });

    expect(mockSetUtcHourOverride).toHaveBeenCalledWith(14.5);
  });

  it('ignores invalid HH:mm inputs', () => {
    setupMockStore();
    render(<PropagationControl />);

    const hourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;

    // Incomplete
    fireEvent.change(hourInput, { target: { value: '14' } });
    expect(mockSetUtcHourOverride).not.toHaveBeenCalled();

    // Invalid minutes
    fireEvent.change(hourInput, { target: { value: '14:60' } });
    expect(mockSetUtcHourOverride).not.toHaveBeenCalled();

    // Invalid hours
    fireEvent.change(hourInput, { target: { value: '24:00' } });
    expect(mockSetUtcHourOverride).not.toHaveBeenCalled();
  });

  it('snaps back to formatted store value on blur', () => {
    setupMockStore({ utcHourOverride: 22.5 });
    render(<PropagationControl />);

    const hourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;
    expect(hourInput.value).toBe('22:30');

    fireEvent.focus(hourInput);
    fireEvent.change(hourInput, { target: { value: '12' } });
    expect(hourInput.value).toBe('12');

    fireEvent.blur(hourInput);
    expect(hourInput.value).toBe('22:30');
  });

  it('resets UTC hour override when Auto button is clicked', () => {
    setupMockStore({ utcHourOverride: 10 });
    render(<PropagationControl />);

    const autoButton = screen.getByRole('button', { name: 'Reset to Auto (current UTC time)' });
    fireEvent.click(autoButton);

    expect(mockSetUtcHourOverride).toHaveBeenCalledWith(null);
  });

  it('disables Auto button when no UTC hour override is set', () => {
    setupMockStore({ utcHourOverride: null });
    render(<PropagationControl />);

    const autoButton = screen.getByRole('button', { name: 'Reset to Auto (current UTC time)' }) as HTMLButtonElement;
    expect(autoButton.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('PropagationControl - T-index Input Bug', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('allows clearing the T-index input (via local buffer)', () => {
    const setTIndex = vi.fn();
    let currentTIndex = 30;

    mockAntennaStore(() => ({
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
        geolocationStatus: 'idle',
      }));

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

    mockAntennaStore(() => ({
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
        geolocationStatus: 'idle',
      }));

    const { getByLabelText, rerender } = render(<PropagationControl />);
    const tInput = getByLabelText('Ionospheric T-index') as HTMLInputElement;
    expect(tInput.value).toBe('30');

    // Simulate external store update
    currentTIndex = 45;
    rerender(<PropagationControl />);

    expect(tInput.value).toBe('45');
  });
});
