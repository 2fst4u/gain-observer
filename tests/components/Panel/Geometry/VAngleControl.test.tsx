import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { VAngleControl } from '../../../../src/components/Panel/Geometry/VAngleControl';
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
    vAngle: 120,
    setVAngle: vi.fn(),
    ...overrides,
  };
}

describe('VAngleControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders null when antennaType is not sloping-v or inverted-v', () => {
    mockAntennaStore(buildMockState({ antennaType: 'dipole' }));
    const { container } = render(<VAngleControl />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly for sloping-v antenna type', () => {
    mockAntennaStore(buildMockState({ antennaType: 'sloping-v', vAngle: 120 }));
    render(<VAngleControl />);

    expect(screen.getByText('V opening angle (°) — 120°')).toBeDefined();

    const slider = screen.getByRole('slider', { name: 'V opening angle in degrees' });
    expect(slider.getAttribute('min')).toBe('10');
    expect(slider.getAttribute('max')).toBe('180');
    expect(slider.getAttribute('step')).toBe('1');
    expect(slider.getAttribute('value')).toBe('120');
    expect(slider.getAttribute('aria-valuetext')).toBe('120°');
  });

  it('renders correctly for inverted-v antenna type', () => {
    mockAntennaStore(buildMockState({ antennaType: 'inverted-v', vAngle: 90 }));
    render(<VAngleControl />);

    expect(screen.getByText('V opening angle (°) — 90°')).toBeDefined();

    const slider = screen.getByRole('slider', { name: 'V opening angle in degrees' });
    expect(slider.getAttribute('value')).toBe('90');
    expect(slider.getAttribute('aria-valuetext')).toBe('90°');
  });

  it('calls setVAngle when slider value changes', () => {
    const setVAngleMock = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'sloping-v', vAngle: 120, setVAngle: setVAngleMock }));
    render(<VAngleControl />);

    const slider = screen.getByRole('slider', { name: 'V opening angle in degrees' });
    fireEvent.change(slider, { target: { value: '75' } });

    expect(setVAngleMock).toHaveBeenCalledWith(75);
  });

  it('ignores NaN slider values safely', () => {
    const setVAngleMock = vi.fn();
    mockAntennaStore(buildMockState({ antennaType: 'sloping-v', vAngle: 120, setVAngle: setVAngleMock }));
    render(<VAngleControl />);

    const slider = screen.getByRole('slider', { name: 'V opening angle in degrees' });
    Object.defineProperty(slider, 'value', { get: () => 'invalid', configurable: true });
    fireEvent.change(slider);

    expect(setVAngleMock).not.toHaveBeenCalled();
  });
});
