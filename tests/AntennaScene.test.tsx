import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AntennaScene } from '../src/components/Scene/AntennaScene';
import { useAntennaStore } from '../src/store/antennaStore';
import React from 'react';

// Mock specific three.js components to avoid jsdom warnings
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  GizmoHelper: ({ children }: { children: React.ReactNode }) => <div data-testid="gizmo-helper">{children}</div>,
  GizmoViewport: () => <div data-testid="gizmo-viewport" />,
}));

vi.mock('../src/components/Scene/DipoleWire', () => ({
  DipoleWire: (props: unknown) => <div data-testid="dipole-wire" data-props={JSON.stringify(props)} />
}));

vi.mock('../src/components/Scene/GroundPlane', () => ({
  GroundPlane: (props: unknown) => <div data-testid="ground-plane" data-props={JSON.stringify(props)} />
}));

vi.mock('../src/components/Scene/RadiationPattern', () => ({
  RadiationPattern: (props: unknown) => <div data-testid="radiation-pattern" data-props={JSON.stringify(props)} />
}));

vi.mock('../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

describe('AntennaScene', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanup();
    // Suppress React warnings about custom elements used in Canvas
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((msg) => {
      if (typeof msg === 'string' && (msg.includes('is unrecognized in this browser') || msg.includes('React does not recognize') || msg.includes('using incorrect casing'))) {
        return;
      }
      console.warn(msg); // log others as warn to see them
    });

    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        antennaType: 'dipole',
        length: 20,
        height: 10,
        orientation: 'EW',
        wireRadius: 0.001,
        segments: 21,
        groundId: 'pastoral',
        result: { maxGainDbi: 2.15 },
        feedlineId: 'coax',
        feedlineLength: 15,
        feedlineOffset: 0.5,
        whipCounterpoise: 0,
        showGrid: true,
        showAxes: false,
        patternScale: 1,
        dbRange: 40,
        colorMaxDb: 0,
        colormap: 'viridis',
        mode: 'standard',
        theme: 'dark',
      };
      return selector(state);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('renders correctly with live state', () => {
    const { getByTestId } = render(<AntennaScene />);
    expect(getByTestId('canvas')).toBeTruthy();

    // DipoleWire should receive live state props
    const dipoleWire = getByTestId('dipole-wire');
    const dipoleProps = JSON.parse(dipoleWire.getAttribute('data-props') || '{}');
    expect(dipoleProps.type).toBe('dipole');
    expect(dipoleProps.length).toBe(20);
    expect(dipoleProps.feedlineId).toBe('coax');

    // RadiationPattern should receive live state props
    const radiationPattern = getByTestId('radiation-pattern');
    const patternProps = JSON.parse(radiationPattern.getAttribute('data-props') || '{}');
    expect(patternProps.result).toEqual({ maxGainDbi: 2.15 });

    // GroundPlane should receive live state props
    const groundPlane = getByTestId('ground-plane');
    const groundProps = JSON.parse(groundPlane.getAttribute('data-props') || '{}');
    expect(groundProps.groundId).toBe('pastoral');
    expect(groundProps.showGrid).toBe(true);
  });

  it('renders correctly with snapshot state overrides', () => {
    const snapshot = {
      antennaType: 'vertical-whip',
      length: 5,
      height: 0,
      orientation: 'NS',
      wireRadius: 0.002,
      segments: 10,
      groundId: 'sea',
      result: { maxGainDbi: 5.0 },
      feedlineId: 'ladder',
      feedlineLength: 10,
      feedlineOffset: 0,
      whipCounterpoise: 4,
      capturedAt: Date.now(),
      frequency: 14.1,
    };

    const { getByTestId } = render(<AntennaScene snapshot={snapshot as unknown as import('../src/store/antennaStore').ComparisonSnapshot} />);

    // DipoleWire should receive snapshot state props
    const dipoleWire = getByTestId('dipole-wire');
    const dipoleProps = JSON.parse(dipoleWire.getAttribute('data-props') || '{}');
    expect(dipoleProps.type).toBe('vertical-whip');
    expect(dipoleProps.length).toBe(5);
    expect(dipoleProps.height).toBe(0);
    expect(dipoleProps.orientation).toBe('NS');
    expect(dipoleProps.feedlineId).toBe('ladder');
    expect(dipoleProps.whipCounterpoise).toBe(4);

    // RadiationPattern should receive snapshot state props
    const radiationPattern = getByTestId('radiation-pattern');
    const patternProps = JSON.parse(radiationPattern.getAttribute('data-props') || '{}');
    expect(patternProps.result).toEqual({ maxGainDbi: 5.0 });
    expect(patternProps.originY).toBe(0); // height from snapshot

    // GroundPlane should receive snapshot state props
    const groundPlane = getByTestId('ground-plane');
    const groundProps = JSON.parse(groundPlane.getAttribute('data-props') || '{}');
    expect(groundProps.groundId).toBe('sea');
  });

  it('shows axes when showAxes is true', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        antennaType: 'dipole',
        showAxes: true,
        theme: 'dark',
      };
      return selector(state);
    });

    const { container } = render(<AntennaScene />);
    expect(container.innerHTML).toContain('<axeshelper'); // axesHelper might be lowercase in DOM
  });
});
