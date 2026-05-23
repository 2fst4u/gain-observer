import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GroundPlane } from '../src/components/Scene/GroundPlane';
import { useAntennaStore } from '../src/store/antennaStore';
import React from 'react';

// Mock the store
vi.mock('../src/store/antennaStore', () => ({
  useAntennaStore: vi.fn(),
}));

// Mock @react-three/drei
vi.mock('@react-three/drei', () => ({
  Grid: (props: unknown) => <div data-testid="mock-grid" data-props={JSON.stringify(props)} />
}));

// Since the component uses raw string tags like <mesh>, React testing library will try to render them as HTML tags.
// It will give warnings, but we can still query them. Or we can mock the console.error to suppress warnings.
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  cleanup();
});

afterEach(() => {
  console.error = originalError;
});

describe('GroundPlane', () => {
  it('renders correctly with grid visible', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: { theme: string, antennaType: string }) => unknown) => {
      const state = { theme: 'light', antennaType: 'dipole' };
      return selector(state);
    });

    const { container, getByTestId } = render(<GroundPlane groundId="pastoral" height={10} showGrid={true} />);

    const mesh = container.querySelector('mesh');
    expect(mesh).not.toBeNull();

    const grid = getByTestId('mock-grid');
    expect(grid).not.toBeNull();

    const material = container.querySelector('meshstandardmaterial');
    expect(material?.getAttribute('color')).toBe('#ad9468'); // pastoral color
  });

  it('renders nothing when height <= 0 and antenna is not vertical-whip', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: { theme: string, antennaType: string }) => unknown) => {
      const state = { theme: 'light', antennaType: 'dipole' };
      return selector(state);
    });

    const { container } = render(<GroundPlane groundId="pastoral" height={0} showGrid={true} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when height <= 0 and antenna IS vertical-whip', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: { theme: string, antennaType: string }) => unknown) => {
      const state = { theme: 'light', antennaType: 'vertical-whip' };
      return selector(state);
    });

    const { container } = render(<GroundPlane groundId="pastoral" height={0} showGrid={true} />);
    expect(container.innerHTML).not.toBe('');
  });

  it('renders nothing when groundId is "free"', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: { theme: string, antennaType: string }) => unknown) => {
      const state = { theme: 'light', antennaType: 'dipole' };
      return selector(state);
    });

    const { container } = render(<GroundPlane groundId="free" height={10} showGrid={true} />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render grid when showGrid is false', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: { theme: string, antennaType: string }) => unknown) => {
      const state = { theme: 'light', antennaType: 'dipole' };
      return selector(state);
    });

    const { container, queryByTestId } = render(<GroundPlane groundId="pastoral" height={10} showGrid={false} />);
    expect(container.innerHTML).not.toBe('');
    expect(queryByTestId('mock-grid')).toBeNull();
  });
});
