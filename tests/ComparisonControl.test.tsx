import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ComparisonControl } from '../src/components/Panel/ComparisonControl';
import { useAntennaStore } from '../src/store/antennaStore';

// Mock the store
vi.mock('../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

describe('ComparisonControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when mode is not comparison', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        mode: 'standard',
        units: 'metric',
        result: null,
        sweep: [],
        comparisonReference: null,
        captureComparisonReference: vi.fn(),
        clearComparisonReference: vi.fn(),
      };
      return selector(state);
    });

    const { container } = render(<ComparisonControl />);
    expect(container.firstChild).toBeNull();
  });

  it('renders buttons but disabled when no result available', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        mode: 'comparison',
        units: 'metric',
        result: null,
        sweep: [],
        comparisonReference: null,
        captureComparisonReference: vi.fn(),
        clearComparisonReference: vi.fn(),
      };
      return selector(state);
    });

    render(<ComparisonControl />);

    expect(screen.getByRole('heading', { name: 'Comparison' })).toBeTruthy();

    const captureButton = screen.getByRole('button', { name: 'Use current as reference' });
    const clearButton = screen.getByRole('button', { name: 'Clear reference' });

    expect(captureButton.hasAttribute('disabled')).toBe(true);
    expect(clearButton.hasAttribute('disabled')).toBe(true);

    expect(screen.getByText('Capture a solved configuration to enable side-by-side comparison.')).toBeTruthy();
  });

  it('enables capture button when result is available', () => {
    const captureComparisonReference = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        mode: 'comparison',
        units: 'metric',
        result: { maxGainDbi: 2.15, swr: 1.5 },
        sweep: [ { frequency: 14.1, swr: 1.5, impedance: { real: 50, imag: 0 } } ],
        comparisonReference: null,
        captureComparisonReference,
        clearComparisonReference: vi.fn(),
      };
      return selector(state);
    });

    render(<ComparisonControl />);

    const captureButton = screen.getByRole('button', { name: 'Use current as reference' });
    expect(captureButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(captureButton);
    expect(captureComparisonReference).toHaveBeenCalledOnce();
  });

  it('displays reference and enables clear button when reference is captured', () => {
    const clearComparisonReference = vi.fn();
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        mode: 'comparison',
        units: 'metric',
        result: { maxGainDbi: 2.15, swr: 1.5 },
        sweep: [ { frequency: 14.1, swr: 1.5, impedance: { real: 50, imag: 0 } } ],
        comparisonReference: {
          capturedAt: 1680000000000,
          frequency: 14.1,
          length: 10,
          height: 5,
          orientation: 'NS',
          groundId: 'pastoral',
          result: { maxGainDbi: 2.15, swr: 1.5 },
        },
        captureComparisonReference: vi.fn(),
        clearComparisonReference,
      };
      return selector(state);
    });

    render(<ComparisonControl />);

    const clearButton = screen.getByRole('button', { name: 'Clear reference' });
    expect(clearButton.hasAttribute('disabled')).toBe(false);

    // Check some rendered reference data
    expect(screen.getByText('14.100 MHz')).toBeTruthy();
    expect(screen.getByText('Pastoral (avg)')).toBeTruthy();
    expect(screen.getByText('2.15 dBi')).toBeTruthy();
    expect(screen.getByText('1.50:1')).toBeTruthy();

    fireEvent.click(clearButton);
    expect(clearComparisonReference).toHaveBeenCalledOnce();
  });

  it('displays custom ground correctly', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        mode: 'comparison',
        units: 'metric',
        result: null,
        sweep: [],
        comparisonReference: {
          capturedAt: 1680000000000,
          frequency: 14.1,
          length: 10,
          height: 5,
          orientation: 45,
          groundId: 'custom',
          result: { maxGainDbi: 2.15, swr: 1.5 },
        },
        captureComparisonReference: vi.fn(),
        clearComparisonReference: vi.fn(),
      };
      return selector(state);
    });

    render(<ComparisonControl />);
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(screen.getByText('45°')).toBeTruthy();
  });
});
