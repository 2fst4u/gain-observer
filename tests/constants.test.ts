import { describe, expect, it } from "vitest";
import {
  FEEDLINE_PRESETS,
  feedlineLossDb,
  findFeedlinePreset,
  findGroundPreset,
  GROUND_PRESETS,
  halfWaveLength,
  HF_BAND_PRESETS,
} from "../src/physics/constants";

describe("physics constants and helpers", () => {
  it("halfWaveLength accounts for end effect", () => {
    // 40m band dipole
    // wavelength at 7.1 MHz = 299.792458 / 7.1 = 42.2242898...
    expect(halfWaveLength(7.1, 1.0)).toBeCloseTo(21.1121, 4);
    expect(halfWaveLength(7.1, 0.95)).toBeCloseTo(20.0565, 4);
  });

  it("HF_BAND_PRESETS contains standard bands", () => {
    const names = HF_BAND_PRESETS.map((p) => p.name);
    expect(names).toContain("40m");
    expect(names).toContain("20m");
    expect(names).toContain("10m");
  });
});

describe("ground presets", () => {
  it("findGroundPreset returns the correct preset for a valid id", () => {
    const preset = findGroundPreset("pastoral");
    expect(preset).toBeDefined();
    expect(preset.id).toBe("pastoral");
    expect(preset.label).toBe("Pastoral (avg)");
  });

  it("findGroundPreset returns the default preset (first element) for an unknown id", () => {
    const fallback = findGroundPreset("unknown-ground-id");
    expect(fallback).toBeDefined();
    expect(fallback.id).toBe(GROUND_PRESETS[0].id);
    expect(fallback.label).toBe(GROUND_PRESETS[0].label);
  });
});

describe("feedline presets", () => {
  it('always includes a "none" sentinel as the first option', () => {
    expect(FEEDLINE_PRESETS[0].id).toBe("none");
    expect(FEEDLINE_PRESETS[0].z0).toBe(0);
    expect(FEEDLINE_PRESETS[0].shieldOuterRadiusM).toBe(0);
  });

  it("contains common 50 Ω coax types", () => {
    const ids = FEEDLINE_PRESETS.map((f) => f.id);
    expect(ids).toContain("rg58");
    expect(ids).toContain("rg213");
    expect(ids).toContain("lmr400");
  });

  it("coax presets have plausible Z0, VF and shield radius", () => {
    for (const preset of FEEDLINE_PRESETS) {
      if (preset.id === "none") continue;
      expect(preset.z0).toBeGreaterThan(0);
      expect(preset.velocityFactor).toBeGreaterThan(0);
      expect(preset.velocityFactor).toBeLessThanOrEqual(1);
      expect(preset.shieldOuterRadiusM).toBeGreaterThan(0);
    }
  });

  it("findFeedlinePreset throws on unknown id", () => {
    expect(() => findFeedlinePreset("not-a-cable")).toThrow();
  });

  it("feedlineLossDb scales linearly with length", () => {
    const rg58 = findFeedlinePreset("rg58");
    const at10 = feedlineLossDb(rg58, 14.15, 10);
    const at20 = feedlineLossDb(rg58, 14.15, 20);
    expect(at20).toBeCloseTo(at10 * 2, 6);
  });

  it("feedlineLossDb is higher at higher frequency for the same cable", () => {
    const rg58 = findFeedlinePreset("rg58");
    const lo = feedlineLossDb(rg58, 3.5, 30);
    const hi = feedlineLossDb(rg58, 28, 30);
    expect(hi).toBeGreaterThan(lo);
  });

  it('feedlineLossDb returns 0 for the "none" preset', () => {
    const none = findFeedlinePreset("none");
    expect(feedlineLossDb(none, 14.15, 100)).toBe(0);
  });
});
