import { describe, expect, it } from 'vitest';
import { wavelengthMeters, halfWaveLength, HF_BAND_PRESETS } from '../src/physics/constants';

describe('physics constants and helpers', () => {
  it('wavelengthMeters matches speed of light / f', () => {
    expect(wavelengthMeters(7.1)).toBeCloseTo(42.224, 2);
    expect(wavelengthMeters(14.2)).toBeCloseTo(21.112, 2);
    expect(wavelengthMeters(28.4)).toBeCloseTo(10.556, 2);
  });

  it('halfWaveLength accounts for end effect', () => {
    // 40m band dipole
    const wl = wavelengthMeters(7.1);
    expect(halfWaveLength(7.1, 1.0)).toBeCloseTo(wl / 2, 5);
    expect(halfWaveLength(7.1, 0.95)).toBeCloseTo(wl * 0.5 * 0.95, 5);
  });

  it('HF_BAND_PRESETS contains standard bands', () => {
    const names = HF_BAND_PRESETS.map(p => p.name);
    expect(names).toContain('40m');
    expect(names).toContain('20m');
    expect(names).toContain('10m');
  });
});
