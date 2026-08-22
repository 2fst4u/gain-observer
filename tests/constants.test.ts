import { describe, expect, it } from 'vitest';
import {
  FEEDLINE_PRESETS,
  GROUND_PRESETS,
  feedlineLossDb,
  findFeedlinePreset,
  findGroundPreset,
  halfWaveLength,
  wavelengthMeters,
  referenceLength,
  HF_BAND_PRESETS,
} from '../src/physics/constants';
import { type AntennaType } from '../src/physics/types';

describe('physics constants and helpers', () => {
  describe('wavelengthMeters', () => {
    it('calculates the correct wavelength for standard HF frequencies', () => {
      // 10 MHz
      expect(wavelengthMeters(10)).toBeCloseTo(29.9792, 4);
      // 14.150 MHz (20m band)
      expect(wavelengthMeters(14.150)).toBeCloseTo(21.1867, 4);
      // 7.1 MHz (40m band)
      expect(wavelengthMeters(7.1)).toBeCloseTo(42.2243, 4);
      // 28.5 MHz (10m band)
      expect(wavelengthMeters(28.5)).toBeCloseTo(10.5190, 4);
    });

    it('returns Infinity for a frequency of 0', () => {
      expect(wavelengthMeters(0)).toBe(Infinity);
    });

    it('handles negative frequencies by returning a negative wavelength', () => {
      expect(wavelengthMeters(-10)).toBeCloseTo(-29.9792, 4);
    });
  });

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

  describe('referenceLength', () => {
    const lambda = 299.792458 / 14.150; // 20m band approx 21.186m

    it('calculates dipole length with default end effect', () => {
      expect(referenceLength('dipole', 14.150)).toBeCloseTo(lambda * 0.5 * 0.95, 4);
    });

    it('calculates inverted-v length (slightly longer than flat dipole)', () => {
      expect(referenceLength('inverted-v', 14.150)).toBeCloseTo(lambda * 0.5 * 0.97, 4);
    });

    it('calculates delta-loop perimeter (1.0λ, no end-effect for loops)', () => {
      expect(referenceLength('delta-loop', 14.150)).toBeCloseTo(lambda * 1.0, 4);
    });

    it('calculates sloping-v length (2λ total, traveling-wave, no end-effect)', () => {
      expect(referenceLength('sloping-v', 14.150)).toBeCloseTo(lambda * 2.0, 4);
    });

    it('calculates terminated-delta perimeter (1.0λ, same as delta-loop)', () => {
      expect(referenceLength('terminated-delta', 14.150)).toBeCloseTo(lambda * 1.0, 4);
    });

    it('calculates vertical-whip length', () => {
      expect(referenceLength('vertical-whip', 14.150)).toBeCloseTo(lambda * 0.25 * 0.95, 4);
    });

    it('calculates inverted-l length', () => {
      expect(referenceLength('inverted-l', 14.150)).toBeCloseTo(lambda * 0.25 * 0.95, 4);
    });

    it('calculates folded-dipole length', () => {
      expect(referenceLength('folded-dipole', 14.150)).toBeCloseTo(lambda * 0.5 * 0.95, 4);
    });

    it('falls back to default dipole length for unknown types', () => {
      expect(referenceLength('unknown' as AntennaType, 14.150)).toBeCloseTo(lambda * 0.5 * 0.95, 4);
    });

    it('allows custom end effect factor', () => {
      expect(referenceLength('dipole', 14.150, 1.0)).toBeCloseTo(lambda * 0.5, 4);
    });
  });
});

describe('ground presets', () => {
  it('contains expected standard ground presets', () => {
    const ids = GROUND_PRESETS.map((p) => p.id);
    expect(ids).toContain('free');
    expect(ids).toContain('perfect');
    expect(ids).toContain('sea');
    expect(ids).toContain('fresh');
    expect(ids).toContain('pastoral');
  });

  it('all presets have basic expected properties', () => {
    for (const preset of GROUND_PRESETS) {
      expect(preset.id).toBeDefined();
      expect(typeof preset.id).toBe('string');
      expect(preset.label).toBeDefined();
      expect(typeof preset.label).toBe('string');
    }
  });

  it('findGroundPreset returns correct preset for valid id', () => {
    const preset = findGroundPreset('sea');
    expect(preset.id).toBe('sea');
    expect(preset.label).toBe('Sea water');
  });

  it('findGroundPreset throws an error on unknown id', () => {
    expect(() => findGroundPreset('unknown-ground-type')).toThrowError('Unknown ground preset id: unknown-ground-type');
  });

  it('findGroundPreset throws an error on empty string id', () => {
    expect(() => findGroundPreset('')).toThrowError('Unknown ground preset id: ');
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
