import { describe, expect, it } from 'vitest';
import { buildNecCards } from '../src/physics/necCard';
import type { SimulationInput } from '../src/physics/types';

describe('buildNecCards', () => {
  const defaultInput: SimulationInput = {
    wires: [{
      start: [-10, 0, 10],
      end: [10, 0, 10],
      radius: 0.001,
      segments: 21,
      tag: 1,
    }],
    frequencyMHz: 7.1,
    ground: { type: 'free' },
    excitation: { wireTag: 1, segment: 11 },
    patternResolution: { thetaSteps: 37, phiSteps: 72 },
  };

  it('generates free-space cards (GE 0, no GN)', () => {
    const deck = buildNecCards(defaultInput);
    expect(deck).toContain('GE 0');
    expect(deck).not.toContain('GN');
    expect(deck).toContain('FR 0 1 0 0 7.100000 0');
    expect(deck).toContain('RP 0 37 72 1000 0 0 5.0000 5.0000');
  });

  it('generates perfect ground cards (GE 1, GN 1)', () => {
    const input: SimulationInput = {
      ...defaultInput,
      ground: { type: 'perfect' },
    };
    const deck = buildNecCards(input);
    expect(deck).toContain('GE 1');
    expect(deck).toContain('GN 1');
  });

  it('generates real ground cards (GE 1, GN 2)', () => {
    const input: SimulationInput = {
      ...defaultInput,
      ground: { type: 'real', epsilon: 13, sigma: 0.005 },
    };
    const deck = buildNecCards(input);
    expect(deck).toContain('GE 1');
    expect(deck).toContain('GN 2 0 0 0 13.000 0.00500');
  });

  it('uses XQ card when includePattern is false', () => {
    const deck = buildNecCards(defaultInput, { includePattern: false });
    expect(deck).toContain('XQ');
    expect(deck).not.toContain('RP');
  });

  it('rounds wire coordinates and radius correctly', () => {
    const input: SimulationInput = {
      ...defaultInput,
      wires: [{
        start: [-10.123456, 0, 10.654321],
        end: [10.123456, 0, 10.654321],
        radius: 0.0012345,
        segments: 21,
        tag: 1,
      }],
    };
    const deck = buildNecCards(input);
    // n(v, 5) is used for GW
    expect(deck).toContain('GW 1 21 -10.12346 0.00000 10.65432 10.12346 0.00000 10.65432 0.00123');
  });

  it('throws on non-finite numeric inputs', () => {
    const input: SimulationInput = {
      ...defaultInput,
      frequencyMHz: NaN,
    };
    expect(() => buildNecCards(input)).toThrow('Non-finite numeric value');
  });
});
