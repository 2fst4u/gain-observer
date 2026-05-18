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
});
