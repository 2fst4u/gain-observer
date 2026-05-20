import { describe, it, expect } from 'vitest';
import { buildWires } from '../src/store/antennaStore';
import { HF_BAND_PRESETS } from '../src/physics/constants';

describe('Delta Loop Preset Reproduction', () => {
  const presets = HF_BAND_PRESETS.filter(p => ['160m', '80m', '60m', '40m'].includes(p.name));

  it.each(presets)('generates valid wires for %s delta-loop', (preset) => {
    const frequency = preset.mhz;
    const lambda = 299.792458 / frequency;

    const wires = buildWires({
      antennaType: 'delta-loop',
      length: lambda,
      height: 10,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 21,
      frequency: frequency,
      feedlineId: 'none',
      feedlineLength: 0,
      feedlineOffset: 0,
      vAngle: 180,
      legSlope: 0,
    });

    expect(wires.length).toBeGreaterThan(0);
    wires.forEach((w, i) => {
      expect(w.segments).toBeGreaterThan(0);
      expect(w.radius).toBeGreaterThan(0);

      // Check for NaN
      expect(w.start[0]).not.toBeNaN();
      expect(w.start[1]).not.toBeNaN();
      expect(w.start[2]).not.toBeNaN();
      expect(w.end[0]).not.toBeNaN();
      expect(w.end[1]).not.toBeNaN();
      expect(w.end[2]).not.toBeNaN();

      // Check for zero length wires (unless intentional, which it shouldn't be here)
      const length = Math.sqrt(
        Math.pow(w.end[0] - w.start[0], 2) +
        Math.pow(w.end[1] - w.start[1], 2) +
        Math.pow(w.end[2] - w.start[2], 2)
      );
      expect(length).toBeGreaterThan(1e-6);
    });
  });
});
