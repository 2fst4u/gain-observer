import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AntennaElement } from '../src/components/Scene/AntennaElement';
import { THEME_COLORS } from '../src/utils/themeColors';
import * as THREE from 'three';
import React from 'react';

// Mock specific three.js components to avoid jsdom warnings
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));

describe('AntennaElement', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  const defaultWire = {
    key: 1,
    tag: 1,
    position: [0, 0, 0] as [number, number, number],
    quaternion: new THREE.Quaternion(),
    length: 10,
    radius: 0.1,
    sceneStart: [0, 0, 0] as [number, number, number],
    sceneEnd: [10, 0, 0] as [number, number, number],
    isShield: false,
    isBridge: false,
  };

  beforeEach(() => {
    cleanup();
    // Suppress React warnings about custom elements used in Canvas
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((msg, ...args) => {
      if (typeof msg === 'string' && (msg.includes('is unrecognized in this browser') || msg.includes('React does not recognize') || msg.includes('using incorrect casing') || msg.includes('Received'))) {
        return;
      }
      console.warn(msg, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('renders a basic antenna element wire', () => {
    const { container } = render(
      <AntennaElement wire={defaultWire} theme="dark" />
    );

    // Verify correct structure is rendered
    expect(container.querySelector('mesh')).toBeTruthy();
    expect(container.querySelector('cylindergeometry')).toBeTruthy();

    // Test that the material is present
    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
  });

  it('adjusts properties for shield wires', () => {
    const shieldWire = { ...defaultWire, isShield: true };
    const { container } = render(
      <AntennaElement wire={shieldWire} theme="dark" />
    );

    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
    expect(material?.getAttribute('emissiveIntensity')).toBe('0.08');
    expect(material?.getAttribute('roughness')).toBe('0.55');
  });

  it('adjusts properties for bridge wires', () => {
    const bridgeWire = { ...defaultWire, isBridge: true };
    const { container } = render(
      <AntennaElement wire={bridgeWire} theme="dark" />
    );

    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
    expect(material?.getAttribute('emissiveIntensity')).toBe('0.05');
    expect(material?.getAttribute('roughness')).toBe('0.7');
  });

  it('adjusts properties for standard wires', () => {
    const standardWire = { ...defaultWire, isShield: false, isBridge: false };
    const { container } = render(
      <AntennaElement wire={standardWire} theme="dark" />
    );

    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
    expect(material?.getAttribute('emissiveIntensity')).toBe('0.15');
    expect(material?.getAttribute('roughness')).toBe('0.35');
  });

  it('applies theme colors correctly for light theme', () => {
    const { container } = render(
      <AntennaElement wire={defaultWire} theme="light" />
    );

    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
    expect(material?.getAttribute('color')).toBe(THEME_COLORS['light'].wire);
    expect(material?.getAttribute('emissive')).toBe(THEME_COLORS['light'].wire);
  });

  it('applies theme colors correctly for dark theme', () => {
    const { container } = render(
      <AntennaElement wire={defaultWire} theme="dark" />
    );

    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
    expect(material?.getAttribute('color')).toBe(THEME_COLORS['dark'].wire);
    expect(material?.getAttribute('emissive')).toBe(THEME_COLORS['dark'].wire);
  });
});
