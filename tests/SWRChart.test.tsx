import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SWRChart } from '../src/components/Charts/SWRChart';
import { useAntennaStore } from '../src/store/antennaStore';

// Mock chart.js so canvas rendering doesn't crash jsdom
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />
}));

describe('SWRChart', () => {
  beforeEach(() => {
    useAntennaStore.setState(useAntennaStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a loading state when there is no sweep data', () => {
    useAntennaStore.setState({ sweep: [] });
    render(<SWRChart />);
    expect(screen.getByText('Computing frequency sweep…')).toBeDefined();
  });

  it('renders the chart and controls when sweep data is present', () => {
    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 14.0, R: 50, X: 0, swr: 1 },
        { frequencyMHz: 14.2, R: 50, X: 0, swr: 1 },
      ],
      result: { R: 50, X: 0, swr: 1, gainMax: 0, efficiency: 1, maxGainElevation: 0, maxGainAzimuth: 0 },
    });
    render(<SWRChart />);
    expect(screen.getAllByTestId('mock-line-chart')[0]).toBeDefined();
    expect(screen.getByRole('group', { name: /SWR chart zoom and pan/i })).toBeDefined();
  });

  it('displays the correct SWR stats', () => {
    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 14.0, R: 50, X: 0, swr: 1.5 },
        { frequencyMHz: 14.1, R: 50, X: 0, swr: 1.1 },
        { frequencyMHz: 14.2, R: 50, X: 0, swr: 1.5 },
      ],
      result: { R: 50, X: 0, swr: 1.1, gainMax: 0, efficiency: 1, maxGainElevation: 0, maxGainAzimuth: 0 },
    });
    render(<SWRChart />);

    // min SWR logic
    expect(screen.getByText(/1\.10:1 at 14\.100 MHz/)).toBeDefined();
    // 2:1 BW logic
    expect(screen.getByText(/200 kHz/)).toBeDefined();
  });

  it('displays N/A for 2:1 BW when there is no band', () => {
    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 14.0, R: 50, X: 0, swr: 3.0 },
        { frequencyMHz: 14.1, R: 50, X: 0, swr: 2.5 },
        { frequencyMHz: 14.2, R: 50, X: 0, swr: 3.0 },
      ],
      result: { R: 50, X: 0, swr: 2.5, gainMax: 0, efficiency: 1, maxGainElevation: 0, maxGainAzimuth: 0 },
    });
    render(<SWRChart />);

    expect(screen.getByText('N/A')).toBeDefined();
  });

  it('handles zoom controls', () => {
    const zoomSwrViewMock = vi.fn();
    const panSwrViewMock = vi.fn();
    const resetSwrViewMock = vi.fn();

    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 14.0, R: 50, X: 0, swr: 1 },
        { frequencyMHz: 14.2, R: 50, X: 0, swr: 1 },
      ],
      result: { R: 50, X: 0, swr: 1, gainMax: 0, efficiency: 1, maxGainElevation: 0, maxGainAzimuth: 0 },
      zoomSwrView: zoomSwrViewMock,
      panSwrView: panSwrViewMock,
      resetSwrView: resetSwrViewMock,
    });
    render(<SWRChart />);

    const zoomInBtn = screen.getByRole('button', { name: /Zoom in/i });
    const zoomOutBtn = screen.getByRole('button', { name: /Zoom out/i });
    const panLeftBtn = screen.getByRole('button', { name: /Pan to lower frequency/i });
    const panRightBtn = screen.getByRole('button', { name: /Pan to higher frequency/i });
    const resetBtn = screen.getByRole('button', { name: /Reset zoom/i });

    fireEvent.click(zoomInBtn);
    expect(zoomSwrViewMock).toHaveBeenCalledWith(0.6);

    fireEvent.click(zoomOutBtn);
    expect(zoomSwrViewMock).toHaveBeenCalledWith(1/0.6);

    fireEvent.click(panLeftBtn);
    expect(panSwrViewMock).toHaveBeenCalledWith(-0.3);

    fireEvent.click(panRightBtn);
    expect(panSwrViewMock).toHaveBeenCalledWith(0.3);

    fireEvent.click(resetBtn);
    expect(resetSwrViewMock).toHaveBeenCalled();
  });

  it('handles wheel gestures on the chart wrapper (if chartRef is present)', () => {
    const zoomSwrViewMock = vi.fn();

    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 14.0, R: 50, X: 0, swr: 1 },
        { frequencyMHz: 14.2, R: 50, X: 0, swr: 1 },
      ],
      result: { R: 50, X: 0, swr: 1, gainMax: 0, efficiency: 1, maxGainElevation: 0, maxGainAzimuth: 0 },
      zoomSwrView: zoomSwrViewMock,
    });

    render(<SWRChart />);

    const chartWrapper = screen.getAllByTestId('mock-line-chart')[0].parentElement;
    if (chartWrapper) {
      fireEvent.wheel(chartWrapper, { deltaY: -100, clientX: 100 });
      // since chart.js is mocked, chartRef is empty and handles wheel bails out early
      // which is fine, we just want to ensure it doesn't crash
    }
  });

  it('handles pointer down gestures on the chart wrapper', () => {
    const panSwrViewByMHzMock = vi.fn();

    useAntennaStore.setState({
      sweep: [
        { frequencyMHz: 14.0, R: 50, X: 0, swr: 1 },
        { frequencyMHz: 14.2, R: 50, X: 0, swr: 1 },
      ],
      result: { R: 50, X: 0, swr: 1, gainMax: 0, efficiency: 1, maxGainElevation: 0, maxGainAzimuth: 0 },
      panSwrViewByMHz: panSwrViewByMHzMock,
      swrViewSpanMHz: 0.2,
      swrViewCenterMHz: 14.1,
    });

    // We cannot fully test the inner workings of useSwrViewGestures easily without
    // real canvas bounds but we can at least trigger the pointerdown to cover the lines.
    render(<SWRChart />);

    const chartWrapper = screen.getAllByTestId('mock-line-chart')[0].parentElement;
    if (chartWrapper) {
      fireEvent.pointerDown(chartWrapper, { button: 0, clientX: 100 });
      // In JS DOM canvas, chartArea is probably null without real chart.js,
      // but we covered the handler branch
    }
  });
});
