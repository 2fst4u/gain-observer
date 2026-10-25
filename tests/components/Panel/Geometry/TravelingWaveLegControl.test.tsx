import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TravelingWaveLegControl } from '../../../../src/components/Panel/Geometry/TravelingWaveLegControl';
import { mockAntennaStore, type MockAntennaState } from '../../../helpers/mockStore';

vi.mock('../../../../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../../../../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

function buildMockState(overrides: Partial<MockAntennaState> = {}): MockAntennaState {
  return {
    antennaType: 'sloping-v',
    length: 84.44858, // Approx 2 * lambda at 7.1 MHz (lambda = 299.792458 / 7.1 = 42.22429 m)
    frequency: 7.1,
    setLegLengthMultiple: vi.fn(),
    ...overrides,
  };
}

describe('TravelingWaveLegControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders null when antennaType is not sloping-v', () => {
    mockAntennaStore(buildMockState({ antennaType: 'dipole' }));
    const { container } = render(<TravelingWaveLegControl />);
    expect(container.firstChild).toBeNull();
  });

  it('renders button group with 10 wavelength buttons when antennaType is sloping-v', () => {
    mockAntennaStore(buildMockState());
    render(<TravelingWaveLegControl />);

    const group = screen.getByRole('group', { name: 'Leg length in wavelengths' });
    expect(group).toBeTruthy();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(10);
    expect(buttons[0].textContent).toBe('1λ');
    expect(buttons[9].textContent).toBe('10λ');
  });

  it('marks active button with active class and aria-pressed=true', () => {
    // legMultipleFromLength(length, frequency) calculation:
    // lambda = 299.792458 / 7.1 = 42.22429
    // legMultiple = Math.round(84.44858 / (2 * 42.22429)) = 1 -> total length 84.45 => leg is 1 wavelength (42.22m * 2 = 84.45 total)
    // Wait: legMultipleFromLength calculation in antennaStore:
    // lambda = 299.792458 / freq = 42.22429
    // legMultiple = Math.round((length / 2) / lambda) = Math.round((84.44858 / 2) / 42.22429) = 1
    // For 2λ: total length should be 2 * 2 * lambda = 168.897 m
    const lambda = 299.792458 / 7.1;
    const lengthFor3Lambda = 3 * 2 * lambda;

    mockAntennaStore(buildMockState({ length: lengthFor3Lambda, frequency: 7.1 }));
    render(<TravelingWaveLegControl />);

    const button3 = screen.getByRole('button', { name: '3λ' });
    expect(button3.classList.contains('active')).toBe(true);
    expect(button3.getAttribute('aria-pressed')).toBe('true');

    const button2 = screen.getByRole('button', { name: '2λ' });
    expect(button2.classList.contains('active')).toBe(false);
    expect(button2.getAttribute('aria-pressed')).toBe('false');
  });

  it('calculates title attributes with total length in meters', () => {
    const frequency = 7.1;
    const lambda = 299.792458 / frequency;
    mockAntennaStore(buildMockState({ frequency }));

    render(<TravelingWaveLegControl />);

    const button2 = screen.getByRole('button', { name: '2λ' });
    const expectedLengthStr = (2 * 2 * lambda).toFixed(1);
    expect(button2.getAttribute('title')).toBe(`Set each leg to 2λ — ${expectedLengthStr} m total`);
  });

  it('calls setLegLengthMultiple with correct number when a button is clicked', () => {
    const setLegLengthMultiple = vi.fn();
    mockAntennaStore(buildMockState({ setLegLengthMultiple }));

    render(<TravelingWaveLegControl />);

    const button5 = screen.getByRole('button', { name: '5λ' });
    fireEvent.click(button5);

    expect(setLegLengthMultiple).toHaveBeenCalledTimes(1);
    expect(setLegLengthMultiple).toHaveBeenCalledWith(5);
  });
});
