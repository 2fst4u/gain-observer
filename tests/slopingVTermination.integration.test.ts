// Integration test: real NEC-2 engine vs. the sloping-V termination.
//
// These assertions exist because the termination was, for a time, purely
// decorative. The stub ran from each leg tip down to 1 cm above ground and
// carried the LD-4 resistor, which *looks* like a tip-to-earth termination
// and passes every structural check — the stub wires are there, the LD cards
// are there, on the right tags, with the right resistance. It absorbed 0.9 %
// of the input power. NEC-2 cannot bond a wire to a Sommerfeld-Norton
// ground, so the stub end was an open circuit and the resistor sat in series
// with its own end capacitance.
//
// Nothing in the deck's *shape* can catch that. Only running the solver and
// asking whether the resistor does any work can, which is what these tests
// do: the deck is not the physics.
import { describe, expect, it, beforeAll } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import type { SimulationInput, SimulationResult } from '../src/physics/types';
import { LEFT_LEG_TAG, RIGHT_LEG_TAG } from '../src/physics/tags';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

describe('Sloping V — termination actually terminates', () => {
  let engine: Nec2Engine;

  beforeAll(async () => {
    engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
  }, 30_000);

  function input(R: number): SimulationInput {
    const store = useAntennaStore.getState();
    store.setAntennaType('sloping-v');
    store.setFeedline('none');
    store.setFrequency(7.1);
    store.setLength(84);
    store.setHeight(15);
    store.setVAngle(90);
    store.setOrientation('NS');
    store.setTerminatingResistor(R);
    return selectSimulationInput(useAntennaStore.getState());
  }

  const run = (R: number) => engine.simulate(input(R));

  /** Mean current ripple across the two radiating legs, in dB. */
  function legRipple(r: SimulationResult): number {
    const xs = (r.terminationDiagnostics?.currentRippleByTag ?? [])
      .filter((c) => c.tagNo === LEFT_LEG_TAG || c.tagNo === RIGHT_LEG_TAG)
      .map((c) => c.rippleDb);
    expect(xs).toHaveLength(2);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  it('the terminating resistor absorbs a large share of the input power', async () => {
    const r = await run(500);
    // A travelling-wave antenna pays for its bandwidth in the termination.
    // The broken stub-only model sat at 98.5 % here.
    expect(r.efficiency).toBeDefined();
    expect(r.efficiency!).toBeLessThan(0.8);
    expect(r.efficiency!).toBeGreaterThan(0.05);
  }, 60_000);

  it('the counterpoise alone absorbs nothing — the resistor does the work', async () => {
    // Same geometry, LD cards stripped. If efficiency stays near 100 % here
    // but drops with the resistor fitted, the loss is genuinely in the
    // termination and not in the modelling scaffolding around it.
    const terminated = input(500);
    const withoutLoads: SimulationInput = { ...terminated, loads: [] };
    const r = await engine.simulate(withoutLoads);
    expect(r.efficiency).toBeDefined();
    expect(r.efficiency!).toBeGreaterThan(0.95);
  }, 60_000);

  it('termination collapses the standing wave on the legs', async () => {
    const unterminated = await run(0);
    const terminated = await run(500);
    // Unterminated the legs carry a full standing wave (~18-23 dB of ripple).
    expect(legRipple(unterminated)).toBeGreaterThan(10);
    // Terminated, the envelope should be close to flat.
    expect(legRipple(terminated)).toBeLessThan(5);
    expect(legRipple(terminated)).toBeLessThan(legRipple(unterminated) - 8);
  }, 90_000);

  it('the ripple optimum lands near the leg characteristic impedance', async () => {
    // The sharpest evidence that this is a real termination rather than a
    // resistor bolted onto a resonant antenna: absorption should peak when R
    // matches the leg's Z0 against ground (400-600 Ω), and get worse on
    // either side. A decorative resistor shows no such optimum.
    const [tooLow, matched, tooHigh] = await Promise.all([
      run(100).then(legRipple),
      run(500).then(legRipple),
      run(1200).then(legRipple),
    ]);
    expect(matched).toBeLessThan(tooLow);
    expect(matched).toBeLessThan(tooHigh);
  }, 120_000);

  it('extreme geometries still solve with the counterpoise fitted', async () => {
    // The radial screens are capped at 40 % of the tip separation so they
    // cannot overlap, which NEC would reject. The tightest V (10°) at the
    // bottom of the band is the case that would breach it, and a mast low
    // enough to put the tips almost on the ground is the case that would
    // push the hub above the tip it hangs from.
    const cases: Array<[number, number, number, number]> = [
      // frequency, length, height, vAngle
      [1.8, 20, 3, 10],
      [1.8, 300, 30, 170],
      [30, 10, 2, 10],
      [7.1, 84, 0.6, 90],
      [3.5, 40, 5, 20],
    ];
    for (const [frequency, length, height, vAngle] of cases) {
      const store = useAntennaStore.getState();
      store.setAntennaType('sloping-v');
      store.setFeedline('none');
      store.setFrequency(frequency);
      store.setLength(length);
      store.setHeight(height);
      store.setVAngle(vAngle);
      store.setTerminatingResistor(300);
      const r = await engine.simulate(selectSimulationInput(useAntennaStore.getState()));
      expect(Number.isFinite(r.maxGainDbi)).toBe(true);
      expect(r.impedance.R).toBeGreaterThan(0);
    }
  }, 180_000);

  it('feedpoint resistance stays in a flat window across an octave', async () => {
    // Aperiodic behaviour is the point of terminating: no resonant swings.
    const store = useAntennaStore.getState();
    const results: SimulationResult[] = [];
    for (const f of [7.1, 10.1, 14.0, 21.0, 28.0]) {
      store.setAntennaType('sloping-v');
      store.setFeedline('none');
      store.setFrequency(f);
      store.setLength(84);
      store.setHeight(15);
      store.setVAngle(90);
      store.setTerminatingResistor(500);
      results.push(await engine.simulate(selectSimulationInput(useAntennaStore.getState())));
    }
    const Rs = results.map((r) => r.impedance.R);
    expect(Math.max(...Rs) / Math.min(...Rs)).toBeLessThan(3);
  }, 180_000);
});
