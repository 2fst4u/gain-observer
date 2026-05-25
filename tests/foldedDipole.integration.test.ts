// Integration test: a folded dipole built through selectSimulationInput and
// solved by the real NEC-2 Wasm engine. Guards two physics claims:
//   1. An unterminated folded dipole presents ~4× a plain dipole (~300 Ω) and
//      radiates like a dipole (~2 dBi in free space).
//   2. Adding a terminating resistor (TFD) dissipates power — gain drops and
//      the feedpoint impedance changes.

import { describe, expect, it, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { useAntennaStore, selectSimulationInput, type AntennaState } from '../src/store/antennaStore';
import { halfWaveLength } from '../src/physics/constants';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

const FREQ = 7.1;

function foldedState(overrides: Partial<AntennaState>): AntennaState {
  return {
    ...useAntennaStore.getState(),
    antennaType: 'folded-dipole',
    length: halfWaveLength(FREQ),
    height: 10,
    frequency: FREQ,
    orientation: 'EW',
    groundId: 'free',
    foldedDipoleAperture: 0.3,
    terminatingResistor: 0,
    transformerEnabled: false,
    // These tests measure the bare antenna feedpoint; the feedline-fed case is
    // covered by its own test that overrides feedlineId explicitly.
    feedlineId: 'none',
    ...overrides,
  } as AntennaState;
}

describe('Folded dipole (real Wasm)', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  it('unterminated: ~4× dipole feedpoint (~300 Ω) and dipole-like gain in free space', async () => {
    const r = await engine.simulate(selectSimulationInput(foldedState({})));

    expect(Number.isFinite(r.maxGainDbi)).toBe(true);
    // Free-space dipole gain ~2.15 dBi; the fold does not change the pattern.
    expect(r.maxGainDbi).toBeGreaterThan(1.8);
    expect(r.maxGainDbi).toBeLessThan(2.8);
    // Feedpoint is the folded dipole's hallmark ~4× a plain dipole (~300 Ω).
    expect(r.impedance.R).toBeGreaterThan(200);
    expect(r.impedance.R).toBeLessThan(400);
  }, 30_000);

  it('terminated (TFD): resistor dissipates power and raises the feedpoint impedance', async () => {
    const unterminated = await engine.simulate(selectSimulationInput(foldedState({})));
    const terminated = await engine.simulate(
      selectSimulationInput(foldedState({ terminatingResistor: 600 })),
    );

    expect(Number.isFinite(terminated.maxGainDbi)).toBe(true);
    // The resistor dissipates a substantial fraction of the input power.
    expect(terminated.maxGainDbi).toBeLessThan(unterminated.maxGainDbi);
    // The terminating R is in series with the top-conductor current path.
    // The feedpoint impedance increases by approximately R:
    //   Z_terminated ≈ Z_unterminated + R  (≈ 280 + 600 = 880 Ω)
    // This is correct physics — a 6:1 balun brings the displayed feedpoint
    // to ~145 Ω, which is usable. A larger R drives the antenna closer to
    // a true traveling-wave termination (matching the two-wire line's Z0).
    expect(terminated.impedance.R).toBeGreaterThan(unterminated.impedance.R);
    // The increase should be substantial (close to R = 600 Ω).
    expect(terminated.impedance.R - unterminated.impedance.R).toBeGreaterThan(400);
  }, 30_000);

  it('feedline + high-ratio transformer (NT card) solves with finite gain and impedance', async () => {
    // A coax shield drops from the feedpoint and the auto-matched ~18:1 unun is
    // modelled in NEC via an NT card. Guard that this high-ratio NT-card path
    // produces a finite, physical solution rather than aborting.
    const r = await engine.simulate(
      selectSimulationInput(
        foldedState({
          terminatingResistor: 600,
          feedlineId: 'rg58',
          feedlineLength: 8,
          transformerEnabled: true,
          transformerRatio: 18,
        }),
      ),
    );
    expect(Number.isFinite(r.maxGainDbi)).toBe(true);
    expect(Number.isFinite(r.impedance.R)).toBe(true);
    expect(Number.isFinite(r.impedance.X)).toBe(true);
    expect(r.impedance.R).toBeGreaterThan(0);
  }, 30_000);
});
