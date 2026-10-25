import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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

  it('renders default length label and unit in metric mode', () => {
    mockAntennaStore(buildMockState({ units: 'metric', antennaType: 'dipole' }));

    render(<LengthControl />);

    expect(screen.getByText('Length (m)')).toBeTruthy();
    const input = screen.getByRole('spinbutton', { name: 'Length (m)' }) as HTMLInputElement;
    expect(input.value).toBe('20.00');
  });

  it('renders length label and value in imperial mode', () => {
    // 20 meters ≈ 65.6168 feet -> fixed(2) = 65.62
    mockAntennaStore(buildMockState({ units: 'imperial', antennaType: 'dipole', length: 20 }));

    render(<LengthControl />);

    expect(screen.getByText('Length (ft)')).toBeTruthy();
    const input = screen.getByRole('spinbutton', { name: 'Length (ft)' }) as HTMLInputElement;
    expect(input.value).toBe('65.62');
  });

  it('renders custom length labels for specific antenna types', () => {
    // vertical-whip
    mockAntennaStore(buildMockState({ antennaType: 'vertical-whip', units: 'metric' }));
    const { unmount: u1 } = render(<LengthControl />);
    expect(screen.getByText('Whip length (m)')).toBeTruthy();
    u1();

    // inverted-l
    mockAntennaStore(buildMockState({ antennaType: 'inverted-l', units: 'metric' }));
    const { unmount: u2 } = render(<LengthControl />);
    expect(screen.getByText('Total wire length — vertical + horizontal (m)')).toBeTruthy();
    u2();

    // folded-dipole
    mockAntennaStore(buildMockState({ antennaType: 'folded-dipole', units: 'metric' }));
    render(<LengthControl />);
    expect(screen.getByText('Conductor length — ½λ each (m)')).toBeTruthy();
  });

  it('calls setLength when numeric input value changes', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({ units: 'metric', length: 20, setLength }));

    render(<LengthControl />);

    const input = screen.getByRole('spinbutton', { name: 'Length (m)' });
    fireEvent.change(input, { target: { value: '25.5' } });

    expect(setLength).toHaveBeenCalledWith(25.5);
  });

  it('converts display length back to meters when changing value in imperial mode', () => {
    const setLength = vi.fn();
    mockAntennaStore(buildMockState({ units: 'imperial', length: 20, setLength }));

    render(<LengthControl />);

    const input = screen.getByRole('spinbutton', { name: 'Length (ft)' });
    // 100 ft = 30.48 m
    fireEvent.change(input, { target: { value: '100' } });

    expect(setLength).toHaveBeenCalledWith(expect.closeTo(30.48, 2));
  });

  it('renders resonate button and calls setHalfWaveLength when clicked', () => {
    const setHalfWaveLength = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'dipole', setHalfWaveLength }));

    render(<LengthControl />);

    const resonateBtn = screen.getByRole('button', { name: '½λ (Resonate antenna length)' });
    expect(resonateBtn).toBeTruthy();
    expect(resonateBtn.textContent).toBe('½λ');

    fireEvent.click(resonateBtn);

    expect(setHalfWaveLength).toHaveBeenCalledTimes(1);
  });

  it('renders correct resonate button labels for different antenna types', () => {
    // vertical-whip -> ¼λ
    mockAntennaStore(buildMockState({ antennaType: 'vertical-whip' }));
    const { unmount: u1 } = render(<LengthControl />);
    expect(screen.getByRole('button', { name: '¼λ (Resonate antenna length)' })).toBeTruthy();
    u1();

    // delta-loop -> 1λ
    mockAntennaStore(buildMockState({ antennaType: 'delta-loop' }));
    const { unmount: u2 } = render(<LengthControl />);
    expect(screen.getByRole('button', { name: '1λ (Resonate antenna length)' })).toBeTruthy();
    u2();
  });

  it('does not render resonate button for sloping-v antenna type', () => {
    mockAntennaStore(buildMockState({ antennaType: 'sloping-v' }));

    render(<LengthControl />);

    expect(screen.queryByRole('button', { name: /Resonate antenna length/i })).toBeNull();
  });

  it('renders 1.25λ Extended Double Zepp button for dipole and sets length when clicked', () => {
    const setLength = vi.fn();
    const frequency = 7.1; // MHz
    mockAntennaStore(buildMockState({ antennaType: 'dipole', frequency, setLength }));

    render(<LengthControl />);

    const zeppBtn = screen.getByRole('button', { name: '1.25λ Extended Double Zepp preset length' });
    expect(zeppBtn).toBeTruthy();
    expect(zeppBtn.textContent).toBe('1.25λ');

    fireEvent.click(zeppBtn);

    const lambda = 299.792458 / 7.1;
    expect(setLength).toHaveBeenCalledWith(lambda * 1.25);
  });

  it('does not render 1.25λ button for non-dipole antenna types', () => {
    mockAntennaStore(buildMockState({ antennaType: 'inverted-v' }));

    render(<LengthControl />);

    expect(screen.queryByRole('button', { name: '1.25λ Extended Double Zepp preset length' })).toBeNull();
  });
});
