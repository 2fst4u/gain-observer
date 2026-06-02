import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PolarPlots } from '../src/components/Charts/PolarPlots';
import { useAntennaStore } from '../src/store/antennaStore';

const { tickCbs } = vi.hoisted(() => ({ tickCbs: [] as Array<(v: number) => string> }));

vi.mock('react-chartjs-2', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Radar: (props: any) => {
    const cb = props.options?.scales?.r?.ticks?.callback;
    if (cb) {
      // Simulate Chart.js calling the tick callback, and expose it for assertions.
      cb(10);
      tickCbs.push(cb);
    }
    return <div data-testid="mock-radar-chart" />;
  },
}));

describe('PolarPlots', () => {
  beforeEach(() => {
    cleanup();
    tickCbs.length = 0;
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

  it('labels the outer ring with the realized-gain peak, not the intrinsic gain', () => {
    // Severely mismatched antenna: 9.03 dBi gain but only −2.94 dBi realized.
    useAntennaStore.setState({
      dbRange: 40,
      transformerEnabled: false,
      feedlineId: 'none',
      result: {
        swr: 60.89,
        computeTimeMs: 10,
        impedance: { R: 1.7, X: 50.9 },
        maxGainDbi: 9.03,
        maxRealizedGainDbi: -2.94,
        takeoffElevationDeg: 90,
        takeoffAzimuthDeg: 0,
        pattern: { data: new Float32Array(0), thetaSteps: 91, phiSteps: 72, dTheta: 1, dPhi: 5 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    render(<PolarPlots />);
    // val = dbRange maps to the outer ring; it should read the realized peak.
    expect(tickCbs[0]!(40)).toBe('-3 dBi');
    // A ring 10 dB down reads 10 dB below the realized peak (offset is uniform).
    expect(tickCbs[0]!(30)).toBe('-13 dBi');
  });

  it('falls back to intrinsic gain when realized gain is unavailable', () => {
    useAntennaStore.setState({
      dbRange: 40,
      transformerEnabled: false,
      feedlineId: 'none',
      result: {
        swr: 1.5,
        computeTimeMs: 10,
        impedance: { R: 50, X: 0 },
        maxGainDbi: 6,
        maxRealizedGainDbi: undefined,
        takeoffElevationDeg: 30,
        takeoffAzimuthDeg: 0,
        pattern: { data: new Float32Array(0), thetaSteps: 91, phiSteps: 72, dTheta: 1, dPhi: 5 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    render(<PolarPlots />);
    expect(tickCbs[0]!(40)).toBe('6 dBi');
  });
});
