import { describe, expect, it } from 'vitest';
import { sampleColormapFast, getColormapCssGradient, pickTable } from '../src/utils/colormap';

describe('colormap utilities', () => {
  describe('sampleColormapFast', () => {
    it('writes the first color at t=0', () => {
      const table = pickTable('viridis');
      const out = new Float32Array(3);
      sampleColormapFast(table, 0, out, 0);
      expect(out[0]).toBeCloseTo(0.267004, 6);
      expect(out[1]).toBeCloseTo(0.004874, 6);
      expect(out[2]).toBeCloseTo(0.329415, 6);
    });

    it('writes the last color at t=1', () => {
      const table = pickTable('viridis');
      const out = new Float32Array(3);
      sampleColormapFast(table, 1, out, 0);
      expect(out[0]).toBeCloseTo(0.993248, 6);
      expect(out[1]).toBeCloseTo(0.906157, 6);
      expect(out[2]).toBeCloseTo(0.143936, 6);
    });

    it('clamps t < 0 to the first color', () => {
      const table = pickTable('viridis');
      const out = new Float32Array(3);
      sampleColormapFast(table, -1, out, 0);
      expect(out[0]).toBeCloseTo(0.267004, 6);
    });

    it('clamps t > 1 to the last color', () => {
      const table = pickTable('viridis');
      const out = new Float32Array(3);
      sampleColormapFast(table, 2, out, 0);
      expect(out[0]).toBeCloseTo(0.993248, 6);
    });

    it('clamps NaN to the first color', () => {
      const table = pickTable('viridis');
      const out = new Float32Array(3);
      sampleColormapFast(table, NaN, out, 0);
      expect(out[0]).toBeCloseTo(0.267004, 6);
    });

    it('linearly interpolates between stops', () => {
      const table = pickTable('viridis');
      const out = new Float32Array(6);
      // t such that f = 0.5 => clamped * (16 - 1) = 0.5 => clamped = 0.5 / 15
      const t = 0.5 / 15;
      // Write to an offset to test the offset param
      sampleColormapFast(table, t, out, 3);
      expect(out[3]).toBeCloseTo((0.267004 + 0.282656) / 2, 6);
      expect(out[4]).toBeCloseTo((0.004874 + 0.100196) / 2, 6);
      expect(out[5]).toBeCloseTo((0.329415 + 0.422160) / 2, 6);
    });
  });

  describe('getColormapCssGradient', () => {
    it('creates a valid linear gradient string starting with "to top"', () => {
      const gradient = getColormapCssGradient('viridis');
      expect(gradient).toMatch(/^linear-gradient\(to top, /);
      expect(gradient).toContain('0.00%');
      expect(gradient).toContain('100.00%');
    });

    it('correctly maps VIRIDIS colormap stops', () => {
      const gradient = getColormapCssGradient('viridis');
      // Check first color
      expect(gradient).toContain('rgb(68, 1, 84) 0.00%');
      // Check last color
      expect(gradient).toContain('rgb(253, 231, 37) 100.00%');
    });

    it('correctly maps JET colormap stops', () => {
      const gradient = getColormapCssGradient('jet');
      // Check first color
      expect(gradient).toContain('rgb(0, 0, 128) 0.00%');
      // Check last color
      expect(gradient).toContain('rgb(128, 0, 0) 100.00%');
      // Check intermediate stop
      expect(gradient).toContain('rgb(0, 255, 255) 37.50%');
    });

    it('correctly maps TURBO colormap stops', () => {
      const gradient = getColormapCssGradient('turbo');
      expect(gradient).toMatch(/^linear-gradient\(to top, /);
      // TURBO[0] = [0.18995, 0.07176, 0.23217] → rgb(48, 18, 59)
      expect(gradient).toContain('rgb(48, 18, 59) 0.00%');
      // TURBO[10] = [0.47960, 0.01583, 0.01055] → rgb(122, 4, 3)
      expect(gradient).toContain('rgb(122, 4, 3) 100.00%');
    });
  });
});
