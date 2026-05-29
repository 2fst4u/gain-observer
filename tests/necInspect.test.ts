import { describe, expect, it } from 'vitest';
import { buildNecCards } from '../src/physics/necCard';
import {
  getNecLines,
  parseGwLine,
  parseLdLine,
  parseTlLine,
  parseNtLine,
  expectNoGroundTouchingWires,
  expectExcitation
} from './necInspect';
import type { SimulationInput } from '../src/physics/types';

describe('necInspect helpers', () => {
  const dipoleInput: SimulationInput = {
    frequencyMHz: 14.15,
    wires: [
      {
        tag: 1,
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
    loads: [
        { type: 4, wireTag: 1, segmentStart: 1, segmentEnd: 1, param1: 50, param2: 0 }
    ],
    transmissionLines: [
        { fromTag: 1, fromSegment: 6, toTag: 2, toSegment: 1, z0: 50, lengthM: 10 }
    ]
  };

  it('getNecLines extracts correct cards', () => {
    const deck = buildNecCards(dipoleInput);
    const gwLines = getNecLines(deck, 'GW');
    expect(gwLines).toHaveLength(1);
    expect(gwLines[0]).toContain('GW 1 11');
  });

  it('parseGwLine parses GW correctly', () => {
    const line = 'GW 1 11 0.00000 -5.00000 10.00000 0.00000 5.00000 10.00000 0.00100';
    const gw = parseGwLine(line);
    expect(gw.tag).toBe(1);
    expect(gw.segments).toBe(11);
    expect(gw.z1).toBe(10);
    expect(gw.radius).toBe(0.001);
  });

  it('parseGwLine throws on non-GW line', () => {
    const line = 'LD 4 1 1 1 50.00000 0.00000';
    expect(() => parseGwLine(line)).toThrow(/Not a GW line/);
  });

  it('parseLdLine parses LD correctly', () => {
    const line = 'LD 4 1 1 1 50.00000 0.00000';
    const ld = parseLdLine(line);
    expect(ld.type).toBe(4);
    expect(ld.tag).toBe(1);
    expect(ld.p1).toBe(50);
  });

  it('parseLdLine throws on non-LD line', () => {
    const line = 'GW 1 11 0.00000 -5.00000 10.00000 0.00000 5.00000 10.00000 0.00100';
    expect(() => parseLdLine(line)).toThrow(/Not an LD line/);
  });

  it('parseTlLine parses TL correctly', () => {
    const line = 'TL 1 6 2 1 50.0000 10.00000 0.000000 0.000000 0.000000 0.000000';
    const tl = parseTlLine(line);
    expect(tl.tag1).toBe(1);
    expect(tl.seg1).toBe(6);
    expect(tl.z0).toBe(50);
    expect(tl.length).toBe(10);
  });

  it('parseTlLine throws on non-TL line', () => {
    const line = 'GW 1 11 0.00000 -5.00000 10.00000 0.00000 5.00000 10.00000 0.00100';
    expect(() => parseTlLine(line)).toThrow(/Not a TL line/);
  });

  it('parseNtLine parses NT correctly', () => {
    const line = 'NT 1 1 2 1 0.020000 0.000000 -0.020000 0.000000 0.020000 0.000000';
    const nt = parseNtLine(line);
    expect(nt.tag1).toBe(1);
    expect(nt.seg1).toBe(1);
    expect(nt.tag2).toBe(2);
    expect(nt.seg2).toBe(1);
    expect(nt.y11r).toBe(0.02);
    expect(nt.y11i).toBe(0);
    expect(nt.y12r).toBe(-0.02);
    expect(nt.y12i).toBe(0);
    expect(nt.y22r).toBe(0.02);
    expect(nt.y22i).toBe(0);
  });

  it('parseNtLine throws on non-NT line', () => {
    const line = 'GW 1 11 0.00000 -5.00000 10.00000 0.00000 5.00000 10.00000 0.00100';
    expect(() => parseNtLine(line)).toThrow(/Not an NT line/);
  });

  it('expectNoGroundTouchingWires passes for high dipole', () => {
    const deck = buildNecCards(dipoleInput);
    expect(() => expectNoGroundTouchingWires(deck)).not.toThrow();
  });

  it('expectNoGroundTouchingWires fails for wire touching ground', () => {
    const lowDipole: SimulationInput = {
        ...dipoleInput,
        wires: [{ ...dipoleInput.wires[0], start: [0, -5, 0] }]
    };
    const deck = buildNecCards(lowDipole);
    expect(() => expectNoGroundTouchingWires(deck)).toThrow(/touches or is below ground/);
  });

  it('expectExcitation correctly finds excitation', () => {
    const deck = buildNecCards(dipoleInput);
    expect(() => expectExcitation(deck, 1, 6)).not.toThrow();
    expect(() => expectExcitation(deck, 1, 5)).toThrow(/Excitation not found/);
  });
});
