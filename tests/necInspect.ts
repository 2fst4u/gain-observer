import { expect } from 'vitest';

/**
 * Returns all lines in the NEC deck that start with the given card mnemonic.
 */
export function getNecLines(deck: string, cardName: string): string[] {
  return deck.split('\n').filter((line) => line.trim().startsWith(cardName));
}

/**
 * Parses a GW (Geometry Wire) card line.
 * Format: GW tag nseg x1 y1 z1 x2 y2 z2 radius
 */
export function parseGwLine(line: string) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== 'GW') {
    throw new Error(`Not a GW line: ${line}`);
  }
  return {
    tag: parseInt(parts[1], 10),
    segments: parseInt(parts[2], 10),
    x1: parseFloat(parts[3]),
    y1: parseFloat(parts[4]),
    z1: parseFloat(parts[5]),
    x2: parseFloat(parts[6]),
    y2: parseFloat(parts[7]),
    z2: parseFloat(parts[8]),
    radius: parseFloat(parts[9]),
  };
}

/**
 * Parses an LD (Loading) card line.
 * Format: LD type tag seg_start seg_end P1 P2 P3
 */
export function parseLdLine(line: string) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== 'LD') {
    throw new Error(`Not an LD line: ${line}`);
  }
  return {
    type: parseInt(parts[1], 10),
    tag: parseInt(parts[2], 10),
    segmentStart: parseInt(parts[3], 10),
    segmentEnd: parseInt(parts[4], 10),
    p1: parseFloat(parts[5]),
    p2: parseFloat(parts[6]),
    p3: parts[7] ? parseFloat(parts[7]) : undefined,
  };
}

/**
 * Parses a TL (Transmission Line) card line.
 * Format: TL tag1 seg1 tag2 seg2 Z0 length [Y1r Y1i Y2r Y2i]
 */
export function parseTlLine(line: string) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] !== 'TL') {
    throw new Error(`Not a TL line: ${line}`);
  }
  return {
    tag1: parseInt(parts[1], 10),
    seg1: parseInt(parts[2], 10),
    tag2: parseInt(parts[3], 10),
    seg2: parseInt(parts[4], 10),
    z0: parseFloat(parts[5]),
    length: parseFloat(parts[6]),
  };
}

/**
 * Asserts that no wires in the deck have endpoints at or below z=0.
 * Useful for verifying height regressions.
 */
export function expectNoGroundTouchingWires(deck: string) {
  const gwLines = getNecLines(deck, 'GW');
  for (const line of gwLines) {
    const gw = parseGwLine(line);
    expect(gw.z1, `Wire tag ${gw.tag} end 1 touches or is below ground (z=${gw.z1})`).toBeGreaterThan(0);
    expect(gw.z2, `Wire tag ${gw.tag} end 2 touches or is below ground (z=${gw.z2})`).toBeGreaterThan(0);
  }
}

/**
 * Asserts that an excitation (EX) card exists for the given tag and segment.
 */
export function expectExcitation(deck: string, tag: number, segment: number) {
  const exLines = getNecLines(deck, 'EX');
  const found = exLines.some((line) => {
    const parts = line.trim().split(/\s+/);
    // EX type tag seg ...
    // type 0 is voltage source
    return parseInt(parts[2], 10) === tag && parseInt(parts[3], 10) === segment;
  });
  expect(found, `Excitation not found on tag ${tag} segment ${segment}`).toBe(true);
}
