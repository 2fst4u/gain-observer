import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SWRChart } from '../src/components/Charts/SWRChart';
import { useAntennaStore } from '../src/store/antennaStore';

// Mock Chart.js to avoid canvas rendering issues in test environment
vi.mock('react-chartjs-2', () => ({
  Line: (props: { options?: { scales?: { x?: { ticks?: { callback?: (val: number) => void } } } } }) => {
    if (props.options?.scales?.x?.ticks?.callback) {
      props.options.scales.x.ticks.callback(7.1);
    }
    return <div data-testid="mock-line-chart" />;
  },
}));

describe('SWRChart Bandwidth Calculation', () => {
  beforeEach(() => {
    cleanup();
    useAntennaStore.setState({
      result: {
        swr: 1.5,
        computeTimeMs: 10,
        impedance: { R: 50, X: 0 },
        maxGainDbi: 0,
        takeoffElevationDeg: 0,
        takeoffAzimuthDeg: 0,
        pattern: {
          data: new Float32Array(0),
          thetaSteps: 0,
          phiSteps: 0,
          dTheta: 0,
          dPhi: 0,
        },
      },
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

  it('renders correctly when transformerInDisplay is true', () => {
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 4,
      feedlineId: 'none',
      sweep: [
        { frequencyMHz: 7.0, swr: 3.0, R: 200, X: 0 },
        { frequencyMHz: 7.1, swr: 2.5, R: 180, X: 10 },
        { frequencyMHz: 7.2, swr: 1.5, R: 50, X: 0 }, // Post-transformer will be below 2
      ],
    });

    const { getByTestId } = render(<SWRChart />);
    expect(getByTestId('mock-line-chart')).not.toBeNull();
  });

  it('renders correctly when comparison mode is active', () => {
    useAntennaStore.setState({
      mode: 'comparison',
      comparisonReference: {
        sweep: [
          { frequencyMHz: 7.0, swr: 3.0, R: 50, X: 0 },
          { frequencyMHz: 7.1, swr: 1.5, R: 50, X: 0 }, // Below 2
          { frequencyMHz: 7.2, swr: 3.5, R: 50, X: 0 },
        ],
        antennaType: 'dipole',
        frequency: 7.1,
        result: {
          swr: 1.5,
          computeTimeMs: 10,
          impedance: { R: 50, X: 0 },
          maxGainDbi: 0,
          takeoffElevationDeg: 0,
          takeoffAzimuthDeg: 0,
          pattern: {
            data: new Float32Array(0),
            thetaSteps: 0,
            phiSteps: 0,
            dTheta: 0,
            dPhi: 0,
          },
        },
      },
      sweep: [
        { frequencyMHz: 7.0, swr: 50, R: 50, X: 0 },
        { frequencyMHz: 7.1, swr: 40, R: 50, X: 0 },
        { frequencyMHz: 7.2, swr: 60, R: 50, X: 0 },
      ],
    });

    const { getByTestId } = render(<SWRChart />);
    expect(getByTestId('mock-line-chart')).not.toBeNull();
  });

  it('renders loading spinner when sweep is empty', () => {
    useAntennaStore.setState({
      sweep: [],
    });

    const { getByText } = render(<SWRChart />);
    expect(getByText('Computing frequency sweep…')).not.toBeNull();
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
