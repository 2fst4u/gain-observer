import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GeometryControl } from '../src/components/Panel/GeometryControl';
import { useAntennaStore } from '../src/store/antennaStore';

describe('GeometryStatus', () => {
  const originalState = useAntennaStore.getState();

  afterEach(() => {
    cleanup();
    useAntennaStore.setState(originalState, true);
  });

  it('renders correctly for sloping-v', () => {
    // Arrange
    useAntennaStore.setState({
      antennaType: 'sloping-v',
      length: 20,
      height: 10,
      units: 'metric',
    });

    // Act
    render(<GeometryControl />);

    // Assert
    expect(screen.getByText(/Slope auto-snaps/i)).toBeTruthy();
  });

  it('renders clamping message for inverted-v when clamped', () => {
    // Arrange
    useAntennaStore.setState({
      antennaType: 'inverted-v',
      length: 40,
      height: 5, // very low height, long legs -> will clamp
      vAngle: 60, // requires steep slope
      units: 'metric',
    });

    // Act
    render(<GeometryControl />);

    // Assert
    expect(screen.getByText(/Geometry Clamped/i)).toBeTruthy();
    expect(screen.getByText(/Slope reduced to keep tips/i)).toBeTruthy();
  });
});
