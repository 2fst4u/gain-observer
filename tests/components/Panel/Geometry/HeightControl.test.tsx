import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HeightControl } from '../../../../src/components/Panel/Geometry/HeightControl';
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
    height: 10,
    setHeight: vi.fn(),
    ...overrides,
  };
}

describe('HeightControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders default dipole label and height slider in metric units', () => {
    mockAntennaStore(buildMockState({ height: 10, units: 'metric', antennaType: 'dipole' }));

    render(<HeightControl />);

    expect(screen.getByText('Height above ground (m) — 10.0')).toBeTruthy();
    const slider = screen.getByRole('slider', { name: 'Height above ground' }) as HTMLInputElement;
    expect(slider.value).toBe('10');
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('40');
    expect(slider.step).toBe('0.5');
    expect(slider.getAttribute('aria-valuetext')).toBe('10.0 m');
  });

  it('renders label and aria-label for vertical-whip antenna', () => {
    mockAntennaStore(buildMockState({ height: 5, antennaType: 'vertical-whip' }));

    render(<HeightControl />);

    expect(screen.getByText('Base height above ground (m) — 5.0')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Base height above ground' })).toBeTruthy();
  });

  it('renders label and aria-label for inverted-l antenna', () => {
    mockAntennaStore(buildMockState({ height: 12, antennaType: 'inverted-l' }));

    render(<HeightControl />);

    expect(screen.getByText('Mast / bend-point height (m) — 12.0')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Mast / bend-point height' })).toBeTruthy();
  });

  it('renders label and aria-label for folded-dipole antenna', () => {
    mockAntennaStore(buildMockState({ height: 8, antennaType: 'folded-dipole' }));

    render(<HeightControl />);

    expect(screen.getByText('Bottom conductor height / feedpoint (m) — 8.0')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Bottom conductor height / feedpoint' })).toBeTruthy();
  });

  it('renders correctly in imperial units', () => {
    // 10 meters is approx 32.8084 feet
    mockAntennaStore(buildMockState({ height: 10, units: 'imperial', antennaType: 'dipole' }));

    render(<HeightControl />);

    expect(screen.getByText('Height above ground (ft) — 32.8')).toBeTruthy();
    const slider = screen.getByRole('slider', { name: 'Height above ground' }) as HTMLInputElement;
    expect(slider.max).toBe('131');
    expect(slider.step).toBe('1');
    expect(slider.getAttribute('aria-valuetext')).toBe('32.8 ft');
  });

  it('calls setHeight when slider value changes in metric units', () => {
    const setHeight = vi.fn();
    mockAntennaStore(buildMockState({ height: 10, units: 'metric', setHeight }));

    render(<HeightControl />);

    const slider = screen.getByRole('slider', { name: 'Height above ground' });
    fireEvent.change(slider, { target: { value: '15.5' } });

    expect(setHeight).toHaveBeenCalledWith(15.5);
  });

  it('calls setHeight with converted meters when slider value changes in imperial units', () => {
    const setHeight = vi.fn();
    mockAntennaStore(buildMockState({ height: 10, units: 'imperial', setHeight }));

    render(<HeightControl />);

    const slider = screen.getByRole('slider', { name: 'Height above ground' });
    // Changing to 65.6168 ft (~20 meters)
    fireEvent.change(slider, { target: { value: '65.6168' } });

    expect(setHeight).toHaveBeenCalledWith(expect.closeTo(20, 2));
  });

  it('ignores NaN inputs when slider value is invalid', () => {
    const setHeight = vi.fn();
    mockAntennaStore(buildMockState({ height: 10, setHeight }));

    render(<HeightControl />);

    const slider = screen.getByRole('slider', { name: 'Height above ground' });
    Object.defineProperty(slider, 'value', { get: () => 'invalid', configurable: true });
    fireEvent.change(slider);

    expect(setHeight).not.toHaveBeenCalled();
  });
});
