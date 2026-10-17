import { describe, expect, it } from "vitest";
import {
  calculateMaxRangeKm,
  formatDistance,
  qualityOpacity,
  statusFill,
  worseQuality,
  worseStatus,
} from "../src/components/Charts/propagationRadarUtils";
import type { PropagationPrediction } from "../src/physics/propagation";
import { makeAzimuthalHop, makeHop, makePropagationPrediction } from "./helpers/factories";

describe("propagationRadarUtils", () => {
  describe("formatDistance", () => {
    it("formats metric distance in km", () => {
      expect(formatDistance(100, "metric")).toBe("100 km");
      expect(formatDistance(1234.56, "metric")).toBe("1235 km");
    });

    it("formats imperial distance in miles", () => {
      expect(formatDistance(160.9344, "imperial")).toBe("100 mi");
    });
  });

  describe("statusFill", () => {
    it("returns correct CSS variable for statuses", () => {
      expect(statusFill("open")).toBe("var(--success)");
      expect(statusFill("marginal")).toBe("var(--warning)");
      expect(statusFill("closed")).toBe("var(--danger)");
    });
  });

  describe("qualityOpacity", () => {
    it("returns correct opacity for qualities", () => {
      expect(qualityOpacity("useful")).toBe(0.16);
      expect(qualityOpacity("weak")).toBe(0.08);
      expect(qualityOpacity("unusable")).toBe(0.035);
    });
  });

  describe("worseStatus", () => {
    it("returns closed if either status is closed", () => {
      expect(worseStatus("open", "closed")).toBe("closed");
      expect(worseStatus("closed", "marginal")).toBe("closed");
    });

    it("returns marginal if neither is closed but at least one is marginal", () => {
      expect(worseStatus("open", "marginal")).toBe("marginal");
      expect(worseStatus("marginal", "open")).toBe("marginal");
    });

    it("returns open when both are open", () => {
      expect(worseStatus("open", "open")).toBe("open");
    });
  });

  describe("worseQuality", () => {
    it("returns unusable if either quality is unusable", () => {
      expect(worseQuality("useful", "unusable")).toBe("unusable");
      expect(worseQuality("unusable", "weak")).toBe("unusable");
    });

    it("returns weak if neither is unusable but at least one is weak", () => {
      expect(worseQuality("useful", "weak")).toBe("weak");
      expect(worseQuality("weak", "useful")).toBe("weak");
    });

    it("returns useful when both are useful", () => {
      expect(worseQuality("useful", "useful")).toBe("useful");
    });
  });

  describe("calculateMaxRangeKm", () => {
    it("calculates max range from hops when azimuthalHops are absent", () => {
      const pred: PropagationPrediction = makePropagationPrediction({
        hops: [
          makeHop({ n: 1, rangeKm: 1000 }),
          makeHop({ n: 2, rangeKm: 2000 }),
        ],
      });
      expect(calculateMaxRangeKm(pred)).toBe(2000);
    });

    it("takes max range from azimuthalHops when larger than last hop", () => {
      const pred: PropagationPrediction = makePropagationPrediction({
        hops: [makeHop({ n: 1, rangeKm: 1000 })],
        azimuthalHops: [
          makeAzimuthalHop({ phiDeg: 0, rangeKm: [1500] }),
          makeAzimuthalHop({ phiDeg: 90, rangeKm: [2500] }),
        ],
      });
      expect(calculateMaxRangeKm(pred)).toBe(2500);
    });

    it("defaults to 1 if hops array is empty and no azimuthalHops", () => {
      const pred: PropagationPrediction = makePropagationPrediction({
        hops: [],
      });
      expect(calculateMaxRangeKm(pred)).toBe(1);
    });
  });
});
