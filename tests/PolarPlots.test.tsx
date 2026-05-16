import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PolarPlots } from '../src/components/Charts/PolarPlots';
import { useAntennaStore } from '../src/store/antennaStore';

vi.mock('react-chartjs-2', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Radar: (props: any) => {
    // Simulate Chart.js calling the tick callback
    if (props.options?.scales?.r?.ticks?.callback) {
      props.options.scales.r.ticks.callback(10);
    }
    return <div data-testid="mock-radar-chart" />;
  },
}));

describe('PolarPlots', () => {
  beforeEach(() => {
    cleanup();
    useAntennaStore.setState({
      showPolarCuts: true,
      orientation: 'NS',
      dbRange: 40,
      theme: 'light',
      result: {
        swr: 1.5,
        computeTimeMs: 10,
        impedance: { R: 50, X: 0 },
        maxGainDbi: 0,
        takeoffElevationDeg: 30,
        takeoffAzimuthDeg: 0,
        pattern: {
          data: new Float32Array(0),
          thetaSteps: 91,
          phiSteps: 72,
          dTheta: 1,
          dPhi: 5,
        },
      },
    });
  });

  it('renders polar cuts when showPolarCuts is true', () => {
    const { getAllByTestId } = render(<PolarPlots />);
    expect(getAllByTestId('mock-radar-chart').length).toBe(3);
  });

  it('handles EW orientation', () => {
    useAntennaStore.setState({ orientation: 'EW' });
    const { getAllByTestId } = render(<PolarPlots />);
    expect(getAllByTestId('mock-radar-chart').length).toBe(3);
  });

  it('handles NE-SW orientation', () => {
    useAntennaStore.setState({ orientation: 'NE-SW' });
    const { getAllByTestId } = render(<PolarPlots />);
    expect(getAllByTestId('mock-radar-chart').length).toBe(3);
  });

  it('handles NW-SE orientation', () => {
    useAntennaStore.setState({ orientation: 'NW-SE' });
    const { getAllByTestId } = render(<PolarPlots />);
    expect(getAllByTestId('mock-radar-chart').length).toBe(3);
  });

  it('handles numeric orientation', () => {
    useAntennaStore.setState({ orientation: 45 });
    const { getAllByTestId } = render(<PolarPlots />);
    expect(getAllByTestId('mock-radar-chart').length).toBe(3);
  });

  it('handles dark theme', () => {
    useAntennaStore.setState({ theme: 'dark' });
    const { getAllByTestId } = render(<PolarPlots />);
    expect(getAllByTestId('mock-radar-chart').length).toBe(3);
  });

  it('returns null when result is null', () => {
    useAntennaStore.setState({ result: null });
    const { container } = render(<PolarPlots />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when showPolarCuts is false', () => {
    useAntennaStore.setState({ showPolarCuts: false });
    const { container } = render(<PolarPlots />);
    expect(container.firstChild).toBeNull();
  });
});
