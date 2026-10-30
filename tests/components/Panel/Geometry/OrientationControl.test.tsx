import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OrientationControl } from '../../../../src/components/Panel/Geometry/OrientationControl';
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
    antennaType: 'dipole',
    orientation: 'EW',
    setOrientation: vi.fn(),
    ...overrides,
  };
}

describe('OrientationControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when antennaType is vertical-whip', () => {
    mockAntennaStore(buildMockState({ antennaType: 'vertical-whip' }));
    const { container } = render(<OrientationControl />);
    expect(container.firstChild).toBeNull();
  });

  it('renders standard orientation controls for dipole antenna', () => {
    mockAntennaStore(buildMockState({ antennaType: 'dipole', orientation: 'EW' }));
    render(<OrientationControl />);

    expect(screen.getByText('Orientation (°)')).toBeDefined();

    const group = screen.getByRole('group', { name: 'Orientation presets' });
    expect(group).toBeDefined();

    const input = document.getElementById('dipole-orientation') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('90');

    const ewButton = screen.getByRole('button', { name: 'EW' });
    expect(ewButton.getAttribute('aria-pressed')).toBe('true');
    expect(ewButton.classList.contains('active')).toBe(true);

    const nsButton = screen.getByRole('button', { name: 'NS' });
    expect(nsButton.getAttribute('aria-pressed')).toBe('false');
    expect(nsButton.classList.contains('active')).toBe(false);
  });

  it('renders inverted-l specific controls and labels', () => {
    mockAntennaStore(buildMockState({ antennaType: 'inverted-l', orientation: 'NS' }));
    render(<OrientationControl />);

    expect(screen.getByText('Horizontal section direction (°)')).toBeDefined();

    const group = screen.getByRole('group', { name: 'Horizontal section direction presets' });
    expect(group).toBeDefined();

    const input = document.getElementById('inverted-l-orientation') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('0');
  });

  it('handles custom numeric degree values correctly for preset buttons and input', () => {
    mockAntennaStore(buildMockState({ orientation: 135 }));
    render(<OrientationControl />);

    const input = document.getElementById('dipole-orientation') as HTMLInputElement;
    expect(input.value).toBe('135');

    // With a numeric custom orientation (135), none of the preset buttons should be active
    const presets = ['NS', 'EW', 'NE-SW', 'NW-SE'];
    presets.forEach((p) => {
      const btn = screen.getByRole('button', { name: p });
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  it('correctly maps all orientation preset string degrees', () => {
    const testCases: Array<{ preset: 'NS' | 'EW' | 'NE-SW' | 'NW-SE'; degrees: string }> = [
      { preset: 'NS', degrees: '0' },
      { preset: 'EW', degrees: '90' },
      { preset: 'NE-SW', degrees: '45' },
      { preset: 'NW-SE', degrees: '315' },
    ];

    testCases.forEach(({ preset, degrees }) => {
      mockAntennaStore(buildMockState({ orientation: preset }));
      const { unmount } = render(<OrientationControl />);

      const input = document.getElementById('dipole-orientation') as HTMLInputElement;
      expect(input.value).toBe(degrees);

      const activeBtn = screen.getByRole('button', { name: preset });
      expect(activeBtn.getAttribute('aria-pressed')).toBe('true');

      unmount();
    });
  });

  it('calls setOrientation when changing the numeric input', () => {
    const setOrientation = vi.fn();
    mockAntennaStore(buildMockState({ orientation: 'EW', setOrientation }));
    render(<OrientationControl />);

    const input = document.getElementById('dipole-orientation') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '180' } });

    expect(setOrientation).toHaveBeenCalledWith(180);
  });

  it('calls setOrientation when preset buttons are clicked', () => {
    const setOrientation = vi.fn();
    mockAntennaStore(buildMockState({ orientation: 'EW', setOrientation }));
    render(<OrientationControl />);

    const neswButton = screen.getByRole('button', { name: 'NE-SW' });
    fireEvent.click(neswButton);

    expect(setOrientation).toHaveBeenCalledWith('NE-SW');
  });
});
