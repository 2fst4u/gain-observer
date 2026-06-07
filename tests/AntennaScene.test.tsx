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

vi.mock('../src/components/Scene/AntennaWire', () => ({
  AntennaWire: (props: unknown) => <div data-testid="antenna-wire" data-props={JSON.stringify(props)} />
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

    // AntennaWire should receive live state props
    const antennaWire = getByTestId('antenna-wire');
    const antennaProps = JSON.parse(antennaWire.getAttribute('data-props') || '{}');
    expect(antennaProps.type).toBe('dipole');
    expect(antennaProps.length).toBe(20);
    expect(antennaProps.feedlineId).toBe('coax');

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

    // AntennaWire should receive snapshot state props
    const antennaWire = getByTestId('antenna-wire');
    const antennaProps = JSON.parse(antennaWire.getAttribute('data-props') || '{}');
    expect(antennaProps.type).toBe('vertical-whip');
    expect(antennaProps.length).toBe(5);
    expect(antennaProps.height).toBe(0);
    expect(antennaProps.orientation).toBe('NS');
    expect(antennaProps.feedlineId).toBe('ladder');
    expect(antennaProps.whipCounterpoise).toBe(4);

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
