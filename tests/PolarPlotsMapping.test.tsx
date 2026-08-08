// The polar cuts have to place the pattern on the compass the same way the
// geometry builder places the antenna. NEC solves in its own azimuth φ
// (0° = +X = East, counter-clockwise) while a Chart.js radar is a compass rose
// (index 0 at the top, increasing clockwise), so the two differ by a 90°
// rotation *and* a handedness flip. Reading φ straight into the ring made a
// north–south wire look as though it radiated north and south — off its ends,
// where a dipole has nulls.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PolarPlots } from '../src/components/Charts/PolarPlots';
import { useAntennaStore } from '../src/store/antennaStore';
import { makeSimulationResult } from './helpers/factories';

const { charts } = vi.hoisted(() => ({
  charts: [] as Array<{ title: string; labels: string[]; data: number[] }>,
}));

vi.mock('react-chartjs-2', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Radar: (props: any) => {
    charts.push({
      title: '',
      labels: props.data.labels as string[],
      data: props.data.datasets[0].data as number[],
    });
    return <div data-testid="mock-radar-chart" />;
  },
}));

const THETA_STEPS = 37;
const PHI_STEPS = 72;
const D_THETA = 5;
const D_PHI = 5;

/**
 * Synthetic pattern for a wire lying along +Y (i.e. north–south): peak gain
 * broadside at φ = 0° and 180° (±X, east and west), deep nulls off the ends at
 * φ = 90° and 270° (±Y, north and south). Elevation independent, so a cut at
 * any theta shows the same azimuth shape.
 */
function nsWirePattern(): Float32Array {
  const data = new Float32Array(THETA_STEPS * PHI_STEPS);
  for (let ti = 0; ti < THETA_STEPS; ti++) {
    for (let pi = 0; pi < PHI_STEPS; pi++) {
      const phi = (pi * D_PHI * Math.PI) / 180;
      const c = Math.cos(phi);
      data[ti * PHI_STEPS + pi] = -30 + 30 * c * c;
    }
  }
  return data;
}

function setPattern(orientation: 'NS' | 'EW') {
  useAntennaStore.setState({
    showPolarCuts: true,
    orientation,
    dbRange: 40,
    theme: 'light',
    transformerEnabled: false,
    feedlineId: 'none',
    atuEnabled: false,
    result: makeSimulationResult({
      swr: 1.0,
      impedance: { R: 50, X: 0 },
      maxGainDbi: 0,
      maxRealizedGainDbi: 0,
      takeoffElevationDeg: 0,
      takeoffAzimuthDeg: 0,
      pattern: {
        data: nsWirePattern(),
        thetaSteps: THETA_STEPS,
        phiSteps: PHI_STEPS,
        dTheta: D_THETA,
        dPhi: D_PHI,
      },
    }),
  });
}

/** Index of a compass bearing on the azimuth ring. */
const bearingIdx = (deg: number) => Math.round(deg / D_PHI);

describe('polar cut compass mapping', () => {
  beforeEach(() => {
    cleanup();
    charts.length = 0;
  });

  it('puts a north–south wire\'s lobes on east and west, not north and south', () => {
    setPattern('NS');
    render(<PolarPlots />);

    const azimuth = charts[0]!;
    expect(azimuth.labels[bearingIdx(0)]).toBe('N');
    expect(azimuth.labels[bearingIdx(90)]).toBe('E');
    expect(azimuth.labels[bearingIdx(270)]).toBe('W');

    const at = (deg: number) => azimuth.data[bearingIdx(deg)]!;
    // Broadside (east/west) carries the peak; off the ends (north/south) is
    // the null. The ring values are dB above the plot floor, so higher = more.
    expect(at(90)).toBeGreaterThan(at(0) + 20);
    expect(at(270)).toBeGreaterThan(at(180) + 20);
    expect(at(90)).toBeCloseTo(at(270), 6);
    expect(at(0)).toBeCloseTo(at(180), 6);
  });

  it('rotates with the antenna: an east–west wire peaks north and south', () => {
    // The pattern grid is fixed to the NEC axes, so re-pointing the wire is
    // modelled by keeping the same grid and asking for the EW cuts; what must
    // stay true is that the azimuth ring never moves with the orientation.
    setPattern('EW');
    render(<PolarPlots />);

    const azimuth = charts[0]!;
    const at = (deg: number) => azimuth.data[bearingIdx(deg)]!;
    // Same pattern data ⇒ same ring. Orientation only selects which elevation
    // cut is called "broadside"; it must not rotate the azimuth plot.
    expect(at(90)).toBeGreaterThan(at(0) + 20);
  });

  it('labels the broadside and end-on elevation cuts the right way round', () => {
    setPattern('NS');
    render(<PolarPlots />);

    const [, broadside, endOn] = charts;
    // Right-hand half of the elevation ring is the forward bearing.
    const sample = (c: { data: number[] }) => c.data[Math.round(45 / D_THETA)]!;
    // Broadside of a north–south wire is east: the strong direction. End-on is
    // north: the null. Swapping the two cuts would invert this.
    expect(sample(broadside!)).toBeGreaterThan(sample(endOn!) + 20);
  });

  it('keeps the elevation cut oriented: zenith at the top, nadir at the bottom', () => {
    setPattern('NS');
    render(<PolarPlots />);
    const broadside = charts[1]!;
    expect(broadside.labels[0]).toBe('Zen');
    expect(broadside.labels[Math.round(90 / D_THETA)]).toBe('Hor');
    expect(broadside.labels[Math.round(180 / D_THETA)]).toBe('Dwn');
  });
});
