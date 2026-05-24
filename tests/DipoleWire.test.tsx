import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { DipoleWire } from '../src/components/Scene/DipoleWire';
import { useAntennaStore } from '../src/store/antennaStore';

// Mock specific three.js components to avoid jsdom warnings
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));

vi.mock('../src/store/antennaStore', async () => {
  const actual = await vi.importActual('../src/store/antennaStore');
  return {
    ...actual,
    useAntennaStore: vi.fn(),
  };
});

describe('DipoleWire', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanup();
    // Suppress React warnings about custom elements used in Canvas
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((msg, ...args) => {
      if (typeof msg === 'string' && (msg.includes('is unrecognized in this browser') || msg.includes('React does not recognize') || msg.includes('using incorrect casing') || msg.includes('Received'))) {
        return;
      }
      console.warn(msg, ...args);
    });

    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        theme: 'dark',
        transformerEnabled: false,
        terminatingResistor: 0,
        vAngle: 120,
        legSlope: 0,
        frequency: 14.1,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('renders a basic dipole wire', () => {
    const { container } = render(
      <DipoleWire
        type="dipole"
        length={10}
        height={5}
        orientation="EW"
        wireRadius={0.001}
        segments={11}
        feedlineId="none"
        feedlineLength={0}
        feedlineOffset={0.5}
        whipCounterpoise={false}
      />
    );

    // Should render a group containing the wire and feedpoint
    expect(container.querySelector('group')).toBeTruthy();
    expect(container.querySelectorAll('mesh').length).toBeGreaterThan(0);
    // 1 mesh for wire, 1 for feedpoint
    expect(container.querySelector('spheregeometry')).toBeTruthy();
    expect(container.querySelector('cylindergeometry')).toBeTruthy();
  });

  it('renders a terminated delta split wire', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        theme: 'dark',
        transformerEnabled: false,
        terminatingResistor: 500, // Non-zero terminating resistor
        vAngle: 120,
        legSlope: 0,
        frequency: 14.1,
      };
      return selector(state);
    });

    const { container } = render(
      <DipoleWire
        type="terminated-delta"
        length={20}
        height={10}
        orientation="EW"
        wireRadius={0.001}
        segments={21}
        feedlineId="none"
        feedlineLength={0}
        feedlineOffset={0.5}
        whipCounterpoise={false}
      />
    );

    expect(container.querySelector('group')).toBeTruthy();
    const meshes = container.querySelectorAll('mesh');
    expect(meshes.length).toBeGreaterThan(0);
  });

  it('renders a feedline shield and transformer', () => {
    vi.mocked(useAntennaStore).mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        theme: 'dark',
        transformerEnabled: true,
        terminatingResistor: 0,
        vAngle: 120,
        legSlope: 0,
        frequency: 14.1,
      };
      return selector(state);
    });

    const { container } = render(
      <DipoleWire
        type="dipole"
        length={10}
        height={5}
        orientation="EW"
        wireRadius={0.001}
        segments={11}
        feedlineId="rg58" // Use a real feedlineId to enable shield
        feedlineLength={10}
        feedlineOffset={0.5}
        whipCounterpoise={false}
      />
    );

    expect(container.querySelector('torusgeometry')).toBeTruthy(); // transformer
    expect(container.querySelector('boxgeometry')).toBeTruthy(); // rig marker
  });
});
