import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LengthControl } from '../../../../src/components/Panel/Geometry/LengthControl';
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
    units: 'metric',
    antennaType: 'dipole',
    length: 20,
    frequency: 7.1,
    setLength: vi.fn(),
    setHalfWaveLength: vi.fn(),
    ...overrides,
  };
}

describe('LengthControl', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders correct label for default dipole in metric units', () => {
    mockAntennaStore(buildMockState());

    render(<LengthControl />);

    expect(screen.getByText('Length (m)')).toBeDefined();
    const input = document.getElementById('dipole-length') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('20.00');
  });

  it('renders correct labels for various antenna types', () => {
    // Vertical Whip
    mockAntennaStore(buildMockState({ antennaType: 'vertical-whip' }));
    const { unmount: unmount1 } = render(<LengthControl />);
    expect(screen.getByText('Whip length (m)')).toBeDefined();
    unmount1();

    // Inverted-L
    mockAntennaStore(buildMockState({ antennaType: 'inverted-l' }));
    const { unmount: unmount2 } = render(<LengthControl />);
    expect(screen.getByText('Total wire length — vertical + horizontal (m)')).toBeDefined();
    unmount2();

    // Folded Dipole
    mockAntennaStore(buildMockState({ antennaType: 'folded-dipole' }));
    render(<LengthControl />);
    expect(screen.getByText('Conductor length — ½λ each (m)')).toBeDefined();
  });

  it('renders imperial unit in label and converts value', () => {
    // 20 m = 65.6168 ft
    mockAntennaStore(buildMockState({ units: 'imperial', length: 20 }));

    render(<LengthControl />);

    expect(screen.getByText('Length (ft)')).toBeDefined();
    const input = document.getElementById('dipole-length') as HTMLInputElement;
    expect(input.value).toBe('65.62');
  });

  it('triggers setLength with converted value when input changes', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({ setLength }));

    render(<LengthControl />);

    const input = document.getElementById('dipole-length') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25.5' } });

    expect(setLength).toHaveBeenCalledWith(25.5);
  });

  it('triggers setLength with metric conversion when unit is imperial', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({ units: 'imperial', setLength }));

    render(<LengthControl />);

    const input = document.getElementById('dipole-length') as HTMLInputElement;
    // 100 ft = ~30.48 m
    fireEvent.change(input, { target: { value: '100' } });

    expect(setLength).toHaveBeenCalledTimes(1);
    expect(setLength.mock.calls[0][0]).toBeCloseTo(30.48, 2);
  });

  it('renders resonate button with correct label and calls setHalfWaveLength', () => {
    const setHalfWaveLength = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'dipole', setHalfWaveLength }));

    render(<LengthControl />);

    const button = screen.getByRole('button', { name: /Resonate antenna length/i });
    expect(button.textContent).toBe('½λ');

    fireEvent.click(button);
    expect(setHalfWaveLength).toHaveBeenCalledTimes(1);
  });

  it('renders ¼λ resonate button label for vertical-whip and inverted-l', () => {
    mockAntennaStore(buildMockState({ antennaType: 'vertical-whip' }));

    const { unmount } = render(<LengthControl />);
    const whipButton = screen.getByRole('button', { name: /Resonate antenna length/i });
    expect(whipButton.textContent).toBe('¼λ');
    unmount();

    mockAntennaStore(buildMockState({ antennaType: 'inverted-l' }));
    render(<LengthControl />);
    const lButton = screen.getByRole('button', { name: /Resonate antenna length/i });
    expect(lButton.textContent).toBe('¼λ');
  });

  it('renders 1λ resonate button label for delta-loop and terminated-delta', () => {
    mockAntennaStore(buildMockState({ antennaType: 'delta-loop' }));

    const { unmount } = render(<LengthControl />);
    const deltaButton = screen.getByRole('button', { name: /Resonate antenna length/i });
    expect(deltaButton.textContent).toBe('1λ');
    unmount();

    mockAntennaStore(buildMockState({ antennaType: 'terminated-delta' }));
    render(<LengthControl />);
    const termButton = screen.getByRole('button', { name: /Resonate antenna length/i });
    expect(termButton.textContent).toBe('1λ');
  });

  it('omits resonate button for sloping-v antenna type', () => {
    mockAntennaStore(buildMockState({ antennaType: 'sloping-v' }));

    render(<LengthControl />);

    expect(screen.queryByRole('button', { name: /Resonate antenna length/i })).toBeNull();
  });

  it('renders Extended Double Zepp button for dipole and calls setLength with 1.25λ', () => {
    const setLength = vi.fn();
    // frequency = 7.1 MHz -> lambda = 299.792458 / 7.1 ≈ 42.22428988 m
    // 1.25 * lambda ≈ 52.78036 m
    mockAntennaStore(buildMockState({ antennaType: 'dipole', frequency: 7.1, setLength }));

    render(<LengthControl />);

    const zeppButton = screen.getByRole('button', { name: /Extended Double Zepp/i });
    expect(zeppButton).toBeDefined();
    expect(zeppButton.textContent).toBe('1.25λ');

    fireEvent.click(zeppButton);
    expect(setLength).toHaveBeenCalledTimes(1);
    expect(setLength.mock.calls[0][0]).toBeCloseTo(52.78, 2);
  });

  it('omits Extended Double Zepp button for non-dipole antenna types', () => {
    mockAntennaStore(buildMockState({ antennaType: 'inverted-v' }));

    render(<LengthControl />);

    expect(screen.queryByRole('button', { name: /Extended Double Zepp/i })).toBeNull();
  });
});
