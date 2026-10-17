import { describe, expect, it } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';

describe('Nec2Engine origin validation', () => {
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

  it('allows localhost and 127.0.0.1 origins', () => {
    const engineLocal = new Nec2Engine({ baseUrl: 'http://localhost:3000/' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (engineLocal as any).resolveAsset('nec2.js')).not.toThrow();

    const engineIp = new Nec2Engine({ baseUrl: 'http://127.0.0.1:8080/' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => (engineIp as any).resolveAsset('nec2.js')).not.toThrow();
  });

  it('allows file: protocol URLs', () => {
    const engineFile = new Nec2Engine({ baseUrl: 'file:///path/to/assets/' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((engineFile as any).resolveAsset('nec2.js')).toBe('file:///path/to/assets/nec2.js');
  });
});
