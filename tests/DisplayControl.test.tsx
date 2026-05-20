import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DisplayControl } from '../src/components/Panel/DisplayControl';
import { useAntennaStore } from '../src/store/antennaStore';

describe('DisplayControl', () => {
  const originalState = useAntennaStore.getState();

  afterEach(() => {
    cleanup();
    useAntennaStore.setState(originalState, true);
  });

  it('renders display controls and updates state on interaction', () => {
    // Arrange
    render(<DisplayControl />);

    // Initial state assertions
    expect(useAntennaStore.getState().colormap).toBe('viridis');

    // Colormap buttons
    const turboBtn = screen.getByRole('button', { name: /turbo/i });

    // Range inputs
    const dynamicRangeInput = screen.getByLabelText(/Dynamic range/i);
    const colorMaxInput = screen.getByLabelText(/Color max/i);
    const patternScaleInput = screen.getByLabelText(/Pattern scale/i);

    // Checkboxes
    const showGridCheckbox = screen.getByLabelText(/Ground grid/i);
    const showAxesCheckbox = screen.getByLabelText(/Axes helper/i);
    const showPolarCutsCheckbox = screen.getByLabelText(/Polar plots/i);

    // Act - Colormap
    fireEvent.click(turboBtn);
    expect(useAntennaStore.getState().colormap).toBe('turbo');

    // Act - Ranges
    fireEvent.change(dynamicRangeInput, { target: { value: '40' } });
    expect(useAntennaStore.getState().dbRange).toBe(40);

    fireEvent.change(colorMaxInput, { target: { value: '15' } });
    expect(useAntennaStore.getState().colorMaxDb).toBe(15);

    fireEvent.change(patternScaleInput, { target: { value: '2.0' } });
    expect(useAntennaStore.getState().patternScale).toBe(2.0);

    // Act - Checkboxes (initial state typically true for some, false for others, let's toggle them)
    const initialGrid = useAntennaStore.getState().showGrid;
    fireEvent.click(showGridCheckbox);
    expect(useAntennaStore.getState().showGrid).toBe(!initialGrid);

    const initialAxes = useAntennaStore.getState().showAxes;
    fireEvent.click(showAxesCheckbox);
    expect(useAntennaStore.getState().showAxes).toBe(!initialAxes);

    const initialPolarCuts = useAntennaStore.getState().showPolarCuts;
    fireEvent.click(showPolarCutsCheckbox);
    expect(useAntennaStore.getState().showPolarCuts).toBe(!initialPolarCuts);
  });
});
