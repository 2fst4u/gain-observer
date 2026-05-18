import { describe, it, expect } from 'vitest';
import {
  buildSlopingVWires,
  buildInvertedVWires,
  SEGS_PER_WAVELENGTH,
  MIN_SEGS_PER_LEG,
  MAX_SEGS_PER_LEG,
} from '../src/store/antennaGeometry';
import { wavelengthMeters, FEED_BRIDGE_LENGTH_M, FEED_BRIDGE_TAG, DIPOLE_LEFT_TAG } from '../src/physics/constants';

const BASE_PARAMS = {
  height: 15,
  orientation: 'EW' as const,
  wireRadius: 0.001,
  segments: 21,
};

const V_PARAMS = { ...BASE_PARAMS, vAngle: 90, legSlope: 0 };

function legSegs(wires: ReturnType<typeof buildSlopingVWires>): number {
  return wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!.segments;
}

describe('V-antenna wavelength-based segmentation', () => {
  describe('1λ/leg sloping-V at 7.1 MHz', () => {
    it('each leg has at least SEGS_PER_WAVELENGTH segments', () => {
      const freq = 7.1;
      const lambda = wavelengthMeters(freq);
      const total = 2 * lambda + FEED_BRIDGE_LENGTH_M;
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 15 });

      expect(legSegs(wires)).toBeGreaterThanOrEqual(SEGS_PER_WAVELENGTH);
    });

    it('both legs have the same segment count', () => {
      const freq = 7.1;
      const lambda = wavelengthMeters(freq);
      const total = 2 * lambda + FEED_BRIDGE_LENGTH_M;
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 15 });

      const leftSegs = wires.find((w) => w.tag === 1)!.segments;
      const rightSegs = wires.find((w) => w.tag === 2)!.segments;
      expect(leftSegs).toBe(rightSegs);
    });
  });

  describe('1λ/leg inverted-V at 7.1 MHz', () => {
    it('each leg has at least SEGS_PER_WAVELENGTH segments', () => {
      const freq = 7.1;
      const lambda = wavelengthMeters(freq);
      const total = 2 * lambda + FEED_BRIDGE_LENGTH_M;
      const wires = buildInvertedVWires({ ...BASE_PARAMS, frequency: freq, length: total, vAngle: 120 });

      expect(legSegs(wires)).toBeGreaterThanOrEqual(SEGS_PER_WAVELENGTH);
    });
  });

  describe('segment count scales with frequency', () => {
    it('doubling frequency on same physical sloping-V roughly doubles segments', () => {
      const baseFreq = 7.1;
      const lambda = wavelengthMeters(baseFreq);
      const total = 2 * lambda + FEED_BRIDGE_LENGTH_M; // 1λ per leg at 7.1 MHz

      const segsLow = legSegs(
        buildSlopingVWires({ ...V_PARAMS, frequency: baseFreq, length: total, legSlope: 10 }),
      );
      const segsHigh = legSegs(
        buildSlopingVWires({ ...V_PARAMS, frequency: baseFreq * 2, length: total, legSlope: 10 }),
      );

      // At 14.2 MHz the same physical length is 2λ → expect roughly 2× more segments.
      expect(segsHigh).toBeGreaterThanOrEqual(segsLow * 1.8);
      expect(segsHigh).toBeLessThanOrEqual(segsLow * 2.2);
    });

    it('doubling length on same frequency roughly doubles segments', () => {
      const freq = 14.2;
      const lambda = wavelengthMeters(freq);

      const total1 = 2 * lambda + FEED_BRIDGE_LENGTH_M; // 1λ per leg
      const total2 = 4 * lambda + FEED_BRIDGE_LENGTH_M; // 2λ per leg

      const segs1 = legSegs(buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total1, legSlope: 10 }));
      const segs2 = legSegs(buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total2, legSlope: 10 }));

      expect(segs2).toBeGreaterThanOrEqual(segs1 * 1.8);
      expect(segs2).toBeLessThanOrEqual(MAX_SEGS_PER_LEG);
    });
  });

  describe('total segment count is bounded', () => {
    it('very long sloping-V is capped at MAX_SEGS_PER_LEG per leg', () => {
      const freq = 28.5;
      const lambda = wavelengthMeters(freq);
      const total = 12 * lambda + FEED_BRIDGE_LENGTH_M;
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 10 });

      expect(legSegs(wires)).toBeLessThanOrEqual(MAX_SEGS_PER_LEG);
    });

    it('very long inverted-V is capped at MAX_SEGS_PER_LEG per leg', () => {
      const freq = 28.5;
      const lambda = wavelengthMeters(freq);
      const total = 12 * lambda + FEED_BRIDGE_LENGTH_M;
      const wires = buildInvertedVWires({ ...BASE_PARAMS, frequency: freq, length: total, vAngle: 120 });

      expect(legSegs(wires)).toBeLessThanOrEqual(MAX_SEGS_PER_LEG);
    });
  });

  describe('minimum segment floor', () => {
    it('a very short sloping-V still has at least MIN_SEGS_PER_LEG per leg', () => {
      const wires = buildSlopingVWires({
        ...V_PARAMS,
        frequency: 7.1,
        length: 2,
        segments: 1,
        legSlope: 15,
      });
      expect(legSegs(wires)).toBeGreaterThanOrEqual(MIN_SEGS_PER_LEG);
    });
  });

  describe('feed bridge stays at 1 segment regardless of leg length', () => {
    it('bridge has 1 segment for a 1λ/leg sloping-V', () => {
      const freq = 7.1;
      const lambda = wavelengthMeters(freq);
      const total = 2 * lambda + FEED_BRIDGE_LENGTH_M;
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 10 });

      const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
      expect(bridge.segments).toBe(1);
    });

    it('bridge has 1 segment for a 5λ/leg sloping-V', () => {
      const freq = 14.2;
      const lambda = wavelengthMeters(freq);
      const total = 10 * lambda + FEED_BRIDGE_LENGTH_M;
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 10 });

      const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
      expect(bridge.segments).toBe(1);
    });
  });
});
