// Integration test: real NEC-2 engine vs. the terminated delta deck.
// Verifies the antenna actually solves to physical numbers and that the
// termination meaningfully changes the pattern (travelling-wave vs.
// standing-wave). Mirrors the structure of nec2Engine.integration.test.ts.

import { describe, expect, it, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

describe('Terminated Delta — end-to-end NEC simulation', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  async function runTerminatedDelta(R: number, frequencyMHz = 7.1) {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFeedline('none');
    store.setFrequency(frequencyMHz);
    store.setLength(42);
    store.setHeight(15);
    store.setOrientation('NS');
    store.setTerminatingResistor(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    return engine.simulate(input);
  }

  it('solves and returns a physical pattern when terminated (R = 600 Ω)', async () => {
    const r = await runTerminatedDelta(600);
    expect(Number.isFinite(r.maxGainDbi)).toBe(true);
    // Real HF antennas over pastoral ground sit in a sensible dBi window.
    expect(r.maxGainDbi).toBeGreaterThan(-15);
    expect(r.maxGainDbi).toBeLessThan(15);
    // Feedpoint impedance must be physical (positive R).
    expect(r.impedance.R).toBeGreaterThan(0);
    expect(r.terminationDiagnostics).toBeDefined();
  }, 60_000);

  it('terminated configuration dissipates power in the resistor (radiation efficiency < 100%)', async () => {
    const r = await runTerminatedDelta(600);
    const eff = r.efficiency;
    expect(eff).toBeDefined();
    if (eff !== undefined) {
      expect(eff).toBeLessThan(0.99);
      expect(eff).toBeGreaterThan(0);
    }
  }, 60_000);

  it('unterminated configuration radiates noticeably more efficiently than terminated', async () => {
    const rUnterm = await runTerminatedDelta(0);
    const rTerm   = await runTerminatedDelta(600);
    const effU = rUnterm.efficiency;
    const effT = rTerm.efficiency;
    expect(effU).toBeDefined();
    expect(effT).toBeDefined();
    if (effU !== undefined && effT !== undefined) {
      expect(effU).toBeGreaterThan(effT);
    }
  }, 90_000);

  it('current ripple on the legs drops markedly when the bridge resistor is engaged', async () => {
    // The whole point of a T2FD-style termination: the wave that would
    // otherwise reflect off the gap is absorbed, so the current envelope
    // on each radiating leg becomes much more uniform.
    const rUnterm = await runTerminatedDelta(0);
    const rTerm   = await runTerminatedDelta(600);
    const rippleLegs = (r: typeof rTerm) =>
      (r.terminationDiagnostics?.currentRippleByTag ?? [])
        .filter((cr) => cr.tagNo === 1 || cr.tagNo === 2)
        .map((cr) => cr.rippleDb);
    const untRipples = rippleLegs(rUnterm);
    const trmRipples = rippleLegs(rTerm);
    expect(untRipples.length).toBe(2);
    expect(trmRipples.length).toBe(2);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(trmRipples)).toBeLessThan(avg(untRipples) - 3);
  }, 90_000);

  it('feedpoint impedance stays in a flat-ish window across an octave (broadband claim)', async () => {
    // The bridge-terminated delta is an aperiodic broadband loop: real
    // impedance should stay within a ~1:6 window across an octave, and
    // reactance bounded. These are the falsifiable claims behind
    // "broadband terminated loop".
    const freqs = [7.1, 10.1, 14.0, 21.0, 28.0];
    const results = await Promise.all(freqs.map((f) => runTerminatedDelta(600, f)));
    const Rs = results.map((r) => r.impedance.R);
    const Xs = results.map((r) => Math.abs(r.impedance.X));
    const Rmin = Math.min(...Rs);
    const Rmax = Math.max(...Rs);
    expect(Rmin).toBeGreaterThan(200);
    expect(Rmax).toBeLessThan(2000);
    expect(Rmax / Rmin).toBeLessThan(6);
    for (const xMag of Xs) {
      expect(xMag).toBeLessThan(700);
    }
  }, 180_000);
});
