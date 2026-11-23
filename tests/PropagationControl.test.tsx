import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
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

// The panel fetches solar flux from NOAA SWPC; tests must never reach the
// network. Blocks below that need data replace this with their own stub.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network disabled in tests'); }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

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
        latitudeDeg: null,
        longitudeDeg: null,
        monthOverride: null,
        utcHourOverride: null,
        units: 'metric',
        result: null,
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

describe('PropagationControl - ionosphere, solar flux and realized gain', () => {
  // SWPC files as the panel receives them; never reach the network in tests.
  const observed = [{ 'time-tag': '2026-05', 'f10.7': 150, 'smoothed_f10.7': -1 }];
  const predicted = [{ 'time-tag': '2026-06', 'predicted_f10.7': 131 }];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('predicted') ? predicted : observed),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const store = (overrides: Partial<MockState> = {}) => mockAntennaStore({
    frequency: 7.1, result: null, units: 'metric', latitudeDeg: -33.9, longitudeDeg: 151.2,
    monthOverride: 6, utcHourOverride: 2, geolocationStatus: 'idle', ...overrides,
  });

  it('labels the panel as a monthly-median model without signal forecasts', async () => {
    store();
    render(<PropagationControl />);
    expect(screen.getByRole('heading', { level: 2, name: /Skywave propagation/ })).toBeDefined();
    expect(screen.getByText('Monthly median')).toBeDefined();
    expect(screen.getByText('Received signal and path availability: not calculated.')).toBeDefined();
    expect(screen.queryByText('LUF')).toBeNull();
    expect(await screen.findByText('foF2 (F2 critical frequency)')).toBeDefined();
  });

  it('uses NOAA SWPC flux for the chosen month and only contacts SWPC', async () => {
    store();
    render(<PropagationControl />);
    expect(await screen.findByText('NOAA SWPC predicted smoothed flux for 2026-06.')).toBeDefined();
    expect((screen.getByLabelText('Solar flux F10.7 in solar flux units') as HTMLInputElement).value).toBe('131');
    for (const [url, init] of fetchMock.mock.calls) {
      expect(new URL(url as string).host).toBe('services.swpc.noaa.gov');
      expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
    }
  });

  it('falls back visibly when SWPC is unreachable, and a manual flux changes the ionosphere', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    store({ monthOverride: 3 });
    render(<PropagationControl />);
    expect(await screen.findByText(/could not be reached; assuming 100/)).toBeDefined();
    const foF2 = async () => (await screen.findByText('foF2 (F2 critical frequency)')).nextElementSibling!.textContent!;
    const before = Number.parseFloat(await foF2());
    fireEvent.change(screen.getByLabelText('Solar flux F10.7 in solar flux units'), { target: { value: '200' } });
    expect(Number.parseFloat(await foF2())).toBeGreaterThan(before);
    expect(screen.getByText('Entered manually. Reset to use NOAA SWPC data.')).toBeDefined();
  });

  it('uses the fitted transformer matching and insertion loss, rather than raw feedpoint SWR', async () => {
    const pattern = makeGainPattern();
    pattern.data.fill(-30);
    pattern.data[6 * pattern.phiSteps] = 0; // 30° elevation, 0 dBi antenna gain.
    store({
      frequency: 14.2,
      result: makeSimulationResult({ pattern, impedance: { R: 800, X: 0 }, swr: 16, maxGainDbi: 0, maxRealizedGainDbi: -6.5471786877 }),
      transformerEnabled: true,
      transformerRatio: 16,
      feedlineId: 'none',
      atuEnabled: false,
    });
    render(<PropagationControl />);
    const gain = (await screen.findByText('Strongest lobe realized gain')).nextElementSibling;
    expect(gain?.textContent).toBe('-0.20 dBi');
    expect(screen.queryByText(/weak signal/)).toBeNull();
  });
});
