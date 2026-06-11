import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GeometryStatus } from '../src/components/Panel/GeometryStatus';
import { useAntennaStore } from '../src/store/antennaStore';

describe('GeometryStatus', () => {
  const originalState = useAntennaStore.getState();

  afterEach(() => {
    cleanup();
    useAntennaStore.setState(originalState, true);
  });

  it('renders correctly for sloping-v', () => {
    useAntennaStore.setState({
      antennaType: 'sloping-v',
      length: 20,
      height: 10,
      units: 'metric',
    });

    render(<GeometryStatus />);
    expect(screen.getByText(/Slope auto-snaps/i)).toBeTruthy();
  });

  it('renders clamping message for inverted-v when clamped', () => {
    useAntennaStore.setState({
      antennaType: 'inverted-v',
      length: 40,
      height: 5,
      vAngle: 60,
      units: 'metric',
    });

    render(<GeometryStatus />);
    expect(screen.getByText(/Geometry Clamped/i)).toBeTruthy();
    expect(screen.getByText(/Slope reduced to keep tips/i)).toBeTruthy();
  });

  it('renders normal message for inverted-v when not clamped', () => {
    useAntennaStore.setState({
      antennaType: 'inverted-v',
      length: 10,
      height: 20,
      vAngle: 120,
      units: 'metric',
    });

    render(<GeometryStatus />);
    expect(screen.getByText(/Geometry Status/i)).toBeTruthy();
    expect(screen.queryByText(/Geometry Clamped/i)).toBeNull();
  });

  it('renders nothing for unsupported antenna types', () => {
    useAntennaStore.setState({
      antennaType: 'dipole',
      length: 10,
      height: 20,
      vAngle: 120,
      units: 'metric',
    });

    const { container } = render(<GeometryStatus />);
    expect(container.firstChild).toBeNull();
  });

  it('handles zero length inverted-v', () => {
    useAntennaStore.setState({
      antennaType: 'inverted-v',
      length: 0,
      height: 10,
      vAngle: 120,
      units: 'metric',
    });

    render(<GeometryStatus />);
    expect(screen.getByText(/Geometry Clamped/i)).toBeTruthy();
  });
});
