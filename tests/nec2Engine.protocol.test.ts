import { describe, expect, it } from 'vitest';
import { Nec2Engine, validateUrlOrigin } from '../src/physics/nec2Engine';

describe('validateUrlOrigin protocol checks', () => {
  it('throws untrusted protocol error for data: URIs', () => {
    const url = new URL('data:text/javascript,console.log("hello")');
    expect(() => validateUrlOrigin(url)).toThrow('Untrusted protocol: data:');
  });

  it('throws untrusted protocol error for blob: URIs', () => {
    const url = new URL('blob:http://localhost/550e8400-e29b-41d4-a716-446655440000');
    expect(() => validateUrlOrigin(url)).toThrow('Untrusted protocol: blob:');
  });

  it('throws untrusted protocol error for javascript: URIs', () => {
    const url = new URL('javascript:alert(1)');
    expect(() => validateUrlOrigin(url)).toThrow('Untrusted protocol: javascript:');
  });

  it('throws untrusted protocol error for ftp: URIs', () => {
    const url = new URL('ftp://localhost/nec2.js');
    expect(() => validateUrlOrigin(url)).toThrow('Untrusted protocol: ftp:');
  });
});

describe('Nec2Engine untrusted protocol', () => {
  it('throws untrusted protocol error on init', async () => {
    const engine = new Nec2Engine({ baseUrl: 'ftp://localhost/' });
    await expect(engine.init()).rejects.toThrow('Untrusted protocol: ftp:');
  });

  it('throws untrusted protocol error on simulate', async () => {
    const engine = new Nec2Engine({ baseUrl: 'ftp://localhost/' });
    const dummyInput = {
      wires: [{ start: [0, 0, 1] as [number, number, number], end: [0, 0, 2] as [number, number, number], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' as const },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };
    await expect(engine.simulate(dummyInput)).rejects.toThrow('Untrusted protocol: ftp:');
  });
});
