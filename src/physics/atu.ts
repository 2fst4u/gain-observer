import type { ImpedanceResult } from './types';

type Topology = 'series-shunt' | 'shunt-series';
type Complex = { r: number; x: number };
const reciprocal = (z: Complex): Complex => {
  const d = z.r * z.r + z.x * z.x;
  return { r: z.r / d, x: -z.x / d };
};

export interface LNetworkMatch {
  readonly topology: Topology | 'bypass';
  readonly seriesReactanceOhms: number;
  readonly seriesResistanceOhms: number;
  readonly shuntSusceptanceSiemens: number;
  readonly shuntConductanceSiemens: number;
  readonly inputImpedance: ImpedanceResult;
  readonly efficiency: number;
  readonly lossDb: number;
}

function circuit(z: Complex, topology: Topology, x: number, b: number, q: number) {
  const seriesR = Math.abs(x) / q;
  const shuntG = Math.abs(b) / q;
  if (topology === 'series-shunt') {
    const yLoad = reciprocal(z);
    const parallel = reciprocal({ r: yLoad.r + shuntG, x: yLoad.x + b });
    const input = { r: parallel.r + seriesR, x: parallel.x + x };
    // Set load voltage to 1 V: input power is load + shunt + series heat.
    const currentSquared = (yLoad.r + shuntG) ** 2 + (yLoad.x + b) ** 2;
    const efficiency = yLoad.r / (yLoad.r + shuntG + seriesR * currentSquared);
    return { input, efficiency };
  }
  const branch = { r: z.r + seriesR, x: z.x + x };
  const yBranch = reciprocal(branch);
  const input = reciprocal({ r: yBranch.r + shuntG, x: yBranch.x + b });
  // Set input voltage to 1 V: load power is |I_branch|^2 * R_load.
  const efficiency = z.r / (branch.r * branch.r + branch.x * branch.x) / (yBranch.r + shuntG);
  return { input, efficiency };
}

/**
 * Match a passive load with an explicit two-reactance L network. Each series
 * reactance has ESR |X|/Q and each shunt susceptance has conductance |B|/Q.
 * Both L orientations and both lossless roots are tried; Newton iteration
 * retunes the actual lossy circuit to Z0, and the most efficient match wins.
 * Reactances have either sign (inductor/capacitor); Q is fixed at this frequency.
 * This is a specified tuner circuit, not a bound on all possible tuners.
 */
export function matchLNetwork(load: ImpedanceResult, componentQ: number, z0 = 50): LNetworkMatch | undefined {
  if (!(load.R > 0) || !(z0 > 0) || !(componentQ > 0) ||
      ![load.R, load.X, z0].every(Number.isFinite) || Number.isNaN(componentQ)) return undefined;
  const z = { r: load.R / z0, x: load.X / z0 };
  if (Math.abs(z.r - 1) < 1e-12 && Math.abs(z.x) < 1e-12) {
    return {
      topology: 'bypass', seriesReactanceOhms: 0, seriesResistanceOhms: 0,
      shuntSusceptanceSiemens: 0, shuntConductanceSiemens: 0,
      inputImpedance: { R: z0, X: 0 }, efficiency: 1, lossDb: 0,
    };
  }
  const candidates: Array<{ topology: Topology; x: number; b: number }> = [];
  const y = reciprocal(z);
  if (y.r <= 1) {
    const t = Math.sqrt(Math.max(0, y.r * (1 - y.r)));
    for (const sign of [-1, 1]) candidates.push({ topology: 'series-shunt', x: sign * t / y.r, b: sign * t - y.x });
  }
  if (z.r <= 1) {
    const t = Math.sqrt(Math.max(0, z.r * (1 - z.r)));
    for (const sign of [-1, 1]) candidates.push({ topology: 'shunt-series', x: sign * t - z.x, b: sign * t / z.r });
  }

  let best: LNetworkMatch | undefined;
  for (const seed of candidates) {
    let { x, b } = seed;
    let result = circuit(z, seed.topology, x, b, componentQ);
    for (let iteration = 0; iteration < 80; iteration++) {
      const er = result.input.r - 1;
      const ei = result.input.x;
      const error = Math.hypot(er, ei);
      if (error < 1e-10) break;
      const hx = 1e-5 * Math.max(1, Math.abs(x));
      const hb = 1e-5 * Math.max(1, Math.abs(b));
      const px = circuit(z, seed.topology, x + hx, b, componentQ).input;
      const mx = circuit(z, seed.topology, x - hx, b, componentQ).input;
      const pb = circuit(z, seed.topology, x, b + hb, componentQ).input;
      const mb = circuit(z, seed.topology, x, b - hb, componentQ).input;
      const a = (px.r - mx.r) / (2 * hx);
      const c = (px.x - mx.x) / (2 * hx);
      const d = (pb.r - mb.r) / (2 * hb);
      const e = (pb.x - mb.x) / (2 * hb);
      const determinant = a * e - d * c;
      if (Math.abs(determinant) < 1e-18) break;
      const dx = (e * er - d * ei) / determinant;
      const db = (a * ei - c * er) / determinant;
      let accepted = false;
      for (let step = 1; step >= 1 / 1024; step /= 2) {
        const next = circuit(z, seed.topology, x - step * dx, b - step * db, componentQ);
        if (Math.hypot(next.input.r - 1, next.input.x) < error) {
          x -= step * dx;
          b -= step * db;
          result = next;
          accepted = true;
          break;
        }
      }
      if (!accepted) break;
    }
    if (Math.hypot(result.input.r - 1, result.input.x) > 1e-7 ||
        !(result.efficiency > 0 && result.efficiency <= 1)) continue;
    if (best && result.efficiency <= best.efficiency) continue;
    best = {
      topology: seed.topology,
      seriesReactanceOhms: x * z0,
      seriesResistanceOhms: Math.abs(x) * z0 / componentQ,
      shuntSusceptanceSiemens: b / z0,
      shuntConductanceSiemens: Math.abs(b) / z0 / componentQ,
      inputImpedance: { R: result.input.r * z0, X: result.input.x * z0 },
      efficiency: result.efficiency,
      lossDb: -10 * Math.log10(result.efficiency),
    };
  }
  return best;
}
