import { describe, expect, it } from 'vitest';
import { buildNecCards } from '../src/physics/necCard';
import { selectSimulationInput, useAntennaStore } from '../src/store/antennaStore';
import type { SimulationInput } from '../src/physics/types';

describe('buildNecCards', () => {
  const defaultInput: SimulationInput = {
    frequencyMHz: 14.15,
    wires: [
      {
        start: [0, -5, 10],
        end: [0, 5, 10],
        radius: 0.001,
        segments: 11,
      },
    ],
    ground: { type: 'free' },
    excitation: {
      wireTag: 1,
      segment: 6,
    },
    patternResolution: {
      thetaSteps: 37,
      phiSteps: 73,
    },
  };

  it('generates a valid basic deck for a dipole in free space', () => {
    const output = buildNecCards(defaultInput);
    const lines = output.trim().split('\n');

    expect(lines[0]).toBe('CM gain-visualiser auto-generated deck');
    expect(lines[1]).toBe('CM f=14.15 MHz  ground=free');
    expect(lines[2]).toBe('CE');
    expect(lines[3]).toBe('GW 1 11 0.00000 -5.00000 10.00000 0.00000 5.00000 10.00000 0.00100');
    expect(lines[4]).toBe('GE 0');
    expect(lines[5]).toBe('FR 0 1 0 0 14.150000 0');
    expect(lines[6]).toBe('EX 0 1 6 0 1.0000 0.0000');
    expect(lines[7]).toBe('RP 0 37 73 1000 0 0 5.0000 4.9315');
    expect(lines[8]).toBe('EN');
  });

  describe('geometry and coordinate formatting', () => {
    it('handles multiple wires with auto-incrementing tags', () => {
      const input: SimulationInput = {
        ...defaultInput,
        wires: [
          { start: [0, 0, 0], end: [1, 0, 0], radius: 0.01, segments: 10 },
          { start: [1, 0, 0], end: [1, 1, 0], radius: 0.01, segments: 10 },
        ],
      };
      const output = buildNecCards(input);
      expect(output).toContain('GW 1 10 0.00000 0.00000 0.00000 1.00000 0.00000 0.00000 0.01000');
      expect(output).toContain('GW 2 10 1.00000 0.00000 0.00000 1.00000 1.00000 0.00000 0.01000');
    });

    it('respects explicit wire tags', () => {
      const input: SimulationInput = {
        ...defaultInput,
        wires: [
          { start: [0, 0, 0], end: [1, 0, 0], radius: 0.01, segments: 10, tag: 42 },
        ],
      };
      const output = buildNecCards(input);
      expect(output).toContain('GW 42 10 0.00000 0.00000 0.00000 1.00000 0.00000 0.00000 0.01000');
    });

    it('formats coordinates and radius to 5 decimal places', () => {
      const input: SimulationInput = {
        ...defaultInput,
        wires: [
          {
            start: [1.234567, 2.345678, 3.456789],
            end: [4.5678901, 5.6789012, 6.7890123],
            radius: 0.0001234,
            segments: 5,
          },
        ],
      };
      const output = buildNecCards(input);
      // GW tag nseg x1 y1 z1 x2 y2 z2 rad
      expect(output).toContain('GW 1 5 1.23457 2.34568 3.45679 4.56789 5.67890 6.78901 0.00012');
    });
  });

  describe('ground configurations', () => {
    it('generates GE 0 and no GN card for free space', () => {
      const output = buildNecCards({ ...defaultInput, ground: { type: 'free' } });
      expect(output).toContain('GE 0');
      expect(output).not.toContain('GN');
    });

    it('generates GE 1 and GN 1 for perfect ground', () => {
      const output = buildNecCards({ ...defaultInput, ground: { type: 'perfect' } });
      expect(output).toContain('GE 1');
      expect(output).toContain('GN 1');
    });

    it('generates GE 1 and GN 2 for real ground with custom parameters', () => {
      const output = buildNecCards({
        ...defaultInput,
        ground: { type: 'real', epsilon: 15.5, sigma: 0.012345 },
      });
      expect(output).toContain('GE 1');
      expect(output).toContain('GN 2 0 0 0 15.500 0.01235');
    });

    it('uses default real ground parameters if not provided', () => {
      const output = buildNecCards({
        ...defaultInput,
        ground: { type: 'real' },
      });
      expect(output).toContain('GE 1');
      expect(output).toContain('GN 2 0 0 0 13.000 0.00500');
    });
  });

  describe('frequency, excitation, and control cards', () => {
    it('formats FR card correctly', () => {
      const output = buildNecCards({ ...defaultInput, frequencyMHz: 7.05 });
      expect(output).toContain('FR 0 1 0 0 7.050000 0');
    });

    it('formats EX card with standard voltage', () => {
      const output = buildNecCards(defaultInput);
      expect(output).toContain('EX 0 1 6 0 1.0000 0.0000');
    });

    it('formats EX card with complex voltage', () => {
      const input: SimulationInput = {
        ...defaultInput,
        excitation: { wireTag: 1, segment: 1, real: 0.5, imag: -0.5 },
      };
      const output = buildNecCards(input);
      expect(output).toContain('EX 0 1 1 0 0.5000 -0.5000');
    });

    it('includes required CE and EN markers', () => {
      const output = buildNecCards(defaultInput);
      const lines = output.trim().split('\n');
      expect(lines[0].startsWith('CM')).toBe(true);
      expect(lines[lines.length - 1]).toBe('EN');
    });
  });

  describe('simulation control and radiation pattern', () => {
    it('generates RP card by default', () => {
      const output = buildNecCards(defaultInput);
      expect(output).toContain('RP 0 37 73 1000 0 0 5.0000 4.9315');
    });

    it('generates XQ card when includePattern is false', () => {
      const output = buildNecCards(defaultInput, { includePattern: false });
      expect(output).toContain('XQ');
      expect(output).not.toContain('RP');
    });

    it('calculates dTheta and dPhi correctly', () => {
      const input: SimulationInput = {
        ...defaultInput,
        patternResolution: { thetaSteps: 19, phiSteps: 36 },
      };
      // dTheta = 180 / (19 - 1) = 10
      // dPhi = 360 / 36 = 10
      const output = buildNecCards(input);
      expect(output).toContain('RP 0 19 36 1000 0 0 10.0000 10.0000');
    });
  });

  describe('feedline cards (TL / LD)', () => {
    const inputWithFeedline: SimulationInput = {
      ...defaultInput,
      wires: [
        { start: [-5, 0, 10], end: [5, 0, 10], radius: 0.001, segments: 21, tag: 1 },
        { start: [0, 0, 10], end: [0, 0, 0.5], radius: 0.005, segments: 11, tag: 2 },
      ],
      excitation: { wireTag: 2, segment: 11 },
      transmissionLines: [
        {
          fromTag: 1,
          fromSegment: 11,
          toTag: 2,
          toSegment: 11,
          z0: 50,
          lengthM: 12.5,
        },
      ],
      loads: [
        {
          type: 4,
          wireTag: 2,
          segmentStart: 1,
          segmentEnd: 1,
          param1: 2000,
          param2: 0,
        },
      ],
    };

    it('emits an LD impedance load card', () => {
      const out = buildNecCards(inputWithFeedline);
      expect(out).toMatch(/^LD 4 2 1 1 2000\.\d+ 0\.\d+/m);
    });

    it('emits a TL transmission-line card with Z0 and length', () => {
      const out = buildNecCards(inputWithFeedline);
      expect(out).toMatch(/^TL 1 11 2 11 50\.\d+ 12\.5\d+ 0\.\d+ 0\.\d+ 0\.\d+ 0\.\d+/m);
    });

    it('emits LD before TL (NEC card ordering)', () => {
      const out = buildNecCards(inputWithFeedline);
      const ldIdx = out.indexOf('\nLD ');
      const tlIdx = out.indexOf('\nTL ');
      expect(ldIdx).toBeGreaterThan(0);
      expect(tlIdx).toBeGreaterThan(ldIdx);
    });

    it('emits TL/LD before EX (NEC card ordering)', () => {
      const out = buildNecCards(inputWithFeedline);
      const tlIdx = out.indexOf('\nTL ');
      const exIdx = out.indexOf('\nEX ');
      expect(tlIdx).toBeGreaterThan(0);
      expect(exIdx).toBeGreaterThan(tlIdx);
    });

    it('emits no LD/TL cards when arrays are absent', () => {
      const out = buildNecCards(defaultInput);
      expect(out).not.toContain('\nLD ');
      expect(out).not.toContain('\nTL ');
    });

    it('emits a series-RLC LD card (type 0) when requested', () => {
      const out = buildNecCards({
        ...defaultInput,
        loads: [
          { type: 0, wireTag: 1, segmentStart: 5, segmentEnd: 5, param1: 100, param2: 1e-6, param3: 1e-12 },
        ],
      });
      expect(out).toMatch(/^LD 0 1 5 5 100\./m);
    });
  });

  describe('generated antenna topology cards', () => {
    it('terminated sloping V emits elevated resistor networks, not grounded drop wires', () => {
      const state = useAntennaStore.getState();
      const input = selectSimulationInput({
        ...state,
        type: 'sloping-v',
        length: 80,
        height: 12,
        segments: 21,
        vAngle: 60,
        legSlope: 30,
        groundId: 'perfect',
        feedlineId: 'none',
        terminatedEnabled: true,
        terminatingResistor: 500,
      });
      const out = buildNecCards(input);
      const gwLines = out.split('\n').filter((line) => line.startsWith('GW '));

      expect(out).toContain('GE 1');
      expect(out).toMatch(/^LD 4 10 1 1 500\./m);
      expect(out).toMatch(/^LD 4 11 1 1 500\./m);
      expect(gwLines.every((line) => {
        const parts = line.split(/\s+/);
        return parts[5] !== '0.00000' && parts[8] !== '0.00000';
      })).toBe(true);
      expect(gwLines.some((line) => line.startsWith('GW 12 '))).toBe(true);
      expect(gwLines.some((line) => line.startsWith('GW 13 '))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws error for NaN coordinates', () => {
      const input: SimulationInput = {
        ...defaultInput,
        wires: [{ ...defaultInput.wires[0], start: [NaN, 0, 0] }],
      };
      expect(() => buildNecCards(input)).toThrow('Non-finite numeric value in NEC card: NaN');
    });

    it('throws error for Infinity in numeric fields', () => {
      const input: SimulationInput = {
        ...defaultInput,
        frequencyMHz: Infinity,
      };
      expect(() => buildNecCards(input)).toThrow('Non-finite numeric value in NEC card: Infinity');
    });
  });
});
