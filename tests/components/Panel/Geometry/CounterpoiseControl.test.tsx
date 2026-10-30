import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CounterpoiseControl } from '../../../../src/components/Panel/Geometry/CounterpoiseControl';
import { useAntennaStore } from '../../../../src/store/antennaStore';

describe('CounterpoiseControl', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      antennaType: 'vertical-whip',
      whipCounterpoise: false,
      designFrequency: 7.1,
      frequency: 14.2,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('returns null when antennaType is not a ground-mounted vertical', () => {
    useAntennaStore.setState({ antennaType: 'dipole' });
    const { container } = render(<CounterpoiseControl />);
    expect(container.firstChild).toBeNull();
  });

  it('renders checkbox and disabled hint text when antennaType is vertical-whip and whipCounterpoise is false', () => {
    render(<CounterpoiseControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i }) as HTMLInputElement;
    expect(checkbox).toBeDefined();
    expect(checkbox.checked).toBe(false);

    expect(screen.getByText(/No counterpoise is modelled/i)).toBeDefined();
    expect(screen.getByText(/needs an explicitly modelled return conductor or ground system/i)).toBeDefined();
  });

  it('renders checkbox and enabled hint text when antennaType is inverted-l and whipCounterpoise is true', () => {
    useAntennaStore.setState({ antennaType: 'inverted-l', whipCounterpoise: true });
    render(<CounterpoiseControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    expect(screen.getByText(/4 horizontal radials are designed at 7\.10 MHz/i)).toBeDefined();
    expect(screen.getByText(/physical lengths stay fixed while tuning/i)).toBeDefined();
  });

  it('toggles whipCounterpoise in store when checkbox is clicked', () => {
    render(<CounterpoiseControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i });
    fireEvent.click(checkbox);

    expect(useAntennaStore.getState().whipCounterpoise).toBe(true);
  });

  it('has proper accessibility attributes connecting label, input, and hint text', () => {
    render(<CounterpoiseControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i });
    expect(checkbox.getAttribute('id')).toBe('whip-counterpoise');
    expect(checkbox.getAttribute('aria-describedby')).toBe('whip-counterpoise-hint');

    const hint = screen.getByText(/No counterpoise/i);
    expect(hint.getAttribute('id')).toBe('whip-counterpoise-hint');
    expect(hint.getAttribute('aria-live')).toBe('polite');
  });
});
