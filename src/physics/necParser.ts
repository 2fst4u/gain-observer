// Parser for the nec2c text output file.
//
// We only extract what the UI needs:
//   - antenna input impedance (R + jX) from the ANTENNA INPUT PARAMETERS block
//   - radiation pattern table from the RADIATION PATTERNS block
//
// NEC-2 formats these with fixed-width columns but the whitespace is
// consistent, so regex-based scanning is robust.

import type { GainPattern, ImpedanceResult } from './types';

export interface ParsedNecOutput {
  impedance: ImpedanceResult | null;
  pattern: GainPattern | null;
  /** Excitation power (watts). Needed to sanity-check gain. */
  excitationPowerW: number | null;
  /** Any warnings/notes encountered (surfaced in UI). */
  notices: string[];
}

const NO_HORIZ_SENTINEL = -999.99;

/**
 * The ANTENNA INPUT PARAMETERS block. There is exactly one row per excited
 * segment. We take the first (matches our single-feed convention).
 *
 * Columns:
 *   TAG SEG  V_REAL V_IMAG   I_REAL I_IMAG   Z_REAL Z_IMAG   Y_REAL Y_IMAG   POWER
 */
export function parseNecImpedance(text: string): { impedance: ImpedanceResult | null; power: number | null } {
  const blockStart = text.indexOf('ANTENNA INPUT PARAMETERS');
  if (blockStart < 0) return { impedance: null, power: null };
  // First data row: starts with whitespace + integer tag.
  const rowRe = /^[ \t]+\d+[ \t]+\d+[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)/gm;

  // Find the end of the 12th line to bound our search
  let linesSearched = 0;
  let p = blockStart;
  while (linesSearched < 12) {
    const nextNewline = text.indexOf('\n', p);
    if (nextNewline < 0) break;
    linesSearched++;
    p = nextNewline + 1;
  }
  const window = text.slice(blockStart, p);

  // We can just use the global regex on the window
  rowRe.lastIndex = 0;
  const m = rowRe.exec(window);
  if (m) {
    const zR = parseFloat(m[5]!);
    const zX = parseFloat(m[6]!);
    const power = parseFloat(m[9]!);
    return { impedance: { R: zR, X: zX }, power };
  }
  return { impedance: null, power: null };
}

/**
 * Extracts all ANTENNA INPUT PARAMETERS blocks for frequency sweeps.
 */
export function parseNecImpedanceSweep(text: string): { impedance: ImpedanceResult | null; power: number | null }[] {
  const results: { impedance: ImpedanceResult | null; power: number | null }[] = [];
  let pos = 0;

  while (true) {
    const blockStart = text.indexOf('ANTENNA INPUT PARAMETERS', pos);
    if (blockStart < 0) break;

    let lineStart = blockStart;
    const newlinePositions = [];
    for (let i = 0; i < 12; i++) {
      const p = text.indexOf('\n', lineStart);
      if (p < 0) break;
      newlinePositions.push(p);
      lineStart = p + 1;
    }

    if (newlinePositions.length === 0) break;

    const blockText = text.slice(blockStart, newlinePositions[newlinePositions.length - 1]);

    // We just use a global regex on the blockText
    const localRe = /^[ \t]+\d+[ \t]+\d+[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)[ \t]+(-?\d\.\d+E[+-]\d+)/m;
    const m = localRe.exec(blockText);
    let found = false;
    if (m) {
      const zR = parseFloat(m[5]!);
      const zX = parseFloat(m[6]!);
      const power = parseFloat(m[9]!);
      results.push({ impedance: { R: zR, X: zX }, power });
      found = true;
    }

    if (!found) {
      results.push({ impedance: null, power: null });
    }

    pos = blockStart + 24; // advance safely past the start
  }

  return results;
}

/**
 * The RADIATION PATTERNS block. Each row is:
 *   THETA  PHI  VERT_DB  HORIZ_DB  TOTAL_DB  AXIAL  TILT  SENSE  E_TH_MAG  E_TH_PHASE  E_PHI_MAG  E_PHI_PHASE
 *
 * We keep only theta, phi, and total_dB — converting -999.99 sentinels to a
 * very low number so the rest of the pipeline doesn't choke.
 *
 * The caller supplies expected theta/phi step counts; we verify and lay out
 * the flat array [ti * phiSteps + pi].
 */
function parsePattern(text: string, thetaSteps: number, phiSteps: number): GainPattern | null {
  const blockStart = text.indexOf('RADIATION PATTERNS');
  if (blockStart < 0) return null;

  const expected = thetaSteps * phiSteps;
  const data = new Float32Array(expected);
  let count = 0;

  // Row regex: leading whitespace, theta, phi, vert, horiz, total (we stop here).
  const globalRowRe = /^[ \t]+(-?\d+\.\d+)[ \t]+(-?\d+\.\d+)[ \t]+(-?\d+\.\d+)[ \t]+(-?\d+\.\d+)[ \t]+(-?\d+\.\d+)/gm;
  globalRowRe.lastIndex = blockStart;

  let m;
  while ((m = globalRowRe.exec(text)) !== null) {
    const theta = parseFloat(m[1]!);
    const phi = parseFloat(m[2]!);
    const totalRaw = parseFloat(m[5]!);
    const total = totalRaw <= NO_HORIZ_SENTINEL + 1 ? -100 : totalRaw;

    // Compute row index from theta and phi (both quantised by NEC's step).
    const dTheta = 180 / (thetaSteps - 1);
    const dPhi = 360 / phiSteps;
    const ti = Math.round(theta / dTheta);
    const pi = Math.round(phi / dPhi) % phiSteps;
    if (ti < 0 || ti >= thetaSteps) continue;

    data[ti * phiSteps + pi] = total;
    count++;
    if (count >= expected) break;
  }

  if (count === 0) return null;

  return {
    data,
    thetaSteps,
    phiSteps,
    dTheta: 180 / (thetaSteps - 1),
    dPhi: 360 / phiSteps,
  };
}

export function parseNecOutput(
  text: string,
  expectedThetaSteps: number,
  expectedPhiSteps: number,
): ParsedNecOutput {
  const { impedance, power } = parseNecImpedance(text);
  const pattern = parsePattern(text, expectedThetaSteps, expectedPhiSteps);

  const notices: string[] = [];
  if (/RUN TIME/i.test(text) && !impedance) {
    notices.push('Impedance block not found in NEC output.');
  }
  if (/RUN TIME/i.test(text) && !pattern) {
    notices.push('Radiation pattern block not found in NEC output.');
  }
  // Look for NEC-2 warning banners.
  const warnMatch = text.match(/\*\*\*\*\*.*?WARNING.*?\*\*\*\*\*/g);
  if (warnMatch) notices.push(...warnMatch.map((s) => s.trim()));

  return {
    impedance,
    pattern,
    excitationPowerW: power,
    notices,
  };
}
