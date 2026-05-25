import { describe, expect, it } from 'vitest';
import { Nec2Engine } from '../src/physics/nec2Engine';
import { selectSimulationInput, useAntennaStore, type AntennaState } from '../src/store/antennaStore';
import { halfWaveLength } from '../src/physics/constants';
import { swr as computeSwr } from '../src/physics/impedance';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const wasmUrl = pathToFileURL(resolve(process.cwd(), 'public/')).href + '/';

describe('sweepImpedance with default store input', () => {
  it('produces an impedance result for every sweep point', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());
    const sweep = await engine.sweepImpedance(input, { points: 5, spanFraction: 0.1 });
    expect(sweep).toHaveLength(5);
    for (const p of sweep) {
      expect(Number.isFinite(p.R)).toBe(true);
      expect(Number.isFinite(p.X)).toBe(true);
      expect(Number.isFinite(p.swr)).toBe(true);
      expect(p.R).toBeGreaterThan(0);
    }
    // Center point should be near 73Ω-ish given a ½λ dipole 10m up.
    const centre = sweep[Math.floor(sweep.length / 2)]!;
    expect(centre.R).toBeGreaterThan(40);
    expect(centre.R).toBeLessThan(120);

    // Frequencies should be monotonic.
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]!.frequencyMHz).toBeGreaterThan(sweep[i - 1]!.frequencyMHz);
    }
  }, 60_000);

  it('best SWR is near resonance', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());
    // Span ±20% to ensure we see the dip
    const sweep = await engine.sweepImpedance(input, { points: 11, spanFraction: 0.4 });

    let minSwr = Infinity;
    let bestFreq = 0;
    for (const p of sweep) {
      if (p.swr < minSwr) {
        minSwr = p.swr;
        bestFreq = p.frequencyMHz;
      }
    }

    // Default antenna is resonant at 7.1 MHz.
    expect(bestFreq).toBeGreaterThan(6.5);
    expect(bestFreq).toBeLessThan(7.7);
    // Standard dipole above ground might not hit 1.0 but should be < 2.0
    expect(minSwr).toBeLessThan(2.0);
  }, 60_000);
});

describe('adaptive sweep framing (no spanFraction)', () => {
  const FREQ = 7.1;

  function foldedState(R: number): AntennaState {
    return {
      ...useAntennaStore.getState(),
      antennaType: 'folded-dipole',
      length: halfWaveLength(FREQ),
      height: 10,
      frequency: FREQ,
      orientation: 'EW',
      groundId: 'free',
      foldedDipoleAperture: 0.3,
      terminatingResistor: R,
      transformerEnabled: false,
      // Isolate from feedline modelling — folded-dipole gained feedline
      // support in a later PR; without this override the default 'rg58'
      // feedline would be included and would alter the impedance values
      // that the adaptive-sweep assertions rely on.
      feedlineId: 'none',
    } as AntennaState;
  }

  it('frames a narrowband dipole tightly around resonance and brackets the 2:1 BW', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());

    // No spanFraction → adaptive framing.
    const sweep = await engine.sweepImpedance(input, { points: 15 });
    expect(sweep).toHaveLength(15);

    // Monotonic increasing frequencies.
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i]!.frequencyMHz).toBeGreaterThan(sweep[i - 1]!.frequencyMHz);
    }

    // Minimum near resonance, and the operating frequency stays in view.
    let minFreq = 0;
    let minSwr = Infinity;
    for (const p of sweep) {
      if (p.swr < minSwr) {
        minSwr = p.swr;
        minFreq = p.frequencyMHz;
      }
    }
    expect(minFreq).toBeGreaterThan(6.5);
    expect(minFreq).toBeLessThan(7.7);
    expect(sweep[0]!.frequencyMHz).toBeLessThanOrEqual(FREQ);
    expect(sweep[sweep.length - 1]!.frequencyMHz).toBeGreaterThanOrEqual(FREQ);

    // The window is zoomed around the dip, not the whole HF band.
    const span = sweep[sweep.length - 1]!.frequencyMHz - sweep[0]!.frequencyMHz;
    expect(span).toBeLessThan(FREQ * 0.6);
  }, 60_000);

  it('widens the window for a broadband T2FD so its span exceeds a dipole', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();

    const dipole = await engine.sweepImpedance(
      selectSimulationInput(useAntennaStore.getState()),
      { points: 15 },
    );
    const dipoleSpan =
      dipole[dipole.length - 1]!.frequencyMHz - dipole[0]!.frequencyMHz;

    // T2FD: R=600 Ω, displayed through an ~18:1 balun (round((300+600)/50)).
    const R = 600;
    const displayRatio = Math.round((300 + R) / 50);
    const tfd = await engine.sweepImpedance(selectSimulationInput(foldedState(R)), {
      points: 15,
      displayRatio,
    });
    const tfdSpan = tfd[tfd.length - 1]!.frequencyMHz - tfd[0]!.frequencyMHz;

    // The broadband antenna's framed window is meaningfully wider.
    expect(tfdSpan).toBeGreaterThan(dipoleSpan);

    // The effective (post-balun) SWR dips below 2:1 somewhere in the window —
    // i.e. the adaptive sweep actually found the usable band rather than a flat
    // raw curve sitting far above 2:1.
    let minEff = Infinity;
    for (const p of tfd) {
      const eff = computeSwr({ R: p.R / displayRatio, X: p.X / displayRatio });
      if (eff < minEff) minEff = eff;
    }
    expect(minEff).toBeLessThan(2);
  }, 90_000);
});
