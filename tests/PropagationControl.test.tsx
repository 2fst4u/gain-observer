import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PropagationControl } from '../src/components/Panel/PropagationControl';
import { mockAntennaStore, type MockAntennaState } from './helpers/mockStore';
import { makeGainPattern, makeSimulationResult } from './helpers/factories';

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

describe('PropagationControl - geometry and realized gain', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('labels the panel as illustrative geometry without signal or ionosphere forecasts', () => {
    mockAntennaStore({ result: null, units: 'metric', latitudeDeg: 40, longitudeDeg: -75, monthOverride: 6, utcHourOverride: 12, geolocationStatus: 'idle' });
    render(<PropagationControl />);
    expect(screen.getByRole('heading', { level: 2, name: /Propagation geometry/ })).toBeDefined();
    expect(screen.getByText('Illustrative')).toBeDefined();
    expect(screen.getByText('Received signal and path availability: not calculated.')).toBeDefined();
    expect(screen.queryByText('LUF')).toBeNull();
    expect(screen.queryByText('foF2')).toBeNull();
  });

  it('uses the fitted transformer matching and insertion loss, rather than raw feedpoint SWR', () => {
    const pattern = makeGainPattern();
    pattern.data.fill(-30);
    pattern.data[6 * pattern.phiSteps] = 0; // 30° elevation, 0 dBi antenna gain.
    mockAntennaStore({
      frequency: 14.2,
      result: makeSimulationResult({ pattern, impedance: { R: 800, X: 0 }, swr: 16, maxGainDbi: 0, maxRealizedGainDbi: -6.5471786877 }),
      transformerEnabled: true,
      transformerRatio: 16,
      feedlineId: 'none',
      atuEnabled: false,
      units: 'metric',
      latitudeDeg: 0,
      longitudeDeg: 0,
      monthOverride: 6,
      utcHourOverride: 12,
      geolocationStatus: 'idle',
    });
    render(<PropagationControl />);
    const gain = screen.getByText('Selected lobe realized gain').nextElementSibling;
    expect(gain?.textContent).toBe('-0.20 dBi');
    expect(screen.queryByText(/weak signal/)).toBeNull();
  });

  it('allows shell height changes to alter geometric arcs explicitly', () => {
    mockAntennaStore({ result: null, units: 'metric', latitudeDeg: 0, longitudeDeg: 0, monthOverride: 6, utcHourOverride: 12, geolocationStatus: 'idle' });
    render(<PropagationControl />);
    const before = screen.getByText('1× ideal hop').nextElementSibling!.textContent;
    fireEvent.change(screen.getByLabelText('Ideal shell height in kilometres'), { target: { value: '400' } });
    const after = screen.getByText('1× ideal hop').nextElementSibling!.textContent;
    expect(Number.parseInt(after!)).toBeGreaterThan(Number.parseInt(before!));
  });
});
