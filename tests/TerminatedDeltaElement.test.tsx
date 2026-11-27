import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RESISTOR_MIN_VISUAL_LENGTH_M, TerminatedDeltaElement } from '../src/components/Scene/TerminatedDeltaElement';
import * as THREE from 'three';

describe('TerminatedDeltaElement', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanup();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((msg, ...args) => {
      if (typeof msg === 'string' && (
        msg.includes('is unrecognized in this browser') ||
        msg.includes('React does not recognize') ||
        msg.includes('using incorrect casing') ||
        msg.includes('Received')
      )) {
        return;
      }
      console.warn(msg, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  const mockSplit = {
    leftInner: [1, 0, 0] as [number, number, number],
    rightInner: [-1, 0, 0] as [number, number, number],
    bridgeMid: [0, 0, 0] as [number, number, number],
    bridgeLen: 2,
    bridgeQuat: new THREE.Quaternion(),
    resistorRadius: 0.1,
  };

  it('renders spheres at inner ends', () => {
    const { container } = render(
      <TerminatedDeltaElement
        split={mockSplit}
        color="#e8e8e8"
        terminatingResistor={0}
      />
    );

    const spheres = container.querySelectorAll('spheregeometry');
    expect(spheres).toHaveLength(2);

    const cylinders = container.querySelectorAll('cylindergeometry');
    expect(cylinders).toHaveLength(0);
  });

  it('renders the resistor in place of the gap markers when terminatingResistor > 0', () => {
    const { container } = render(
      <TerminatedDeltaElement
        split={mockSplit}
        color="#e8e8e8"
        terminatingResistor={500}
      />
    );

    expect(container.querySelectorAll('spheregeometry')).toHaveLength(0);
    const cylinders = container.querySelectorAll('cylindergeometry');
    expect(cylinders).toHaveLength(1);
  });

  it('draws the resistor at least RESISTOR_MIN_VISUAL_LENGTH_M long, centred on the gap', () => {
    // The real 0.1 m gap is smaller than the marker spheres; the body is
    // drawn longer, at the gap's midpoint, so it stays visible.
    const { container } = render(
      <TerminatedDeltaElement
        split={{ ...mockSplit, bridgeLen: 0.1, bridgeMid: [0, 0.5, 0] }}
        color="#e8e8e8"
        terminatingResistor={600}
      />
    );
    const mesh = container.querySelector('cylindergeometry')!.parentElement!;
    const args = container.querySelector('cylindergeometry')!.getAttribute('args');
    expect(args?.split(',').map(Number)[2]).toBe(RESISTOR_MIN_VISUAL_LENGTH_M);
    expect(mesh.getAttribute('position')).toBe('0,0.5,0');
  });

  it('does not render the resistor bridge if bridgeLen is too small', () => {
    const { container } = render(
      <TerminatedDeltaElement
        split={{ ...mockSplit, bridgeLen: 0.0001 }}
        color="#e8e8e8"
        terminatingResistor={500}
      />
    );

    const cylinders = container.querySelectorAll('cylindergeometry');
    expect(cylinders).toHaveLength(0);
  });
});
