import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TerminationControl } from '../../../../src/components/Panel/Geometry/TerminationControl';
import { mockAntennaStore, type MockAntennaState } from '../../../helpers/mockStore';
import { FOLDED_DIPOLE_FEED_R_OHMS } from '../../../../src/physics/constants';

vi.mock('../../../../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../../../../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

type MockState = MockAntennaState;

function buildMockState(overrides: Partial<MockState> = {}): MockState {
  return {
    antennaType: 'terminated-delta',
    terminatingResistor: 0,
    setTerminatingResistor: vi.fn(),
    foldedDipoleAperture: 0.1,
    wireRadius: 0.001,
    ...overrides,
  };
}

describe('TerminationControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when antennaType does not support termination', () => {
    mockAntennaStore(buildMockState({ antennaType: 'dipole' }));
    const { container } = render(<TerminationControl />);
    expect(container.firstChild).toBeNull();
  });

  it('renders termination controls for sloping-v with unterminated state', () => {
    const setTerminatingResistor = vi.fn();
    mockAntennaStore(
      buildMockState({
        antennaType: 'sloping-v',
        terminatingResistor: 0,
        setTerminatingResistor,
      })
    );

    render(<TerminationControl />);

    expect(screen.getByLabelText(/Termination resistance \(Ω\)/i)).toBeTruthy();

    const offButton = screen.getByRole('button', { name: /Turn off termination resistor/i });
    expect(offButton.getAttribute('aria-disabled')).toBe('true');

    const recommendedButton = screen.getByRole('button', { name: /Set terminating resistor to recommended \(300 Ω\)/i });
    expect(recommendedButton.getAttribute('aria-disabled')).toBe('false');
    expect(recommendedButton.textContent).toBe('300 Ω');

    expect(screen.getByText(/Unterminated: travelling wave reflects/i)).toBeTruthy();

    // Clicking Off when already 0 does not trigger callback
    fireEvent.click(offButton);
    expect(setTerminatingResistor).not.toHaveBeenCalled();

    // Clicking Recommended sets resistor to 300
    fireEvent.click(recommendedButton);
    expect(setTerminatingResistor).toHaveBeenCalledWith(300);
  });

  it('renders termination hint and handles button clicks for active sloping-v termination', () => {
    const setTerminatingResistor = vi.fn();
    mockAntennaStore(
      buildMockState({
        antennaType: 'sloping-v',
        terminatingResistor: 300,
        setTerminatingResistor,
      })
    );

    render(<TerminationControl />);

    const recommendedButton = screen.getByRole('button', { name: /Set terminating resistor to recommended \(300 Ω\)/i });
    expect(recommendedButton.getAttribute('aria-disabled')).toBe('true');

    expect(screen.getByText(/300 Ω resistors at each tip \(to ground\)/i)).toBeTruthy();

    // Clicking Recommended when already 300 does not trigger callback
    fireEvent.click(recommendedButton);
    expect(setTerminatingResistor).not.toHaveBeenCalled();

    const offButton = screen.getByRole('button', { name: /Turn off termination resistor/i });
    fireEvent.click(offButton);
    expect(setTerminatingResistor).toHaveBeenCalledWith(0);
  });

  it('renders termination controls for folded-dipole in unterminated state', () => {
    const setTerminatingResistor = vi.fn();
    mockAntennaStore(
      buildMockState({
        antennaType: 'folded-dipole',
        terminatingResistor: 0,
        foldedDipoleAperture: 0.1,
        wireRadius: 0.001,
        setTerminatingResistor,
      })
    );

    render(<TerminationControl />);

    expect(screen.getByText(/Unterminated: a classic folded dipole — ~300 Ω feedpoint/i)).toBeTruthy();

    const recommendedButton = screen.getByRole('button', { name: `Set terminating resistor to recommended (${FOLDED_DIPOLE_FEED_R_OHMS} Ω)` });
    fireEvent.click(recommendedButton);
    expect(setTerminatingResistor).toHaveBeenCalledWith(FOLDED_DIPOLE_FEED_R_OHMS);
  });

  it('renders termination hint for folded-dipole with active termination', () => {
    mockAntennaStore(
      buildMockState({
        antennaType: 'folded-dipole',
        terminatingResistor: 300,
        foldedDipoleAperture: 0.1,
        wireRadius: 0.001,
      })
    );

    render(<TerminationControl />);

    const hint = screen.getByText(/300 Ω resistor at the centre of the conductor opposite the feed/i);
    expect(hint.textContent).toContain('costs about 3.0 dB of gain');
    expect(hint.textContent).toContain('Z₀ (≈ 553 Ω here)');
  });

  it('renders termination controls for terminated-delta with active termination', () => {
    mockAntennaStore(
      buildMockState({
        antennaType: 'terminated-delta',
        terminatingResistor: 600,
      })
    );

    render(<TerminationControl />);

    expect(screen.getByText(/600 Ω resistor on a short bridge wire spanning the gap/i)).toBeTruthy();
  });

  it('updates terminating resistor state on numeric input change', () => {
    const setTerminatingResistor = vi.fn();
    mockAntennaStore(
      buildMockState({
        antennaType: 'terminated-delta',
        terminatingResistor: 0,
        setTerminatingResistor,
      })
    );

    render(<TerminationControl />);

    const input = screen.getByRole('spinbutton', { name: /Termination resistance \(Ω\)/i });
    fireEvent.change(input, { target: { value: '500' } });

    expect(setTerminatingResistor).toHaveBeenCalledWith(500);
  });
});
