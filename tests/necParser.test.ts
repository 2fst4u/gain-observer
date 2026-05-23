import { describe, expect, it } from 'vitest';
import { parseNecImpedance, parseNecImpedanceSweep, parseNecOutput, parseNecCurrents, parseNecPowerBudget } from '../src/physics/necParser';
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
    parseNecOutput(mockOutput, 2, 1); // 2 theta steps (0, 180), dTheta=180
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

  it('parseNecOutput includes currents and powerBudget fields', () => {
    const parsed = parseNecOutput(fullOutput, 5, 8);
    expect(Array.isArray(parsed.currents)).toBe(true);
    expect(parsed.powerBudget).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseNecImpedanceSweep
// ---------------------------------------------------------------------------

describe('parseNecImpedanceSweep', () => {
  const SWEEP_BLOCK_SINGLE = `
                                 - - - ANTENNA INPUT PARAMETERS - - -
  TAG SEG       VOLTAGE (VOLTS)         CURRENT (AMPS)         IMPEDANCE (OHMS)        ADMITTANCE (MHOS)     POWER
  No. No.     REAL      IMAG.         REAL      IMAG.         REAL      IMAG.         REAL      IMAG.       (WATTS)
    1   6  1.00000E+00  0.00000E+00  7.50000E-03 -1.25000E-03  7.20000E+01  1.20000E+01  1.38889E-02 -2.31481E-03  5.00000E-03
`;

  const SWEEP_BLOCK_MULTIPLE = `
                                 - - - ANTENNA INPUT PARAMETERS - - -
  TAG SEG       VOLTAGE (VOLTS)         CURRENT (AMPS)         IMPEDANCE (OHMS)        ADMITTANCE (MHOS)     POWER
  No. No.     REAL      IMAG.         REAL      IMAG.         REAL      IMAG.         REAL      IMAG.       (WATTS)
    1   6  1.00000E+00  0.00000E+00  7.50000E-03 -1.25000E-03  7.20000E+01  1.20000E+01  1.38889E-02 -2.31481E-03  5.00000E-03

Some other text
                                 - - - ANTENNA INPUT PARAMETERS - - -
  TAG SEG       VOLTAGE (VOLTS)         CURRENT (AMPS)         IMPEDANCE (OHMS)        ADMITTANCE (MHOS)     POWER
  No. No.     REAL      IMAG.         REAL      IMAG.         REAL      IMAG.         REAL      IMAG.       (WATTS)
    1   6  1.00000E+00  0.00000E+00  6.00000E-03  2.00000E-03  8.00000E+01 -2.50000E+01  1.25000E-02  3.90625E-03  4.50000E-03
`;

  const SWEEP_BLOCK_INVALID = `
                                 - - - ANTENNA INPUT PARAMETERS - - -
  INVALID ROW
`;

  const SWEEP_MIXED = `
                                 - - - ANTENNA INPUT PARAMETERS - - -
  TAG SEG       VOLTAGE (VOLTS)         CURRENT (AMPS)         IMPEDANCE (OHMS)        ADMITTANCE (MHOS)     POWER
  No. No.     REAL      IMAG.         REAL      IMAG.         REAL      IMAG.         REAL      IMAG.       (WATTS)
    1   6  1.00000E+00  0.00000E+00  7.50000E-03 -1.25000E-03  7.20000E+01  1.20000E+01  1.38889E-02 -2.31481E-03  5.00000E-03

                                 - - - ANTENNA INPUT PARAMETERS - - -
  INVALID ROW
`;

  it('returns empty array when no ANTENNA INPUT PARAMETERS block is present', () => {
    expect(parseNecImpedanceSweep('')).toEqual([]);
    expect(parseNecImpedanceSweep('Some other text')).toEqual([]);
  });

  it('parses a single frequency block correctly', () => {
    const results = parseNecImpedanceSweep(SWEEP_BLOCK_SINGLE);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      impedance: { R: 72, X: 12 },
      power: 0.005,
    });
  });

  it('parses multiple frequency blocks correctly', () => {
    const results = parseNecImpedanceSweep(SWEEP_BLOCK_MULTIPLE);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      impedance: { R: 72, X: 12 },
      power: 0.005,
    });
    expect(results[1]).toEqual({
      impedance: { R: 80, X: -25 },
      power: 0.0045,
    });
  });

  it('handles an invalid or missing data row within a block by returning null values', () => {
    const results = parseNecImpedanceSweep(SWEEP_BLOCK_INVALID);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ impedance: null, power: null });
  });

  it('handles a mix of valid and invalid blocks correctly', () => {
    const results = parseNecImpedanceSweep(SWEEP_MIXED);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      impedance: { R: 72, X: 12 },
      power: 0.005,
    });
    expect(results[1]).toEqual({ impedance: null, power: null });
  });
});

// ---------------------------------------------------------------------------
// parseNecCurrents
// ---------------------------------------------------------------------------

const CURRENTS_BLOCK = `
                           -------- CURRENTS AND LOCATION --------
                                  DISTANCES IN WAVELENGTHS

   SEG  TAG    COORDINATES OF SEGM CENTER     SEGM    ------------- CURRENT (AMPS) -------------
   No:  No:       X         Y         Z      LENGTH     REAL      IMAGINARY    MAGN        PHASE
     1    1   -0.2153    0.0000    0.2368   0.04306  1.6925E-03  9.6489E-04  1.9482E-03   29.688
     2    1   -0.1722    0.0000    0.2368   0.04306  4.6480E-03  2.7004E-03  5.3755E-03   30.156
     3    1   -0.1292    0.0000    0.2368   0.04306  7.1088E-03  4.2185E-03  8.2663E-03   30.685
     1    2    0.1292    0.0000    0.2368   0.04306  3.1000E-03  1.8000E-03  3.5861E-03   30.100
     2    2    0.1722    0.0000    0.2368   0.04306  1.8000E-03  1.0000E-03  2.0616E-03   29.054
`;

describe('parseNecCurrents', () => {
  it('returns empty array when no CURRENTS AND LOCATION block present', () => {
    expect(parseNecCurrents('')).toEqual([]);
    expect(parseNecCurrents('ANTENNA INPUT PARAMETERS\n  some data')).toEqual([]);
  });

  it('parses segment number, tag, position and magnitude', () => {
    const currents = parseNecCurrents(CURRENTS_BLOCK);
    expect(currents).toHaveLength(5);

    expect(currents[0]!.segNo).toBe(1);
    expect(currents[0]!.tagNo).toBe(1);
    expect(currents[0]!.magnitude).toBeCloseTo(1.9482e-3, 6);

    expect(currents[3]!.segNo).toBe(1);
    expect(currents[3]!.tagNo).toBe(2);
    expect(currents[3]!.magnitude).toBeCloseTo(3.5861e-3, 6);
  });

  it('groups correctly: three segments for tag 1, two for tag 2', () => {
    const currents = parseNecCurrents(CURRENTS_BLOCK);
    const tag1 = currents.filter((c) => c.tagNo === 1);
    const tag2 = currents.filter((c) => c.tagNo === 2);
    expect(tag1).toHaveLength(3);
    expect(tag2).toHaveLength(2);
  });

  it('parses all 11 segments from the dipole fixture', () => {
    const fixtureDir = path.join(__dirname, 'fixtures/nec');
    const fullOutput = fs.readFileSync(path.join(fixtureDir, 'dipole-7.1-free.nout'), 'utf8');
    const currents = parseNecCurrents(fullOutput);
    expect(currents).toHaveLength(11);
    // Dipole: all segments belong to tag 1
    for (const c of currents) {
      expect(c.tagNo).toBe(1);
    }
    // Current at segment 6 (centre) should be maximum
    const mags = currents.map((c) => c.magnitude);
    const maxMag = Math.max(...mags);
    expect(currents[5]!.magnitude).toBeCloseTo(maxMag, 10);
  });
});

// ---------------------------------------------------------------------------
// parseNecPowerBudget
// ---------------------------------------------------------------------------

const POWER_BUDGET_BLOCK = `
                               ---------- POWER BUDGET ---------
                               INPUT POWER   =  5.2785E-03 Watts
                               RADIATED POWER=  5.2785E-03 Watts
                               STRUCTURE LOSS=  0.0000E+00 Watts
                               NETWORK LOSS  =  0.0000E+00 Watts
                               EFFICIENCY    =  100.00 Percent
`;

const POWER_BUDGET_WITH_LOSS = `
                               ---------- POWER BUDGET ---------
                               INPUT POWER   =  1.0000E-02 Watts
                               RADIATED POWER=  6.0000E-03 Watts
                               STRUCTURE LOSS=  5.0000E-04 Watts
                               NETWORK LOSS  =  3.5000E-03 Watts
                               EFFICIENCY    =  60.00 Percent
`;

describe('parseNecPowerBudget', () => {
  it('returns null when block is absent', () => {
    expect(parseNecPowerBudget('')).toBeNull();
    expect(parseNecPowerBudget('ANTENNA INPUT PARAMETERS\n')).toBeNull();
  });

  it('parses all five fields from a no-loss block', () => {
    const budget = parseNecPowerBudget(POWER_BUDGET_BLOCK);
    expect(budget).not.toBeNull();
    expect(budget!.inputW).toBeCloseTo(5.2785e-3, 10);
    expect(budget!.radiatedW).toBeCloseTo(5.2785e-3, 10);
    expect(budget!.structureLossW).toBeCloseTo(0, 10);
    expect(budget!.networkLossW).toBeCloseTo(0, 10);
    expect(budget!.efficiencyPct).toBeCloseTo(100, 5);
  });

  it('parses non-zero NETWORK LOSS (termination resistor power)', () => {
    const budget = parseNecPowerBudget(POWER_BUDGET_WITH_LOSS);
    expect(budget).not.toBeNull();
    expect(budget!.inputW).toBeCloseTo(1.0e-2, 10);
    expect(budget!.networkLossW).toBeCloseTo(3.5e-3, 10);
    expect(budget!.efficiencyPct).toBeCloseTo(60, 5);
  });

  it('parses the dipole fixture power budget', () => {
    const fixtureDir = path.join(__dirname, 'fixtures/nec');
    const fullOutput = fs.readFileSync(path.join(fixtureDir, 'dipole-7.1-free.nout'), 'utf8');
    const budget = parseNecPowerBudget(fullOutput);
    expect(budget).not.toBeNull();
    // Lossless dipole: input ≈ radiated, network loss = 0
    expect(budget!.networkLossW).toBeCloseTo(0, 10);
    expect(budget!.efficiencyPct).toBeCloseTo(100, 1);
    expect(budget!.inputW).toBeGreaterThan(0);
  });
});
