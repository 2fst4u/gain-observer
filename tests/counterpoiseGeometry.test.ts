import { describe, expect, it } from 'vitest';
import { buildInvertedLWires, buildVerticalWhipWires } from '../src/store/antennaGeometry';
import { INVERTED_L_RADIAL_TAG, VERTICAL_WHIP_RADIAL_TAG } from '../src/physics/tags';
import { wavelengthMeters } from '../src/physics/constants';

const common = {
  length: 10, height: 4, orientation: 'EW' as const,
  wireRadius: 0.001, segments: 21, counterpoise: true,
  designFrequency: 7.1,
};

for (const [name, builder, radialTag] of [
  ['vertical whip', buildVerticalWhipWires, VERTICAL_WHIP_RADIAL_TAG],
  ['inverted L', buildInvertedLWires, INVERTED_L_RADIAL_TAG],
] as const) {
  describe(`${name} physical counterpoise`, () => {
    it('keeps the same radial endpoints when tuning changes frequency', () => {
      const at7 = builder({ ...common, frequency: 7.1 });
      const at14 = builder({ ...common, frequency: 14.2 });
      const endpoints = (wires: typeof at7) => wires.filter((w) => w.tag === radialTag)
        .map((w) => [w.start, w.end]);
      expect(endpoints(at14)).toEqual(endpoints(at7));
      const radial = at14.find((w) => w.tag === radialTag)!;
      expect(Math.hypot(...radial.end.map((v, i) => v - radial.start[i]!)))
        .toBeCloseTo(wavelengthMeters(7.1) * 0.2375, 9);
    });

    it('applies a fixed ground clearance to the source base and all radials', () => {
      // Clearance at the lowest intended frequency remains valid at all
      // higher frequencies without physically moving the ground screen.
      const minimumHeight = wavelengthMeters(1.8) * 0.001;
      const wires = builder({ ...common, height: 0, frequency: 7.1, minimumHeight });
      expect(wires[0]!.start[2]).toBeCloseTo(minimumHeight, 12);
      for (const w of wires.filter((w) => w.tag === radialTag)) {
        expect(w.start[2]).toBeCloseTo(minimumHeight, 12);
        expect(w.end[2]).toBeCloseTo(minimumHeight, 12);
      }
    });
  });
}
