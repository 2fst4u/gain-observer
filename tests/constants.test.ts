import { describe, expect, it } from 'vitest';
import { halfWaveLength, HF_BAND_PRESETS } from '../src/physics/constants';

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
