import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Feedpoint } from '../src/components/Scene/Feedpoint';
import { THEME_COLORS } from '../src/utils/themeColors';

describe('Feedpoint', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalError: typeof console.error;

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

  it('renders correctly with dark theme', () => {
    const position: [number, number, number] = [1, 2, 3];
    const { container } = render(<Feedpoint position={position} theme="dark" />);

    const mesh = container.querySelector('mesh');
    expect(mesh).toBeTruthy();

    // Check position
    // R3F passes the props directly down in the render string
    const positionAttr = mesh?.getAttribute('position');
    expect(positionAttr).toBe('1,2,3');

    // Check geometry
    const geometry = container.querySelector('spheregeometry');
    expect(geometry).toBeTruthy();
    expect(geometry?.getAttribute('args')).toBe('0.22,16,16');

    // Check material colors
    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
    expect(material?.getAttribute('color')).toBe(THEME_COLORS.dark.feedpoint);
    expect(material?.getAttribute('emissive')).toBe(THEME_COLORS.dark.feedpoint);
    expect(material?.getAttribute('emissiveintensity')).toBe('0.4');
  });

  it('renders correctly with light theme', () => {
    const position: [number, number, number] = [-5, 0, 10];
    const { container } = render(<Feedpoint position={position} theme="light" />);

    const material = container.querySelector('meshstandardmaterial');
    expect(material).toBeTruthy();
    expect(material?.getAttribute('color')).toBe(THEME_COLORS.light.feedpoint);
    expect(material?.getAttribute('emissive')).toBe(THEME_COLORS.light.feedpoint);

    const mesh = container.querySelector('mesh');
    const positionAttr = mesh?.getAttribute('position');
    expect(positionAttr).toBe('-5,0,10');
  });
});
