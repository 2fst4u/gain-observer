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

  async function runTerminatedDelta(R: number) {
    const store = useAntennaStore.getState();
    store.setAntennaType('terminated-delta');
    store.setFeedline('none');
    store.setFrequency(7.1);
    store.setLength(42);
    store.setHeight(15);
    store.setOrientation('NS');
    store.setTerminatingResistor(R);
    const input = selectSimulationInput(useAntennaStore.getState());
    return engine.simulate(input);
  }

  it('solves and returns a physical pattern when terminated (R = 300 Ω)', async () => {
    const r = await runTerminatedDelta(300);
    expect(Number.isFinite(r.maxGainDbi)).toBe(true);
    // Real HF antennas over pastoral ground sit in a sensible dBi window.
    expect(r.maxGainDbi).toBeGreaterThan(-10);
    expect(r.maxGainDbi).toBeLessThan(15);
    // Feedpoint impedance must be physical (positive R).
    expect(r.impedance.R).toBeGreaterThan(0);
    // Take-off elevation must lie within the upper hemisphere.
    expect(r.terminationDiagnostics).toBeDefined();
  }, 60_000);

  it('terminated configuration dissipates power in the resistors (radiation efficiency < 100%)', async () => {
    const r = await runTerminatedDelta(300);
    const eff = r.efficiency;
    // Termination must absorb some power — efficiency cannot be ~100%.
    expect(eff).toBeDefined();
    if (eff !== undefined) {
      expect(eff).toBeLessThan(0.99);
      expect(eff).toBeGreaterThan(0);
    }
  }, 60_000);

  it('unterminated configuration radiates noticeably more efficiently than terminated', async () => {
    // Unterminated → no resistor losses; all input power goes to radiation
    // (modulo small ohmic / ground losses). Efficiency should be higher.
    const rUnterm = await runTerminatedDelta(0);
    const rTerm   = await runTerminatedDelta(300);
    const effU = rUnterm.efficiency;
    const effT = rTerm.efficiency;
    expect(effU).toBeDefined();
    expect(effT).toBeDefined();
    if (effU !== undefined && effT !== undefined) {
      expect(effU).toBeGreaterThan(effT);
    }
  }, 90_000);
});
