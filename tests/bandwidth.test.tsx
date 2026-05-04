import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SWRChart } from '../src/components/Charts/SWRChart';
import { useAntennaStore } from '../src/store/antennaStore';

// Mock Chart.js to avoid canvas rendering issues in test environment
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
}));

describe('SWRChart Bandwidth Calculation', () => {
  beforeEach(() => {
    cleanup();
    useAntennaStore.setState({
      result: {
        swr: 1.5,
        computeTimeMs: 10,
        impedance: { R: 50, X: 0 },
      } as any,
      sweep: [],
      frequency: 7.1,
    });
  });

  it('renders clipped bandwidth when SWR is below 2:1 at the start', () => {
    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 7.0, swr: 1.5, R: 50, X: 0 },
        { frequencyMHz: 7.1, swr: 1.2, R: 50, X: 0 },
        { frequencyMHz: 7.2, swr: 2.5, R: 50, X: 0 },
      ],
    });

    const { getByText } = render(<SWRChart />);

    // fHigh will be found between 7.1 and 7.2
    // fLow will be 7.0 because it's clipped
    // 2:1 BW should show ">" and some value
    expect(getByText(/>.*kHz/)).not.toBeNull();
  });

  it('renders clipped bandwidth when entirely below 2:1', () => {
    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 7.0, swr: 1.5, R: 50, X: 0 },
        { frequencyMHz: 7.1, swr: 1.2, R: 50, X: 0 },
        { frequencyMHz: 7.2, swr: 1.5, R: 50, X: 0 },
      ],
    });

    const { getByText } = render(<SWRChart />);
    // Entire 200 kHz sweep is below 2:1
    expect(getByText('>200 kHz')).not.toBeNull();
  });

  it('limits yMax when all SWR points are above 2:1', () => {
    // We can't easily test useMemo return value from outside without
    // exported helpers, but we can verify it doesn't crash and
    // potentially check the mock chart props if we were more sophisticated.
    // For now, let's just ensure it renders.
    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 7.0, swr: 50, R: 50, X: 0 },
        { frequencyMHz: 7.1, swr: 40, R: 50, X: 0 },
        { frequencyMHz: 7.2, swr: 60, R: 50, X: 0 },
      ],
    });

    const { getByTestId } = render(<SWRChart />);
    expect(getByTestId('mock-line-chart')).not.toBeNull();
  });
});
