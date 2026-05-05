import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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

// Mock PropagationRadar since it might involve complex rendering
vi.mock('../src/components/Charts/PropagationRadar', () => ({
  PropagationRadar: () => <div data-testid="propagation-radar" />,
}));

interface MockState {
  frequency: number;
  tIndex: number;
  latitudeDeg: number | null;
  longitudeDeg: number | null;
  monthOverride: number | null;
  utcHourOverride: number | null;
  units: 'metric' | 'imperial';
  result: any;
  setTIndex: (v: number) => void;
  setLatitude: (v: number | null) => void;
  setMonthOverride: (v: number | null) => void;
  setUtcHourOverride: (v: number | null) => void;
  geolocationStatus: string;
}

describe('PropagationControl', () => {
  const mockSetMonthOverride = vi.fn();
  const mockSetUtcHourOverride = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const setupMockStore = (overrides: Partial<MockState> = {}) => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: MockState) => unknown) => {
      const state: MockState = {
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
      };
      return selector(state);
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

  it('updates UTC hour override when input changes', () => {
    setupMockStore();
    render(<PropagationControl />);

    const hourInput = screen.getByLabelText('UTC hour override') as HTMLInputElement;
    fireEvent.change(hourInput, { target: { value: '14.5' } });

    expect(mockSetUtcHourOverride).toHaveBeenCalledWith(14.5);
  });

  it('resets UTC hour override when Auto button is clicked', () => {
    setupMockStore({ utcHourOverride: 10 });
    render(<PropagationControl />);

    const autoButton = screen.getByRole('button', { name: 'Auto' });
    fireEvent.click(autoButton);

    expect(mockSetUtcHourOverride).toHaveBeenCalledWith(null);
  });

  it('disables Auto button when no UTC hour override is set', () => {
    setupMockStore({ utcHourOverride: null });
    render(<PropagationControl />);

    const autoButton = screen.getByRole('button', { name: 'Auto' }) as HTMLButtonElement;
    expect(autoButton.disabled).toBe(true);
  });
});
