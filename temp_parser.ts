
import type { GainPattern, ImpedanceResult, SegmentCurrent, PowerBudget } from './types';

export interface ParsedNecOutput {
  impedance: ImpedanceResult | null;
  pattern: GainPattern | null;
  excitationPowerW: number | null;
  currents: SegmentCurrent[];
  powerBudget: PowerBudget | null;
  notices: string[];
}

const NO_HORIZ_SENTINEL = -999.99;

const impedanceBlockRe = /ANTENNA INPUT PARAMETERS(?:(?!(?:ANTENNA INPUT PARAMETERS)).*?\n){1,12}?(?:^\s+\d+\s+\d+\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+)\s+(-?\d\.\d+E[+-]\d+))/gm;

export function parseNecImpedance(text: string): { impedance: ImpedanceResult | null; power: number | null } {
  impedanceBlockRe.lastIndex = 0;
  const m = impedanceBlockRe.exec(text);

  if (m) {
    const zR = parseFloat(m[1]!);
    const zX = parseFloat(m[2]!);
    const power = parseFloat(m[5]!);
    return { impedance: { R: zR, X: zX }, power };
  }

  return { impedance: null, power: null };
}

export function parseNecImpedanceSweep(text: string): { impedance: ImpedanceResult | null; power: number | null }[] {
  const results: { impedance: ImpedanceResult | null; power: number | null }[] = [];

  let pos = 0;

  while (true) {
    const blockStart = text.indexOf('ANTENNA INPUT PARAMETERS', pos);
    if (blockStart < 0) break;

    impedanceBlockRe.lastIndex = blockStart;
    const m = impedanceBlockRe.exec(text);

    if (m && m.index === blockStart) {
      const zR = parseFloat(m[1]!);
      const zX = parseFloat(m[2]!);
      const power = parseFloat(m[5]!);
      results.push({ impedance: { R: zR, X: zX }, power });
    } else {
      results.push({ impedance: null, power: null });
    }

    pos = blockStart + 24;
  }

  return results;
}
