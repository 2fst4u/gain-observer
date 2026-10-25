import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LengthControl } from '../../../../src/components/Panel/Geometry/LengthControl';
import { mockAntennaStore, type MockAntennaState } from '../../../helpers/mockStore';

// Mock the store module
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
    frequency: 14.15,
    setLength: vi.fn(),
    setHalfWaveLength: vi.fn(),
    ...overrides,
  };
}

describe('LengthControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders standard dipole label and display value in metric units', () => {
    mockAntennaStore(buildMockState({
      units: 'metric',
      antennaType: 'dipole',
      length: 20,
    }));

    render(<LengthControl />);

    expect(screen.getByText('Length (m)')).toBeDefined();
    const input = document.getElementById('dipole-length') as HTMLInputElement;
    expect(input.value).toBe('20.00');
  });

  it('renders converted length in imperial units (ft)', () => {
    mockAntennaStore(buildMockState({
      units: 'imperial',
      antennaType: 'dipole',
      length: 10, // 10 m * 3.28084 ≈ 32.81 ft
    }));

    render(<LengthControl />);

    expect(screen.getByText('Length (ft)')).toBeDefined();
    const input = document.getElementById('dipole-length') as HTMLInputElement;
    expect(input.value).toBe('32.81');
  });

  it('renders custom labels for vertical-whip, inverted-l, and folded-dipole', () => {
    // Vertical whip
    mockAntennaStore(buildMockState({ antennaType: 'vertical-whip' }));
    const { unmount: unmountWhip } = render(<LengthControl />);
    expect(screen.getByText('Whip length (m)')).toBeDefined();
    unmountWhip();

    // Inverted-L
    mockAntennaStore(buildMockState({ antennaType: 'inverted-l' }));
    const { unmount: unmountL } = render(<LengthControl />);
    expect(screen.getByText('Total wire length — vertical + horizontal (m)')).toBeDefined();
    unmountL();

    // Folded dipole
    mockAntennaStore(buildMockState({ antennaType: 'folded-dipole' }));
    render(<LengthControl />);
    expect(screen.getByText('Conductor length — ½λ each (m)')).toBeDefined();
  });

  it('calls setLength when numeric input changes (converting imperial back to metric)', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({
      units: 'imperial',
      setLength,
    }));

    render(<LengthControl />);

    const input = document.getElementById('dipole-length') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '32.8084' } }); // ~10m

    expect(setLength).toHaveBeenCalledWith(expect.closeTo(10, 2));
  });

  it('renders resonate button with correct label and title, and triggers setHalfWaveLength on click', () => {
    const setHalfWaveLength = vi.fn();
    mockAntennaStore(buildMockState({
      antennaType: 'vertical-whip',
      setHalfWaveLength,
    }));

    render(<LengthControl />);

    const resonateButton = screen.getByRole('button', { name: /¼λ \(Resonate antenna length\)/i });
    expect(resonateButton.textContent).toBe('¼λ');
    fireEvent.click(resonateButton);

    expect(setHalfWaveLength).toHaveBeenCalledTimes(1);
  });

  it('omits resonate button for sloping-v antenna type', () => {
    mockAntennaStore(buildMockState({ antennaType: 'sloping-v' }));

    render(<LengthControl />);

    expect(screen.queryByRole('button', { name: /Resonate antenna length/i })).toBeNull();
  });

  it('renders 1.25λ Extended Double Zepp button for dipole and updates length on click', () => {
    const setLength = vi.fn();
    const frequency = 10; // lambda = 299.792458 / 10 = 29.9792458 m, * 1.25 = ~37.474 m
    mockAntennaStore(buildMockState({
      antennaType: 'dipole',
      frequency,
      setLength,
    }));

    render(<LengthControl />);

    const zeppButton = screen.getByRole('button', { name: '1.25λ Extended Double Zepp preset length' });
    expect(zeppButton).toBeDefined();

    fireEvent.click(zeppButton);
    expect(setLength).toHaveBeenCalledWith(expect.closeTo(37.474, 2));
  });

  it('does not render 1.25λ Extended Double Zepp button for non-dipole antenna types', () => {
    mockAntennaStore(buildMockState({ antennaType: 'inverted-v' }));

    render(<LengthControl />);

    expect(screen.queryByRole('button', { name: '1.25λ Extended Double Zepp preset length' })).toBeNull();
  });
});
