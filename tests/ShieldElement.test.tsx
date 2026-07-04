import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ShieldElement } from '../src/components/Scene/ShieldElement';
import type { RenderedWire } from '../src/components/Scene/useAntennaGeometry';
import * as THREE from 'three';

describe('ShieldElement', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalError: typeof console.error;

  const mockShield: RenderedWire = {
    key: 0,
    tag: 1,
    position: [0, 0, 0],
    quaternion: new THREE.Quaternion(),
    length: 10,
    radius: 0.1,
    sceneStart: [1, 5, 2],
    sceneEnd: [1, 0, 2],
    isShield: true,
    isBridge: false,
  };

  beforeEach(() => {
    cleanup();
    originalError = console.error;
    // Suppress React warnings about custom elements
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((msg, ...args) => {
      if (typeof msg === 'string' && (msg.includes('is unrecognized in this browser') || msg.includes('React does not recognize') || msg.includes('using incorrect casing') || msg.includes('Received'))) {
        return;
      }
      originalError(msg, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('renders rig marker always', () => {
    const { container } = render(<ShieldElement shield={mockShield} transformerEnabled={false} />);

    // Check for boxGeometry
    const boxGeometry = container.querySelector('boxgeometry');
    expect(boxGeometry).toBeTruthy();
    expect(boxGeometry?.getAttribute('args')).toBe('0.4,0.25,0.5');

    // Should only have 1 mesh
    const meshes = container.querySelectorAll('mesh');
    expect(meshes.length).toBe(1);
    expect(meshes[0]?.getAttribute('position')).toBe('1,0,2'); // shield.sceneEnd
  });

  it('renders transformer choke marker when enabled', () => {
    const { container } = render(<ShieldElement shield={mockShield} transformerEnabled={true} />);

    // Check for torusGeometry
    const torusGeometry = container.querySelector('torusgeometry');
    expect(torusGeometry).toBeTruthy();
    expect(torusGeometry?.getAttribute('args')).toBe('0.18,0.07,12,24');

    // Should have 2 meshes
    const meshes = container.querySelectorAll('mesh');
    expect(meshes.length).toBe(2);

    // Torus mesh position
    // length = 10 -> length * 0.05 = 0.5
    // Math.max(0.15, 0.5) = 0.5
    // Math.min(0.4, 0.5) = 0.4
    // Y position = sceneStart[1] - 0.4 = 5 - 0.4 = 4.6
    expect(meshes[0]?.getAttribute('position')).toBe('1,4.6,2');
    expect(meshes[0]?.getAttribute('rotation')).toBe(`${Math.PI / 2},0,0`);
  });

  it('calculates transformer position correctly for short wires', () => {
    const shortShield = { ...mockShield, length: 2 }; // length * 0.05 = 0.1, max(0.15, 0.1) = 0.15, min(0.4, 0.15) = 0.15
    const { container } = render(<ShieldElement shield={shortShield} transformerEnabled={true} />);

    const meshes = container.querySelectorAll('mesh');
    // Y = 5 - 0.15 = 4.85
    expect(meshes[0]?.getAttribute('position')).toBe('1,4.85,2');
  });

  it('calculates transformer position correctly for long wires', () => {
    const longShield = { ...mockShield, length: 20 }; // length * 0.05 = 1.0, max(0.15, 1.0) = 1.0, min(0.4, 1.0) = 0.4
    const { container } = render(<ShieldElement shield={longShield} transformerEnabled={true} />);

    const meshes = container.querySelectorAll('mesh');
    // Y = 5 - 0.4 = 4.6
    expect(meshes[0]?.getAttribute('position')).toBe('1,4.6,2');
  });
});
