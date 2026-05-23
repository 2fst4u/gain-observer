import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RadiationPattern } from '../src/components/Scene/RadiationPattern';
import type { SimulationResult } from '../src/physics/types';

// Suppress console errors about unknown lowercase HTML elements that are expected in React-Three-Fiber.
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0];
  if (typeof message === 'string' && (
    message.includes('is using incorrect casing') ||
    message.includes('is unrecognized in this browser') ||
    message.includes('React does not recognize the') ||
    message.includes('Received') // Covers the non-boolean attribute transparent warning
  )) {
    return;
  }
  originalConsoleError(...args);
};

// Mock R3F elements since JSDOM doesn't support them natively
vi.mock('@react-three/fiber', () => ({
  useFrame: () => {},
  useThree: () => ({ camera: {}, scene: {} }),
}));

describe('RadiationPattern', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing when result is null', () => {
    const { container } = render(
      <RadiationPattern
        result={null}
        patternScale={1}
        dbRange={40}
        colorMaxDb={10}
        colormap="turbo"
        mode="dx"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders mesh with geometry when valid result is provided', () => {
    const thetaSteps = 37;
    const phiSteps = 72;
    const mockResult = {
      pattern: {
        data: new Float32Array(thetaSteps * phiSteps).fill(-10),
        dTheta: 5,
        dPhi: 5,
        thetaSteps,
        phiSteps,
      }
    } as unknown as SimulationResult; // Cast to exact type

    const { container } = render(
      <RadiationPattern
        result={mockResult}
        patternScale={1}
        dbRange={40}
        colorMaxDb={10}
        colormap="turbo"
        mode="dx"
      />
    );

    // We expect the custom R3F elements to be in the DOM as lowercase tags.
    const mesh = container.querySelector('mesh');
    expect(mesh).not.toBeNull();

    const material = container.querySelector('meshstandardmaterial');
    expect(material).not.toBeNull();
  });

  it('handles NVIS mode specific color adjustments', () => {
    const thetaSteps = 37;
    const phiSteps = 72;
    const mockResult = {
      pattern: {
        data: new Float32Array(thetaSteps * phiSteps).fill(5),
        dTheta: 5,
        dPhi: 5,
        thetaSteps,
        phiSteps,
      }
    } as unknown as SimulationResult; // Cast to exact type

    const { container } = render(
      <RadiationPattern
        result={mockResult}
        patternScale={1}
        dbRange={40}
        colorMaxDb={10}
        colormap="turbo"
        mode="nvis"
      />
    );

    const mesh = container.querySelector('mesh');
    expect(mesh).not.toBeNull();
  });
});
