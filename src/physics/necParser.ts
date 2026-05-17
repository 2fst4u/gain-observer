// Parser for the nec2c text output file.
//
// We only extract what the UI needs:
//   - antenna input impedance (R + jX) from the ANTENNA INPUT PARAMETERS block
//   - radiation pattern table from the RADIATION PATTERNS block
//
// NEC-2 formats these with fixed-width columns but the whitespace is
// consistent, so regex-based scanning is robust.

import type { GainPattern, ImpedanceResult, SegmentCurrent, PowerBudget } from './types';

export interface ParsedNecOutput {
  impedance: ImpedanceResult | null;
  pattern: GainPattern | null;
  /** Excitation power (watts). Needed to sanity-check gain. */
  excitationPowerW: number | null;
  /** Per-segment currents from the CURRENTS AND LOCATION block. */
  currents: SegmentCurrent[];
  /** NEC POWER BUDGET block. */
  powerBudget: PowerBudget | null;
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
  const lines = text.slice(blockStart).split('\n').slice(0, 12);

  // First data row: starts with whitespace + integer tag.
  const rowRe = /^\s+\d+\s+\d+\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)/;
  for (const line of lines) {
    const m = rowRe.exec(line);
    if (!m) continue;
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
  const rowRe = /^\s+\d+\s+\d+\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)/;

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
    const lines = blockText.split('\n');
    let found = false;
    for (const line of lines) {
      const m = rowRe.exec(line);
      if (m) {
        const zR = parseFloat(m[5]!);
        const zX = parseFloat(m[6]!);
        const power = parseFloat(m[9]!);
        results.push({ impedance: { R: zR, X: zX }, power });
        found = true;
        break;
      }
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

  // Row regex: leading whitespace, theta, phi, vert, horiz, total (we stop here).
  const rowRe = /^\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/;

  const expected = thetaSteps * phiSteps;
  const data = new Float32Array(expected).fill(-100);
  let count = 0;

  // Track the order we see (theta, phi) so we can verify NEC emitted in the
  // expected "phi outer, theta inner" ordering (it does).
  const lines = text.slice(blockStart).split('\n');
  for (const line of lines) {
    const m = rowRe.exec(line);
    if (!m) continue;
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

/**
 * Parses the CURRENTS AND LOCATION block.
 *
 * Each data row has the form:
 *   SEG  TAG    X      Y      Z    LEN    REAL       IMAG       MAGN      PHASE
 *     1    1  -0.215  0.000  0.237  0.043  1.69E-03  9.65E-04  1.95E-03  29.688
 *
 * Coordinates are in wavelengths (NEC normalises them).
 * We extract seg, tag, x, y, z, magnitude, and phase.
 */
export function parseNecCurrents(text: string): SegmentCurrent[] {
  const blockStart = text.indexOf('CURRENTS AND LOCATION');
  if (blockStart < 0) return [];

  const results: SegmentCurrent[] = [];
  // Match: seg tag x y z (length – discarded) real imag magn phase
  const rowRe =
    /^\s+(\d+)\s+(\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+\d+\.\d+\s+(-?\d+\.\d+E[+-]\d+)\s+(-?\d+\.\d+E[+-]\d+)\s+(-?\d+\.\d+E[+-]\d+)\s+(-?\d+\.\d+)/;

  const lines = text.slice(blockStart).split('\n');
  for (const line of lines) {
    const m = rowRe.exec(line);
    if (!m) continue;
    results.push({
      segNo: parseInt(m[1]!, 10),
      tagNo: parseInt(m[2]!, 10),
      x: parseFloat(m[3]!),
      y: parseFloat(m[4]!),
      z: parseFloat(m[5]!),
      magnitude: parseFloat(m[8]!),
      phase: parseFloat(m[9]!),
    });
  }
  return results;
}

/**
 * Parses the POWER BUDGET block.
 *
 * Format:
 *   INPUT POWER   =  5.2785E-03 Watts
 *   RADIATED POWER=  5.2785E-03 Watts
 *   STRUCTURE LOSS=  0.0000E+00 Watts
 *   NETWORK LOSS  =  0.0000E+00 Watts
 *   EFFICIENCY    =  100.00 Percent
 *
 * NETWORK LOSS includes power dissipated in NT-card resistors (termination).
 */
export function parseNecPowerBudget(text: string): PowerBudget | null {
  const blockStart = text.indexOf('POWER BUDGET');
  if (blockStart < 0) return null;

  // Scan enough chars to capture all five data lines regardless of indentation.
  const block = text.slice(blockStart, blockStart + 500);

  const inputM = /INPUT POWER\s*=\s*(-?\d+\.\d+E[+-]\d+)/.exec(block);
  const radiatedM = /RADIATED POWER\s*=\s*(-?\d+\.\d+E[+-]\d+)/.exec(block);
  const structM = /STRUCTURE LOSS\s*=\s*(-?\d+\.\d+E[+-]\d+)/.exec(block);
  const netM = /NETWORK LOSS\s*=\s*(-?\d+\.\d+E[+-]\d+)/.exec(block);
  const effM = /EFFICIENCY\s*=\s*(-?\d+\.\d+)/.exec(block);

  if (!inputM || !radiatedM) return null;

  return {
    inputW: parseFloat(inputM[1]!),
    radiatedW: parseFloat(radiatedM[1]!),
    structureLossW: structM ? parseFloat(structM[1]!) : 0,
    networkLossW: netM ? parseFloat(netM[1]!) : 0,
    efficiencyPct: effM ? parseFloat(effM[1]!) : 0,
  };
}

export function parseNecOutput(
  text: string,
  expectedThetaSteps: number,
  expectedPhiSteps: number,
): ParsedNecOutput {
  const { impedance, power } = parseNecImpedance(text);
  const pattern = parsePattern(text, expectedThetaSteps, expectedPhiSteps);
  const currents = parseNecCurrents(text);
  const powerBudget = parseNecPowerBudget(text);

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
    currents,
    powerBudget,
    notices,
  };
}
