import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ColormapLegend } from '../src/components/Scene/ColormapLegend';
import { useAntennaStore } from '../src/store/antennaStore';
import { makeSimulationResult } from './helpers/factories';

describe('ColormapLegend', () => {
  const originalState = useAntennaStore.getState();

  afterEach(() => {
    cleanup();
    useAntennaStore.setState(originalState, true);
  });

  const mockResult = makeSimulationResult({
    maxGainDbi: 5,
    takeoffElevationDeg: 45,
    takeoffAzimuthDeg: 90,
    swr: 1.0,
    efficiency: 1.0,
  });

  it('renders nothing when result is null', () => {
    const { container } = render(<ColormapLegend result={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with given store values', () => {
    useAntennaStore.setState({
      colormap: 'viridis',
      dbRange: 40,
      colorMaxDb: 15,
    });

    render(<ColormapLegend result={mockResult} />);

    // Check labels: colorMaxDb and (colorMaxDb - dbRange)
    expect(screen.getByText('15.0 dBi')).toBeDefined();
    expect(screen.getByText('-25.0 dBi')).toBeDefined(); // 15 - 40 = -25

    // Check gradient element
    const gradientEl = document.querySelector('.colormap-legend-gradient');
    expect(gradientEl).toBeDefined();

    // Check it has background style mapped to the store's colormap
    const style = (gradientEl as HTMLElement).style.background;
    expect(style).toContain('linear-gradient');
  });

  it('updates when store values change', () => {
    useAntennaStore.setState({
      colormap: 'turbo',
      dbRange: 20,
      colorMaxDb: 5,
    });

    const { rerender } = render(<ColormapLegend result={mockResult} />);

    expect(screen.getByText('5.0 dBi')).toBeDefined();
    expect(screen.getByText('-15.0 dBi')).toBeDefined(); // 5 - 20 = -15

    const gradientEl = document.querySelector('.colormap-legend-gradient');
    const style = (gradientEl as HTMLElement).style.background;
    expect(style).toContain('linear-gradient');

    // Update state again
    useAntennaStore.setState({
      colormap: 'jet',
      dbRange: 30,
      colorMaxDb: 10,
    });

    rerender(<ColormapLegend result={mockResult} />);
    expect(screen.getByText('10.0 dBi')).toBeDefined();
    expect(screen.getByText('-20.0 dBi')).toBeDefined();
  });

  it('renders a figure element with correct aria-label', () => {
    useAntennaStore.setState({ colormap: 'viridis', dbRange: 40, colorMaxDb: 10 });
    render(<ColormapLegend result={mockResult} />);
    const figure = document.querySelector('figure.colormap-legend');
    expect(figure).not.toBeNull();
    expect(figure!.getAttribute('aria-label')).toBe('Gain colormap legend');
  });

  it('renders a figcaption with both max and min labels', () => {
    useAntennaStore.setState({ colormap: 'viridis', dbRange: 50, colorMaxDb: 20 });
    render(<ColormapLegend result={mockResult} />);
    const figcaption = document.querySelector('.colormap-legend-labels');
    expect(figcaption).not.toBeNull();
    // max = 20.0, min = 20 - 50 = -30.0
    expect(screen.getByText('20.0 dBi')).toBeDefined();
    expect(screen.getByText('-30.0 dBi')).toBeDefined();
  });

  it('renders correct gradient for jet colormap', () => {
    useAntennaStore.setState({ colormap: 'jet', dbRange: 40, colorMaxDb: 0 });
    render(<ColormapLegend result={mockResult} />);
    const gradientEl = document.querySelector('.colormap-legend-gradient') as HTMLElement;
    expect(gradientEl.style.background).toContain('linear-gradient');
    expect(gradientEl.style.background).toContain('to top');
  });

  it('handles zero dbRange gracefully', () => {
    useAntennaStore.setState({ colormap: 'viridis', dbRange: 0, colorMaxDb: 5 });
    render(<ColormapLegend result={mockResult} />);
    // minDb = 5 - 0 = 5
    expect(screen.getAllByText('5.0 dBi')).toHaveLength(2);
  });
});
