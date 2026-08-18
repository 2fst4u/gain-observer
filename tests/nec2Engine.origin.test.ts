import { describe, expect, it } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';

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
