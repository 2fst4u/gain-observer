import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ApertureControl } from '../../../../src/components/Panel/Geometry/ApertureControl';
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
    antennaType: 'folded-dipole',
    foldedDipoleAperture: 0.1,
    wireRadius: 0.001,
    setFoldedDipoleAperture: vi.fn(),
    ...overrides,
  };
}

describe('ApertureControl', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when antennaType is not folded-dipole', () => {
    mockAntennaStore(buildMockState({ antennaType: 'dipole' }));

    const { container } = render(<ApertureControl />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly for folded-dipole in metric units', () => {
    mockAntennaStore(buildMockState());

    render(<ApertureControl />);

    expect(screen.getByText(/Conductor spacing \/ aperture \(m\) — 0\.10/i)).toBeDefined();

    const slider = screen.getByRole('slider', { name: 'Folded dipole conductor spacing' }) as HTMLInputElement;
    expect(slider).toBeDefined();
    expect(slider.min).toBe('0.02');
    expect(slider.step).toBe('0.01');
    expect(slider.value).toBe('0.1');
    expect(slider.getAttribute('aria-valuetext')).toBe('0.10 m');
    expect(slider.getAttribute('aria-describedby')).toBe('folded-dipole-aperture-hint');

    const hint = screen.getByText(/Vertical spacing between the bottom \(fed\) and top \(un-fed\) conductors/i);
    expect(hint).toBeDefined();
  });

  it('renders correctly for folded-dipole in imperial units', () => {
    mockAntennaStore(
      buildMockState({
        units: 'imperial',
        foldedDipoleAperture: 0.1,
      })
    );

    render(<ApertureControl />);

    expect(screen.getByText(/Conductor spacing \/ aperture \(ft\) — 0\.33/i)).toBeDefined();

    const slider = screen.getByRole('slider', { name: 'Folded dipole conductor spacing' }) as HTMLInputElement;
    expect(slider.step).toBe('0.05');
  });

  it('calls setFoldedDipoleAperture when slider changes value', () => {
    const setFoldedDipoleAperture = vi.fn();
    mockAntennaStore(buildMockState({ setFoldedDipoleAperture }));

    render(<ApertureControl />);

    const slider = screen.getByRole('slider', { name: 'Folded dipole conductor spacing' });
    fireEvent.change(slider, { target: { value: '0.15' } });

    expect(setFoldedDipoleAperture).toHaveBeenCalledWith(0.15);
  });

  it('converts display values back to meters in imperial units on change', () => {
    const setFoldedDipoleAperture = vi.fn();
    mockAntennaStore(buildMockState({ units: 'imperial', setFoldedDipoleAperture }));

    render(<ApertureControl />);

    const slider = screen.getByRole('slider', { name: 'Folded dipole conductor spacing' });
    fireEvent.change(slider, { target: { value: '1.0' } });

    expect(setFoldedDipoleAperture).toHaveBeenCalledWith(expect.closeTo(0.3048, 4));
  });

  it('safely ignores invalid non-numeric slider change values', () => {
    const setFoldedDipoleAperture = vi.fn();
    mockAntennaStore(buildMockState({ setFoldedDipoleAperture }));

    render(<ApertureControl />);

    const slider = screen.getByRole('slider', { name: 'Folded dipole conductor spacing' });
    Object.defineProperty(slider, 'value', { get: () => 'invalid', configurable: true });
    fireEvent.change(slider);

    expect(setFoldedDipoleAperture).not.toHaveBeenCalled();
  });
});
