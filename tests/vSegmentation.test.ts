import { describe, it, expect } from 'vitest';
import {
  buildSlopingVWires,
  buildInvertedVWires,
  SEGS_PER_WAVELENGTH,
  MIN_SEGS_PER_LEG,
  MAX_SEGS_PER_LEG,
} from '../src/store/antennaGeometry';
import { wavelengthMeters, FEED_BRIDGE_LENGTH_M } from '../src/physics/constants';
import type { Wire } from '../src/physics/types';
import { FEED_BRIDGE_TAG, LEFT_LEG_TAG, RIGHT_LEG_TAG } from '../src/physics/tags';

const BASE_PARAMS = {
  height: 15,
  orientation: 'EW' as const,
  wireRadius: 0.001,
  segments: 21,
};

const V_PARAMS = { ...BASE_PARAMS, vAngle: 90, legSlope: 0 };

/**
 * Sum NEC segments across every sub-wire that shares the given leg tag.
 * Sloping-V uses graded segmentation, so a leg is one Wire per graded
 * prefix segment plus one multi-segment Wire for the uniform tail; the
 * effective "segments per leg" is the sum across all of them.
 */
function legSegs(wires: Wire[], tag: number = LEFT_LEG_TAG): number {
  return wires.filter((w) => w.tag === tag).reduce((sum, w) => sum + w.segments, 0);
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

      expect(legSegs(wires, LEFT_LEG_TAG)).toBe(legSegs(wires, RIGHT_LEG_TAG));
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

      // At 14.2 MHz the same physical length is 2λ → tail count doubles.
      // The graded prefix is a fixed handful, so the overall ratio is
      // slightly less than 2.
      expect(segsHigh).toBeGreaterThanOrEqual(segsLow * 1.7);
      expect(segsHigh).toBeLessThanOrEqual(segsLow * 2.2);
    });

    it('doubling length on same frequency roughly doubles segments', () => {
      const freq = 14.2;
      const lambda = wavelengthMeters(freq);

      const total1 = 2 * lambda + FEED_BRIDGE_LENGTH_M; // 1λ per leg
      const total2 = 4 * lambda + FEED_BRIDGE_LENGTH_M; // 2λ per leg

      const segs1 = legSegs(buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total1, legSlope: 10 }));
      const segs2 = legSegs(buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total2, legSlope: 10 }));

      // Tail segments scale linearly with leg length; the graded prefix is
      // a fixed handful of segments. So the ratio approaches 2 but is
      // slightly biased downward by the shared prefix.
      expect(segs2).toBeGreaterThanOrEqual(segs1 * 1.7);
      expect(segs2).toBeLessThanOrEqual(segs1 * 2.2);
    });
  });

  describe('total segment count is bounded', () => {
    it('very long sloping-V scales segments with leg length (no hard cap)', () => {
      // With graded segmentation, the MAX_SEGS_PER_LEG cap no longer applies
      // to the sloping V — segment count is driven by physics (λ/SEGS_PER_WAVELENGTH).
      // total = 12λ + bridge → 6λ per leg → expect ~6 × SEGS_PER_WAVELENGTH = ~120
      // tail segments plus a handful of graded prefix segments.
      const freq = 28.5;
      const lambda = wavelengthMeters(freq);
      const total = 12 * lambda + FEED_BRIDGE_LENGTH_M;
      const legLambdas = (total - FEED_BRIDGE_LENGTH_M) / 2 / lambda;
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 10 });

      // At least roughly SEGS_PER_WAVELENGTH per λ of leg.
      expect(legSegs(wires)).toBeGreaterThanOrEqual(legLambdas * SEGS_PER_WAVELENGTH * 0.9);
      // No longer capped at the old MAX_SEGS_PER_LEG.
      expect(legSegs(wires)).toBeGreaterThan(MAX_SEGS_PER_LEG);
    });

    it('very long inverted-V is capped at MAX_SEGS_PER_LEG per leg', () => {
      // Inverted-V still uses uniform segmentation, so its cap still applies.
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

  describe('graded segmentation at the feed', () => {
    function legSubWires(wires: Wire[], tag: number): Wire[] {
      return wires.filter((w) => w.tag === tag);
    }

    // Approximate physical segment length implied by a Wire (NEC distributes
    // segments evenly along its length).
    function segmentLengthsOf(w: Wire): number[] {
      const dx = w.end[0] - w.start[0];
      const dy = w.end[1] - w.start[1];
      const dz = w.end[2] - w.start[2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return Array(w.segments).fill(len / w.segments);
    }

    /**
     * Per-segment lengths along a leg, ordered from apex outward.
     * Both legs are emitted with sub-wires concatenated head-to-tail, but
     * with different orientations (left: tip→apex; right: apex→tip), so we
     * reverse the left-leg order to get a consistent apex-outward sequence.
     */
    function apexToTipSegLengths(wires: Wire[], tag: number, side: 'left' | 'right'): number[] {
      const subs = legSubWires(wires, tag);
      const all: number[] = [];
      for (const w of subs) all.push(...segmentLengthsOf(w));
      return side === 'left' ? all.reverse() : all;
    }

    it('segment adjacent to the apex matches the feed-bridge length', () => {
      const freq = 18.118;
      const lambda = wavelengthMeters(freq);
      const total = 20 * lambda + FEED_BRIDGE_LENGTH_M; // 10λ per leg
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 10 });

      for (const tag of [LEFT_LEG_TAG, RIGHT_LEG_TAG] as const) {
        const segs = apexToTipSegLengths(wires, tag, tag === LEFT_LEG_TAG ? 'left' : 'right');
        // First segment (closest to the apex source) should equal the bridge.
        expect(segs[0]).toBeCloseTo(FEED_BRIDGE_LENGTH_M, 9);
      }
    });

    it('adjacent segments along a leg never differ by more than 2.1×', () => {
      const freq = 18.118;
      const lambda = wavelengthMeters(freq);
      const total = 20 * lambda + FEED_BRIDGE_LENGTH_M; // 10λ per leg
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 10 });

      for (const tag of [LEFT_LEG_TAG, RIGHT_LEG_TAG] as const) {
        const segs = apexToTipSegLengths(wires, tag, tag === LEFT_LEG_TAG ? 'left' : 'right');
        for (let i = 1; i < segs.length; i++) {
          const a = segs[i - 1]!;
          const b = segs[i]!;
          const ratio = Math.max(a, b) / Math.min(a, b);
          expect(ratio).toBeLessThanOrEqual(2.1);
        }
      }
    });

    it('graded prefix grows from bridge length up toward λ/SEGS_PER_WAVELENGTH', () => {
      const freq = 18.118;
      const lambda = wavelengthMeters(freq);
      const total = 20 * lambda + FEED_BRIDGE_LENGTH_M; // 10λ per leg
      const wires = buildSlopingVWires({ ...V_PARAMS, frequency: freq, length: total, legSlope: 10 });
      const segs = apexToTipSegLengths(wires, RIGHT_LEG_TAG, 'right');

      // The first few segments should monotonically increase until plateauing
      // at the uniform tail length, which is bounded by λ/SEGS_PER_WAVELENGTH.
      const targetTail = lambda / SEGS_PER_WAVELENGTH;
      expect(segs[0]).toBeLessThan(segs[3]!);
      const lastSeg = segs[segs.length - 1]!;
      expect(lastSeg).toBeLessThanOrEqual(targetTail * 1.05);
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
