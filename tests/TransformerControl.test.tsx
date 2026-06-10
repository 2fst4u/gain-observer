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
    expect(getByText('Transformer at feedpoint')).not.toBeNull();
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

  it('shows ratio input and hint when enabled', () => {
    useAntennaStore.setState({ transformerEnabled: true });
    const { getByLabelText, container } = render(<TransformerControl />);
    expect(getByLabelText(/Impedance ratio/i)).not.toBeNull();
    expect(container.textContent).toMatch(/Insertion loss: 0\.2 dB/);
  });

  it('describes ratio=1 as a current (choke) balun', () => {
    useAntennaStore.setState({ transformerEnabled: true, transformerRatio: 1 });
    const { container } = render(<TransformerControl />);
    expect(container.textContent).toContain('current ("choke") balun');
  });

  it('describes ratio>1 as an impedance transformer', () => {
    useAntennaStore.setState({ transformerEnabled: true, transformerRatio: 9 });
    const { container } = render(<TransformerControl />);
    expect(container.textContent).toContain('Ratio 9:1');
    expect(container.textContent).toContain('divides antenna feedpoint impedance by 9');
  });

  it('enables transformer when checkbox is clicked', () => {
    const { getByRole } = render(<TransformerControl />);
    const checkbox = getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(useAntennaStore.getState().transformerEnabled).toBe(true);
  });

  it('updates ratio when input changes', () => {
    useAntennaStore.setState({ transformerEnabled: true });
    const { getByLabelText } = render(<TransformerControl />);
    const input = getByLabelText(/Impedance ratio/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    expect(useAntennaStore.getState().transformerRatio).toBe(4);
  });

  it('shows shield-radiates hint when transformer is disabled', () => {
    const { container } = render(<TransformerControl />);
    expect(container.textContent).toContain('feedline shield carries common-mode current');
  });

  it('suggests optimal ratio when result is present', () => {
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 1,
      feedlineId: 'none',
      result: { impedance: { R: 200, X: 0 } } as any
    });
    const { getByRole } = render(<TransformerControl />);
    const button = getByRole('button', { name: /Match/i });
    expect(button).not.toBeNull();
  });

  it('does not suggest optimal ratio if it matches current ratio', () => {
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 4,
      feedlineId: 'none',
      result: { impedance: { R: 200, X: 0 } } as any
    });
    const { queryByRole } = render(<TransformerControl />);
    expect(queryByRole('button', { name: /Match/i })).toBeNull();
  });

  it('applies optimal ratio when match button is clicked', () => {
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 1,
      feedlineId: 'none',
      result: { impedance: { R: 200, X: 0 } } as any
    });
    const { getByRole } = render(<TransformerControl />);
    const button = getByRole('button', { name: /Match/i });
    fireEvent.click(button);
    expect(useAntennaStore.getState().transformerRatio).toBe(4);
  });

  it('handles input blur and invalid values gracefully', () => {
    useAntennaStore.setState({ transformerEnabled: true, transformerRatio: 2 });
    const { getByLabelText } = render(<TransformerControl />);
    const input = getByLabelText(/Impedance ratio/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(useAntennaStore.getState().transformerRatio).toBe(2);
  });

  it('suggests optimal ratio considering feedline if active', () => {
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 1,
      feedlineId: 'rg58',
      feedlineLength: 0,
      frequency: 14.1,
      result: { impedance: { R: 200, X: 0 } } as any
    });
    const { getByRole } = render(<TransformerControl />);
        const optimalRatio = 4; // Assuming 200/50 = 4 for rg58
    expect(getByRole('button', { name: /Match/i })).not.toBeNull();
  });
});
