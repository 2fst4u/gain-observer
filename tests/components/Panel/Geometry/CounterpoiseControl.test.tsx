import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CounterpoiseControl } from '../../../../src/components/Panel/Geometry/CounterpoiseControl';
import { useAntennaStore } from '../../../../src/store/antennaStore';

describe('CounterpoiseControl', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      antennaType: 'vertical-whip',
      whipCounterpoise: false,
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

    expect(screen.getByText(/No counterpoise\. NEC will report the high reactance/i)).toBeDefined();
  });

  it('renders checkbox and enabled hint text when antennaType is inverted-l and whipCounterpoise is true', () => {
    useAntennaStore.setState({ antennaType: 'inverted-l', whipCounterpoise: true });
    render(<CounterpoiseControl />);

    const checkbox = screen.getByRole('checkbox', { name: /Add ¼λ counterpoise radials/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    expect(screen.getByText(/4 horizontal ¼λ radials fan out from the base/i)).toBeDefined();
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
