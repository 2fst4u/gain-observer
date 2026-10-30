import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AntennaScene } from '../src/components/Scene/AntennaScene';
import { mockAntennaStore } from './helpers/mockStore';
import { makeComparisonSnapshot, makeSimulationResult } from './helpers/factories';
import { feedlineLossDb, findFeedlinePreset } from '../src/physics/constants';

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

    mockAntennaStore({
        antennaType: 'dipole',
        length: 20,
        frequency: 14.1,
        designFrequency: 7.1,
        terminatingResistor: 0,
        transformerEnabled: false,
        transformerRatio: 1,
        atuEnabled: false,
        atuMainFeedlineLength: 20,
        height: 10,
        orientation: 'EW',
        wireRadius: 0.001,
        segments: 21,
        groundId: 'pastoral',
        result: makeSimulationResult({ maxGainDbi: 2.15 }),
        feedlineId: 'coax',
        feedlineLength: 15,
        feedlineOffset: 0.5,
        whipCounterpoise: false,
        showGrid: true,
        showAxes: false,
        patternScale: 1,
        dbRange: 40,
        colorMaxDb: 0,
        colormap: 'viridis',
        mode: 'normal',
        theme: 'dark',
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
    expect(patternProps.result.maxGainDbi).toBe(2.15);

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

  it('uses captured matching settings and physical design parameters for a reference scene', () => {
    const snapshot = makeComparisonSnapshot({
      frequency: 28.2, designFrequency: 7.1, antennaType: 'folded-dipole',
      transformerEnabled: true, transformerRatio: 16, feedlineId: 'rg58', feedlineLength: 0,
      groundId: 'sea', terminatingResistor: 600,
      result: makeSimulationResult({ maxGainDbi: 5, impedance: { R: 800, X: 0 }, swr: 16 }),
    });
    const { getByTestId } = render(<AntennaScene snapshot={snapshot} />);
    const pattern = JSON.parse(getByTestId('radiation-pattern').getAttribute('data-props')!);
    expect(pattern.realizedGainOffsetDb).toBeCloseTo(-0.2, 10);
    const wire = JSON.parse(getByTestId('antenna-wire').getAttribute('data-props')!);
    expect(wire.frequency).toBe(28.2);
    expect(wire.designFrequency).toBe(7.1);
    expect(wire.groundId).toBe('sea');
    expect(wire.terminatingResistor).toBe(600);
    expect(wire.transformerEnabled).toBe(true);
  });

  it('retains the reference ATU match after live hardware settings change', () => {
    const snapshot = makeComparisonSnapshot({
      transformerEnabled: false, atuEnabled: true, atuMainFeedlineLength: 10,
      feedlineId: 'rg58', feedlineLength: 0,
      result: makeSimulationResult({ maxGainDbi: 5, maxRealizedGainDbi: 5, impedance: { R: 50, X: 0 }, swr: 1 }),
    });
    const { getByTestId, rerender } = render(<AntennaScene snapshot={snapshot} />);
    const initial = JSON.parse(getByTestId('radiation-pattern').getAttribute('data-props')!);
    const expected = -feedlineLossDb(findFeedlinePreset('rg213'), snapshot.frequency, 10);
    expect(initial.realizedGainOffsetDb).toBeCloseTo(expected, 10);
    mockAntennaStore({ transformerEnabled: true, transformerRatio: 9, atuEnabled: false, theme: 'dark' });
    rerender(<AntennaScene snapshot={snapshot} />);
    const updated = JSON.parse(getByTestId('radiation-pattern').getAttribute('data-props')!);
    expect(updated.realizedGainOffsetDb).toBeCloseTo(expected, 10);
  });

  it('shows axes when showAxes is true', () => {
    mockAntennaStore({
        antennaType: 'dipole',
        showAxes: true,
        theme: 'dark',
      });

    const { container } = render(<AntennaScene />);
    expect(container.innerHTML).toContain('<axeshelper'); // axesHelper might be lowercase in DOM
  });
});
