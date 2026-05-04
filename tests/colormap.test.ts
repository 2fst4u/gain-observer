import { describe, expect, it } from 'vitest';
import { sampleColormap, gainToColorT, sampleColormapFast, getColormapCssGradient, pickTable } from '../src/utils/colormap';

describe('colormap utilities', () => {
  describe('sampleColormap', () => {
    it('returns the first color at t=0', () => {
      const color = sampleColormap('viridis', 0);
      // VIRIDIS[0] = [0.267004, 0.004874, 0.329415]
      expect(color[0]).toBeCloseTo(0.267004, 6);
      expect(color[1]).toBeCloseTo(0.004874, 6);
      expect(color[2]).toBeCloseTo(0.329415, 6);
    });

    it('returns the last color at t=1', () => {
      const color = sampleColormap('viridis', 1);
      // VIRIDIS[15] = [0.993248, 0.906157, 0.143936]
      expect(color[0]).toBeCloseTo(0.993248, 6);
      expect(color[1]).toBeCloseTo(0.906157, 6);
      expect(color[2]).toBeCloseTo(0.143936, 6);
    });

    it('clamps t < 0 to the first color', () => {
      const color = sampleColormap('viridis', -1);
      expect(color[0]).toBeCloseTo(0.267004, 6);
    });

    it('clamps t > 1 to the last color', () => {
      const color = sampleColormap('viridis', 2);
      expect(color[0]).toBeCloseTo(0.993248, 6);
    });

    it('returns the first color for non-finite values', () => {
      expect(sampleColormap('viridis', NaN)[0]).toBeCloseTo(0.267004, 6);
      expect(sampleColormap('viridis', Infinity)[0]).toBeCloseTo(0.267004, 6);
    });

    it('linearly interpolates between stops', () => {
      // VIRIDIS[0] = [0.267004, 0.004874, 0.329415]
      // VIRIDIS[1] = [0.282656, 0.100196, 0.422160]
      // t such that f = 0.5 => clamped * (16 - 1) = 0.5 => clamped = 0.5 / 15
      const t = 0.5 / 15;
      const color = sampleColormap('viridis', t);
      expect(color[0]).toBeCloseTo((0.267004 + 0.282656) / 2, 6);
      expect(color[1]).toBeCloseTo((0.004874 + 0.100196) / 2, 6);
      expect(color[2]).toBeCloseTo((0.329415 + 0.422160) / 2, 6);
    });

    it('works with turbo colormap', () => {
      // TURBO[0] = [0.18995, 0.07176, 0.23217]
      const color = sampleColormap('turbo', 0);
      expect(color[0]).toBeCloseTo(0.18995, 5);
    });

    it('works with jet colormap', () => {
      // JET[0] = [0, 0, 0.5]
      const color = sampleColormap('jet', 0);
      expect(color).toEqual([0, 0, 0.5]);
    });
  });

  describe('gainToColorT', () => {
    it('returns 1 for gain at or above maxDb', () => {
      expect(gainToColorT(10, 10, 20)).toBe(1);
      expect(gainToColorT(15, 10, 20)).toBe(1);
    });

    it('returns 0 for gain at or below minDb', () => {
      expect(gainToColorT(-10, 10, 20)).toBe(0);
      expect(gainToColorT(-15, 10, 20)).toBe(0);
    });

    it('linearly maps intermediate values', () => {
      expect(gainToColorT(0, 10, 20)).toBe(0.5);
      expect(gainToColorT(-5, 10, 20)).toBe(0.25);
      expect(gainToColorT(5, 10, 20)).toBe(0.75);
    });
  });

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
  });
});
