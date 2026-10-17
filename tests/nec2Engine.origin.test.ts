import { describe, expect, it } from 'vitest';
import { Nec2Engine, validateUrlOrigin } from '../src/physics/nec2Engine';

describe('validateUrlOrigin origin and file: checks', () => {
  it('allows file: protocol URLs without checking origin', () => {
    const url = new URL('file:///home/user/app/nec2.js');
    expect(() => validateUrlOrigin(url)).not.toThrow();
  });

  it('allows http://localhost and http://127.0.0.1 URLs', () => {
    expect(() => validateUrlOrigin(new URL('http://localhost/nec2.js'))).not.toThrow();
    expect(() => validateUrlOrigin(new URL('http://localhost:8080/nec2.js'))).not.toThrow();
    expect(() => validateUrlOrigin(new URL('http://127.0.0.1:8080/nec2.js'))).not.toThrow();
  });

  it('throws untrusted origin error for arbitrary remote origins or untrusted IPs', () => {
    expect(() => validateUrlOrigin(new URL('http://attacker.com/nec2.js'))).toThrow(
      'Untrusted origin: http://attacker.com'
    );
    expect(() => validateUrlOrigin(new URL('https://evil.com/nec2.js'))).toThrow(
      'Untrusted origin: https://evil.com'
    );
    expect(() => validateUrlOrigin(new URL('http://192.168.1.1/nec2.js'))).toThrow(
      'Untrusted origin: http://192.168.1.1'
    );
  });

  it('handles custom self.location.origin correctly in web worker context', () => {
    const originalSelf = globalThis.self;
    try {
      // Simulate web worker environment with custom location
      globalThis.self = {
        location: {
          origin: 'https://app.gain.observer',
        } as unknown as Location,
      } as unknown as Window & typeof globalThis;

      // Valid origin matching self.location.origin
      expect(() => validateUrlOrigin(new URL('https://app.gain.observer/nec2.js'))).not.toThrow();

      // Localhost is still allowed
      expect(() => validateUrlOrigin(new URL('http://localhost/nec2.js'))).not.toThrow();

      // Mismatching origin is rejected
      expect(() => validateUrlOrigin(new URL('https://attacker.com/nec2.js'))).toThrow(
        'Untrusted origin: https://attacker.com'
      );
    } finally {
      globalThis.self = originalSelf;
    }
  });

  it('handles self.location.origin equal to "null"', () => {
    const originalSelf = globalThis.self;
    try {
      globalThis.self = {
        location: {
          origin: 'null',
        } as unknown as Location,
      } as unknown as Window & typeof globalThis;

      // Should fallback to http://localhost
      expect(() => validateUrlOrigin(new URL('http://localhost/nec2.js'))).not.toThrow();
      expect(() => validateUrlOrigin(new URL('https://attacker.com/nec2.js'))).toThrow(
        'Untrusted origin: https://attacker.com'
      );
    } finally {
      globalThis.self = originalSelf;
    }
  });
});

describe('Nec2Engine untrusted origin', () => {
  it('throws untrusted origin error on init', async () => {
    const engine = new Nec2Engine({ baseUrl: 'http://attacker.com/' });
    await expect(engine.init()).rejects.toThrow('Untrusted origin: http://attacker.com');
  });

  it('throws untrusted origin error on simulate', async () => {
    const engine = new Nec2Engine({ baseUrl: 'https://attacker.com/' });
    const dummyInput = {
      wires: [{ start: [0, 0, 1] as [number, number, number], end: [0, 0, 2] as [number, number, number], radius: 0.001, segments: 11, tag: 1 }],
      frequencyMHz: 14,
      ground: { type: 'free' as const },
      excitation: { wireTag: 1, segment: 6 },
      patternResolution: { thetaSteps: 5, phiSteps: 8 },
    };
    await expect(engine.simulate(dummyInput)).rejects.toThrow('Untrusted origin: https://attacker.com');
  });
});
