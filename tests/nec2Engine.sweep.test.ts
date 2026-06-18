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

describe('sweepImpedance with an explicit window (interactive zoom/pan)', () => {
  it('samples exactly across the requested window and clamps to HF limits', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());

    const sweep = await engine.sweepImpedance(input, {
      points: 9,
      window: { startMHz: 6.8, endMHz: 7.4 },
    });

    expect(sweep).toHaveLength(9);
    expect(sweep[0]!.frequencyMHz).toBeCloseTo(6.8, 6);
    expect(sweep[sweep.length - 1]!.frequencyMHz).toBeCloseTo(7.4, 6);
  }, 60_000);

  it('resamples a narrower window at finer resolution (zoom in)', async () => {
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();
    const input = selectSimulationInput(useAntennaStore.getState());

    const wide = await engine.sweepImpedance(input, { points: 9, window: { startMHz: 6.0, endMHz: 8.0 } });
    const zoomed = await engine.sweepImpedance(input, { points: 9, window: { startMHz: 7.0, endMHz: 7.2 } });

    const wideSpacing = wide[1]!.frequencyMHz - wide[0]!.frequencyMHz;
    const zoomedSpacing = zoomed[1]!.frequencyMHz - zoomed[0]!.frequencyMHz;
    // Same point count over a 10× narrower span → ~10× finer sample spacing.
    expect(zoomedSpacing).toBeLessThan(wideSpacing);
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

  it('frames the sweep around detected bands with the operating frequency in view', async () => {
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

    // Operating frequency stays in view.
    expect(sweep[0]!.frequencyMHz).toBeLessThanOrEqual(FREQ);
    expect(sweep[sweep.length - 1]!.frequencyMHz).toBeGreaterThanOrEqual(FREQ);

    // The adaptive sweep frames the window around detected bands — it must not
    // dump the entire 1.0–30 MHz sweep range regardless of what bands are found.
    // (The SWR minimum is validated by the 'best SWR is near resonance' test
    // which uses a fixed spanFraction; with only 15 points over a potentially
    // wide multi-band window the resolution may not capture the dip exactly.)
    const span = sweep[sweep.length - 1]!.frequencyMHz - sweep[0]!.frequencyMHz;
    expect(span).toBeLessThan(28.2); // full sweep span ≈ 29 MHz
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

  it('keeps a narrowband dipole framed on its operating band, not a harmonic', async () => {
    // Regression: a regular horizontal dipole is resonant on its fundamental
    // AND on harmonics (a 26.58 m dipole driven on the 60 m band at 5.358 MHz
    // is also resonant near ~28 MHz). The broad-scan multi-band detection used
    // to merge that distant harmonic into the window, stretching the sweep to
    // span the whole HF range. With only 15 points across ~29 MHz the narrow
    // operating band fell between samples — so Min SWR / the marker reported
    // the harmonic instead of the resonant operating frequency. The
    // resolve-aware merge must keep the window focused on the operating band.
    const engine = new Nec2Engine({ baseUrl: wasmUrl });
    await engine.init();

    const opFreq = 5.358;
    const state = {
      ...useAntennaStore.getState(),
      antennaType: 'dipole',
      length: 26.58,
      height: 8,
      frequency: opFreq,
      orientation: 'EW',
      transformerEnabled: false,
      feedlineId: 'none',
    } as AntennaState;

    const sweep = await engine.sweepImpedance(selectSimulationInput(state), { points: 15 });

    const start = sweep[0]!.frequencyMHz;
    const end = sweep[sweep.length - 1]!.frequencyMHz;

    // Operating frequency is in view, framed by a window centred on its band.
    expect(start).toBeLessThanOrEqual(opFreq);
    expect(end).toBeGreaterThanOrEqual(opFreq);
    // The distant ~28 MHz harmonic must NOT pull the window open — the span
    // stays tight around the operating band rather than reaching up to it.
    expect(end).toBeLessThan(10);

    // The resolved minimum SWR sits on the operating band (low and near opFreq),
    // not on the harmonic up near 28 MHz.
    let minSwr = Infinity;
    let minFreq = 0;
    for (const p of sweep) {
      if (p.swr < minSwr) {
        minSwr = p.swr;
        minFreq = p.frequencyMHz;
      }
    }
    expect(minSwr).toBeLessThan(2);
    expect(minFreq).toBeGreaterThan(4.5);
    expect(minFreq).toBeLessThan(6.5);
  }, 90_000);
});
