import { describe, expect, it } from 'vitest';
import { parseNecImpedance, parseNecOutput } from '../src/physics/necParser';
import fs from 'node:fs';
import path from 'node:path';

describe('necParser', () => {
  const fixtureDir = path.join(__dirname, 'fixtures/nec');
  const fullOutput = fs.readFileSync(path.join(fixtureDir, 'dipole-7.1-free.nout'), 'utf8');
  const xqOutput = fs.readFileSync(path.join(fixtureDir, 'dipole-7.1-free-xq.nout'), 'utf8');

  it('parses impedance from full output', () => {
    const { impedance, power } = parseNecImpedance(fullOutput);
    expect(impedance).not.toBeNull();
    // A resonant half-wave dipole is roughly 72 ohms in free space,
    // but the actual calculated value depends on exact length and radius.
    expect(impedance!.R).toBeGreaterThan(60);
    expect(impedance!.R).toBeLessThan(80);
    expect(power).toBeGreaterThan(0);
  });

  it('parses impedance from XQ output', () => {
    const { impedance, power } = parseNecImpedance(xqOutput);
    expect(impedance).not.toBeNull();
    expect(impedance!.R).toBeGreaterThan(60);
    expect(impedance!.R).toBeLessThan(80);
    expect(power).toBeGreaterThan(0);
  });

  it('parses radiation pattern from full output', () => {
    // We used 5 theta steps, 8 phi steps in generation
    const parsed = parseNecOutput(fullOutput, 5, 8);
    expect(parsed.pattern).not.toBeNull();
    expect(parsed.pattern!.data.length).toBe(40);
    expect(parsed.pattern!.thetaSteps).toBe(5);
    expect(parsed.pattern!.phiSteps).toBe(8);

    // Check some values are finite
    for (const val of parsed.pattern!.data) {
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBeLessThan(10); // Gain should be reasonable
      expect(val).toBeGreaterThan(-150);
    }
  });

  it('handles missing pattern in XQ output', () => {
    const parsed = parseNecOutput(xqOutput, 5, 8);
    expect(parsed.pattern).toBeNull();
    expect(parsed.notices).toContain('Radiation pattern block not found in NEC output.');
  });

  it('handles sentinel -999.99 by converting to -100', () => {
    const mockOutput = `
RADIATION PATTERNS
  0.00   0.00  -999.99  -999.99  -999.99
  90.00  0.00   2.15    2.15     2.15
    `;
    const parsed = parseNecOutput(mockOutput, 2, 1);
    expect(parsed.pattern!.data[0]).toBe(-100);
    expect(parsed.pattern!.data[1]).toBeCloseTo(2.15, 5);
  });

  it('surfaces NEC warning banners', () => {
    const mockOutput = `
***** WARNING *****
WIRE RADIUS IS LARGE COMPARED TO WAVELENGTH
    `;
    const parsed = parseNecOutput(mockOutput, 1, 1);
    expect(parsed.notices).toContain('***** WARNING *****');
  });

  it('returns null impedance if ANTENNA INPUT PARAMETERS is present but no valid data rows follow', () => {
    const mockOutput = `
ANTENNA INPUT PARAMETERS
  INVALID DATA ROW
    `;
    const { impedance, power } = parseNecImpedance(mockOutput);
    expect(impedance).toBeNull();
    expect(power).toBeNull();
  });

  it('adds notice if RUN TIME is present but impedance is not found', () => {
    const mockOutput = `
RUN TIME
  0.00
    `;
    const parsed = parseNecOutput(mockOutput, 1, 1);
    expect(parsed.notices).toContain('Impedance block not found in NEC output.');
  });

  it('handles empty text gracefully', () => {
    const parsed = parseNecOutput('', 1, 1);
    expect(parsed.impedance).toBeNull();
    expect(parsed.pattern).toBeNull();
    expect(parsed.excitationPowerW).toBeNull();
    expect(parsed.notices).toEqual([]);
  });

  it('skips pattern rows where theta index is out of bounds', () => {
    const mockOutput = `
RADIATION PATTERNS
  -10.00   0.00  1.0  1.0  1.0
  200.00   0.00  1.0  1.0  1.0
  0.00     0.00  2.0  2.0  2.0
    `;
    const parsed = parseNecOutput(mockOutput, 2, 1); // 2 theta steps (0, 180), dTheta=180
    // -10/180 = 0 -> ti=0
    // 200/180 = 1 -> ti=1
    // Let's explicitly trigger out of bounds: 360/180 = 2 >= thetaSteps=2
    const mockOutputOOB = `
RADIATION PATTERNS
  360.00   0.00  1.0  1.0  1.0
  0.00     0.00  2.0  2.0  2.0
    `;
    const parsedOOB = parseNecOutput(mockOutputOOB, 2, 1);
    expect(parsedOOB.pattern!.data[0]).toBe(2.0); // Only the second row should be processed
  });

  it('returns null if RADIATION PATTERNS block is present but no rows are parsed', () => {
    const mockOutput = `
RADIATION PATTERNS
  INVALID ROW
    `;
    const parsed = parseNecOutput(mockOutput, 1, 1);
    expect(parsed.pattern).toBeNull();
  });
});
