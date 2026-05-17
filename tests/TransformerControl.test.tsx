import { describe, expect, it, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { TransformerControl } from '../src/components/Panel/TransformerControl';
import { useAntennaStore } from '../src/store/antennaStore';

describe('TransformerControl', () => {
  beforeEach(() => {
    cleanup();
    useAntennaStore.setState({
      transformerEnabled: false,
      transformerRatio: 9,
      result: null,
    });
  });

  it('renders the section heading', () => {
    const { getByText } = render(<TransformerControl />);
    expect(getByText('Ideal transformer')).not.toBeNull();
  });

  it('shows the enable checkbox unchecked by default', () => {
    const { getByRole } = render(<TransformerControl />);
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('does not show ratio input when disabled', () => {
    const { queryByLabelText } = render(<TransformerControl />);
    expect(queryByLabelText(/Impedance ratio/i)).toBeNull();
  });

  it('shows ratio input and note when enabled', () => {
    useAntennaStore.setState({ transformerEnabled: true });
    const { getByLabelText, container } = render(<TransformerControl />);
    expect(getByLabelText(/Impedance ratio/i)).not.toBeNull();
    expect(container.textContent).toContain('Z_transformed = Z_feedpoint / ratio');
  });

  it('enables transformer when checkbox is clicked', () => {
    const { getByRole } = render(<TransformerControl />);
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(useAntennaStore.getState().transformerEnabled).toBe(true);
  });

  it('shows transformed values when enabled and result is present', () => {
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 9,
      result: {
        computeTimeMs: 10,
        maxGainDbi: 7,
        takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0,
        impedance: { R: 450, X: 0 },
        swr: 9.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<TransformerControl />);

    // Raw values visible
    expect(container.textContent).toContain('Feedpoint (raw R + jX)');
    expect(container.textContent).toContain('Raw SWR (vs 50 Ω)');
    // Transformed values visible: 450/9 = 50, SWR ≈ 1.00:1
    expect(container.textContent).toContain('Transformed (R + jX)');
    expect(container.textContent).toContain('50.0');
    expect(container.textContent).toContain('Transformed SWR (vs 50 Ω)');
    expect(container.textContent).toContain('1.00:1');
  });

  it('does not show transformed values when disabled even if result is present', () => {
    useAntennaStore.setState({
      transformerEnabled: false,
      result: {
        computeTimeMs: 10,
        maxGainDbi: 7,
        takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0,
        impedance: { R: 450, X: 0 },
        swr: 9.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<TransformerControl />);
    expect(container.textContent).not.toContain('Transformed SWR');
    expect(container.textContent).not.toContain('Raw SWR');
  });

  it('updates ratio when input changes', () => {
    useAntennaStore.setState({ transformerEnabled: true });
    const { getByLabelText } = render(<TransformerControl />);
    const input = getByLabelText(/Impedance ratio/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    expect(useAntennaStore.getState().transformerRatio).toBe(4);
  });

  it('shows disclaimer note when enabled and result is present', () => {
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 9,
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2,
        takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0,
        impedance: { R: 450, X: 0 },
        swr: 9.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<TransformerControl />);
    expect(container.textContent).toContain('ideal post-processing calculations');
  });
});
