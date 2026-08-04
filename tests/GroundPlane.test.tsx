import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GroundPlane } from '../src/components/Scene/GroundPlane';
import { mockAntennaStore } from './helpers/mockStore';
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
    mockAntennaStore({ theme: 'light', antennaType: 'dipole' });

    const { container, getByTestId } = render(<GroundPlane groundId="pastoral" height={10} showGrid={true} antennaType="dipole" />);

    const mesh = container.querySelector('mesh');
    expect(mesh).not.toBeNull();

    const grid = getByTestId('mock-grid');
    expect(grid).not.toBeNull();

    const material = container.querySelector('meshstandardmaterial');
    expect(material?.getAttribute('color')).toBe('#ad9468'); // pastoral color
  });

  it('renders nothing when height <= 0 and antenna is not vertical-whip', () => {
    mockAntennaStore({ theme: 'light', antennaType: 'dipole' });

    const { container } = render(<GroundPlane groundId="pastoral" height={0} showGrid={true} antennaType="dipole" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when height <= 0 and antenna IS vertical-whip', () => {
    mockAntennaStore({ theme: 'light', antennaType: 'vertical-whip' });

    const { container } = render(<GroundPlane groundId="pastoral" height={0} showGrid={true} antennaType="vertical-whip" />);
    expect(container.innerHTML).not.toBe('');
  });

  it('renders when height <= 0 and antenna IS inverted-l', () => {
    mockAntennaStore({ theme: 'light' });

    const { container } = render(<GroundPlane groundId="pastoral" height={0} showGrid={true} antennaType="inverted-l" />);
    expect(container.innerHTML).not.toBe('');
  });

  it('renders nothing when groundId is "free"', () => {
    mockAntennaStore({ theme: 'light', antennaType: 'dipole' });

    const { container } = render(<GroundPlane groundId="free" height={10} showGrid={true} antennaType="dipole" />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render grid when showGrid is false', () => {
    mockAntennaStore({ theme: 'light', antennaType: 'dipole' });

    const { container, queryByTestId } = render(<GroundPlane groundId="pastoral" height={10} showGrid={false} antennaType="dipole" />);
    expect(container.innerHTML).not.toBe('');
    expect(queryByTestId('mock-grid')).toBeNull();
  });
});
