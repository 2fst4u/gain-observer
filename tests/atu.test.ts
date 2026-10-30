import { describe, expect, it } from 'vitest';
import { matchLNetwork } from '../src/physics/atu';

describe('explicit finite-Q L tuner', () => {
  it('bypasses a matched load', () => {
    expect(matchLNetwork({ R: 50, X: 0 }, 150)?.topology).toBe('bypass');
    expect(matchLNetwork({ R: 50, X: 0 }, 150)?.lossDb).toBe(0);
  });

  it.each([
    { R: 300, X: 0 }, { R: 5, X: 80 }, { R: 50, X: 500 },
    { R: 50, X: -500 }, { R: 800, X: -250 }, { R: 10, X: 0 },
  ])('retunes actual dissipative components to 50 ohms for %j', (load) => {
    const match = matchLNetwork(load, 150)!;
    expect(match).toBeDefined();
    expect(match.inputImpedance.R).toBeCloseTo(50, 5);
    expect(match.inputImpedance.X).toBeCloseTo(0, 5);
    expect(match.efficiency).toBeGreaterThan(0);
    expect(match.efficiency).toBeLessThan(1);
    expect(match.seriesResistanceOhms).toBeCloseTo(Math.abs(match.seriesReactanceOhms) / 150, 12);
    expect(match.shuntConductanceSiemens).toBeCloseTo(Math.abs(match.shuntSusceptanceSiemens) / 150, 12);
  });

  it('accounts for both component losses against an independently calculated branch power budget', () => {
    const load = { R: 300, X: 0 };
    const match = matchLNetwork(load, 150)!;
    expect(match.topology).toBe('series-shunt');
    // Unit load voltage: P_load=1/R, P_shunt=G, P_series=|I_total|²*ESR.
    const pLoad = 1 / load.R;
    const gTotal = pLoad + match.shuntConductanceSiemens;
    const pShunt = match.shuntConductanceSiemens;
    const pSeries = (gTotal ** 2 + match.shuntSusceptanceSiemens ** 2) * match.seriesResistanceOhms;
    expect(match.efficiency).toBeCloseTo(pLoad / (pLoad + pShunt + pSeries), 11);
    expect(match.lossDb).toBeGreaterThan(0.12);
    expect(match.lossDb).toBeLessThan(0.14);
  });

  it.each([{ R: 300, X: 0 }, { R: 10, X: 0 }, { R: 5, X: 80 }])('agrees with load power driven by a matched 50-ohm voltage source for %j', (load) => {
    const match = matchLNetwork(load, 150)!;
    // A 1 V RMS Thevenin source with 50-ohm resistance drives the matched
    // network at V_in=0.5 V and I_in=0.01 A; accepted power is 0.005 W.
    let loadPower: number;
    if (match.topology === 'series-shunt') {
      const vLoadReal = 0.5 - 0.01 * match.seriesResistanceOhms;
      const vLoadImag = -0.01 * match.seriesReactanceOhms;
      loadPower = (vLoadReal ** 2 + vLoadImag ** 2) * load.R / (load.R ** 2 + load.X ** 2);
    } else {
      const branchR = load.R + match.seriesResistanceOhms;
      const branchX = load.X + match.seriesReactanceOhms;
      loadPower = 0.25 * load.R / (branchR ** 2 + branchX ** 2);
    }
    expect(loadPower / 0.005).toBeCloseTo(match.efficiency, 9);
  });

  it('approaches a lossless match as component Q increases', () => {
    const load = { R: 5, X: 80 };
    expect(matchLNetwork(load, 250)!.lossDb).toBeLessThan(matchLNetwork(load, 80)!.lossDb);
    expect(matchLNetwork(load, Infinity)!.efficiency).toBeCloseTo(1, 12);
  });

  it('does not claim to match invalid or non-passive loads', () => {
    expect(matchLNetwork({ R: 0, X: 50 }, 150)).toBeUndefined();
    expect(matchLNetwork({ R: -5, X: 0 }, 150)).toBeUndefined();
    expect(matchLNetwork({ R: 50, X: 0 }, 0)).toBeUndefined();
  });
});
