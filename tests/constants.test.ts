import { describe, expect, it } from 'vitest';
import {
  FEEDLINE_PRESETS,
  feedlineLossDb,
  findFeedlinePreset,
  findGroundPreset,
  halfWaveLength,
  referenceLength,
  HF_BAND_PRESETS,
} from '../src/physics/constants';
import { type AntennaType } from '../src/physics/types';

describe('physics constants and helpers', () => {
  it('halfWaveLength accounts for end effect', () => {
    // 40m band dipole
    // wavelength at 7.1 MHz = 299.792458 / 7.1 = 42.2242898...
    expect(halfWaveLength(7.1, 1.0)).toBeCloseTo(21.1121, 4);
    expect(halfWaveLength(7.1, 0.95)).toBeCloseTo(20.0565, 4);
  });

  it('HF_BAND_PRESETS contains standard bands', () => {
    const names = HF_BAND_PRESETS.map(p => p.name);
    expect(names).toContain('40m');
    expect(names).toContain('20m');
    expect(names).toContain('10m');
  });
});

describe('referenceLength', () => {
  // λ at 14.150 MHz (20m band) = 299.792458 / 14.150 ≈ 21.187 m
  const lambda = 299.792458 / 14.150;

  it('dipole: 0.5λ × end-effect (default 0.95)', () => {
    expect(referenceLength('dipole', 14.150)).toBeCloseTo(lambda * 0.5 * 0.95, 4);
  });

  it('dipole: custom end-effect overrides default', () => {
    expect(referenceLength('dipole', 14.150, 1.0)).toBeCloseTo(lambda * 0.5, 4);
  });

  it('inverted-v: slightly longer than flat dipole (0.5λ × 0.97)', () => {
    expect(referenceLength('inverted-v', 14.150)).toBeCloseTo(lambda * 0.5 * 0.97, 4);
  });

  it('delta-loop: 1.02λ perimeter (no end-effect correction for loops)', () => {
    expect(referenceLength('delta-loop', 14.150)).toBeCloseTo(lambda * 1.02, 4);
  });

  it('terminated-delta: 1.02λ perimeter, same as delta-loop', () => {
    expect(referenceLength('terminated-delta', 14.150)).toBeCloseTo(lambda * 1.02, 4);
  });

  it('sloping-v: 2λ total (1λ per leg, traveling-wave, no end-effect)', () => {
    expect(referenceLength('sloping-v', 14.150)).toBeCloseTo(lambda * 2.0, 4);
  });

  it('vertical-whip: quarter-wave monopole (0.25λ × end-effect)', () => {
    expect(referenceLength('vertical-whip', 14.150)).toBeCloseTo(lambda * 0.25 * 0.95, 4);
  });

  it('inverted-l: total wire for resonant quarter-wave (0.25λ × end-effect)', () => {
    expect(referenceLength('inverted-l', 14.150)).toBeCloseTo(lambda * 0.25 * 0.95, 4);
  });

  it('folded-dipole: same resonant length as standard dipole', () => {
    expect(referenceLength('folded-dipole', 14.150)).toBeCloseTo(lambda * 0.5 * 0.95, 4);
  });

  it('unknown type falls back to dipole default', () => {
    expect(referenceLength('unknown' as AntennaType, 14.150)).toBeCloseTo(lambda * 0.5 * 0.95, 4);
  });
});

describe('ground presets', () => {
  it('findGroundPreset returns correct preset for valid id', () => {
    const preset = findGroundPreset('sea');
    expect(preset.id).toBe('sea');
    expect(preset.label).toBe('Sea water');
  });

  it('findGroundPreset throws on unknown id', () => {
    expect(() => findGroundPreset('unknown-ground-type')).toThrowError(
      'Unknown ground preset id: unknown-ground-type',
    );
  });
});

describe('feedline presets', () => {
  it('always includes a "none" sentinel as the first option', () => {
    expect(FEEDLINE_PRESETS[0].id).toBe('none');
    expect(FEEDLINE_PRESETS[0].z0).toBe(0);
    expect(FEEDLINE_PRESETS[0].shieldOuterRadiusM).toBe(0);
  });

  it('contains common 50 Ω coax types', () => {
    const ids = FEEDLINE_PRESETS.map((f) => f.id);
    expect(ids).toContain('rg58');
    expect(ids).toContain('rg213');
    expect(ids).toContain('lmr400');
  });

  it('coax presets have plausible Z0, VF and shield radius', () => {
    for (const preset of FEEDLINE_PRESETS) {
      if (preset.id === 'none') continue;
      expect(preset.z0).toBeGreaterThan(0);
      expect(preset.velocityFactor).toBeGreaterThan(0);
      expect(preset.velocityFactor).toBeLessThanOrEqual(1);
      expect(preset.shieldOuterRadiusM).toBeGreaterThan(0);
    }
  });

  it('findFeedlinePreset returns correct preset for valid id', () => {
    const preset = findFeedlinePreset('rg58');
    expect(preset.id).toBe('rg58');
  });

  it('findFeedlinePreset returns fallback (none) on unknown id', () => {
    const preset = findFeedlinePreset('not-a-cable');
    expect(preset).toBe(FEEDLINE_PRESETS[0]);
    expect(preset.id).toBe('none');
  });

  it('feedlineLossDb scales linearly with length', () => {
    const rg58 = findFeedlinePreset('rg58');
    const at10 = feedlineLossDb(rg58, 14.15, 10);
    const at20 = feedlineLossDb(rg58, 14.15, 20);
    expect(at20).toBeCloseTo(at10 * 2, 6);
  });

  it('feedlineLossDb is higher at higher frequency for the same cable', () => {
    const rg58 = findFeedlinePreset('rg58');
    const lo = feedlineLossDb(rg58, 3.5, 30);
    const hi = feedlineLossDb(rg58, 28, 30);
    expect(hi).toBeGreaterThan(lo);
  });

  it('feedlineLossDb returns 0 for the "none" preset', () => {
    const none = findFeedlinePreset('none');
    expect(feedlineLossDb(none, 14.15, 100)).toBe(0);
  });
});
