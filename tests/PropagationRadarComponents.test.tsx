import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RadarGrid,
  RadarCoverage,
  RadarHopRings,
  RadarLabels,
  RadarLegend,
} from '../src/components/Charts/PropagationRadarComponents';
import { SIGNAL_BANDS, sMeterLabel, STRENGTH_BANDS, strengthBand } from '../src/components/Charts/propagationRadarUtils';
import { COVERAGE_BINS } from '../src/physics/coverage';
import type { PropagationPrediction } from '../src/physics/propagation';
import {
  makeAzimuthalHop,
  makeHop,
  makePropagationPrediction,
} from './helpers/factories';

describe('PropagationRadarComponents', () => {
  afterEach(() => {
    cleanup();
  });

  describe('RadarGrid', () => {
    it('renders background disc, 3 inner gridline circles, and cross-hair lines', () => {
      const { container } = render(
        <svg>
          <RadarGrid cx={150} cy={150} size={300} maxRadiusPx={100} margin={20} />
        </svg>,
      );

      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(4);

      // Background disc
      const bgCircle = circles[0];
      expect(bgCircle?.getAttribute('cx')).toBe('150');
      expect(bgCircle?.getAttribute('cy')).toBe('150');
      expect(bgCircle?.getAttribute('r')).toBe('100');
      expect(bgCircle?.getAttribute('fill')).toBe('var(--bg-raised)');
      expect(bgCircle?.getAttribute('stroke')).toBe('var(--border)');

      // 3 inner gridlines at 25%, 50%, 75%
      const rValues = Array.from(circles)
        .slice(1)
        .map((c) => c.getAttribute('r'));
      expect(rValues).toEqual(['25', '50', '75']);

      const gridline = circles[1];
      expect(gridline?.getAttribute('stroke-dasharray')).toBe('2 3');

      // 2 cross-hair axis lines
      const lines = container.querySelectorAll('line');
      expect(lines).toHaveLength(2);

      // Vertical cross-hair line
      expect(lines[0]?.getAttribute('x1')).toBe('150');
      expect(lines[0]?.getAttribute('y1')).toBe('20');
      expect(lines[0]?.getAttribute('x2')).toBe('150');
      expect(lines[0]?.getAttribute('y2')).toBe('280');

      // Horizontal cross-hair line
      expect(lines[1]?.getAttribute('x1')).toBe('20');
      expect(lines[1]?.getAttribute('y1')).toBe('150');
      expect(lines[1]?.getAttribute('x2')).toBe('280');
      expect(lines[1]?.getAttribute('y2')).toBe('150');
    });
  });

  describe('RadarGrid distance scale', () => {
    it('places labelled grid circles at round distances', () => {
      render(
        <svg>
          <RadarGrid cx={150} cy={150} size={300} maxRadiusPx={100} margin={20} maxRangeKm={2379} units="metric" />
        </svg>,
      );
      // 2379 / 5 ≈ 476 → 500 km steps, up to 2000 inside the rim.
      expect(['500 km', '1000 km', '1500 km', '2000 km'].every((t) => screen.getByText(t))).toBe(true);
      expect(screen.queryByText('2500 km')).toBeNull();
    });

    it('rounds the scale in miles for imperial units', () => {
      render(
        <svg>
          <RadarGrid cx={150} cy={150} size={300} maxRadiusPx={100} margin={20} maxRangeKm={1609.344} units="imperial" />
        </svg>,
      );
      // 1000 mi / 5 = 200 mi steps.
      expect(screen.getByText('200 mi')).toBeTruthy();
      expect(screen.getByText('800 mi')).toBeTruthy();
    });
  });

  describe('RadarLabels', () => {
    it('renders cardinal directions (N, S, E, W)', () => {
      const prediction = makePropagationPrediction({ hops: [] });
      render(
        <svg>
          <RadarLabels
            cx={150}
            cy={150}
            size={300}
            margin={20}
            prediction={prediction}
            kmToPx={0.05}
            units="metric"
          />
        </svg>,
      );

      expect(screen.getByText('N')).toBeTruthy();
      expect(screen.getByText('S')).toBeTruthy();
      expect(screen.getByText('E')).toBeTruthy();
      expect(screen.getByText('W')).toBeTruthy();
    });

    it('renders range labels for hop rings in metric units', () => {
      const prediction: PropagationPrediction = makePropagationPrediction({
        hops: [
          makeHop({ n: 1, rangeKm: 1000 }),
          makeHop({ n: 2, rangeKm: 2000 }),
        ],
      });
      render(
        <svg>
          <RadarLabels
            cx={150}
            cy={150}
            size={300}
            margin={20}
            prediction={prediction}
            kmToPx={0.05}
            units="metric"
          />
        </svg>,
      );

      expect(screen.getByText('1× 1000 km')).toBeTruthy();
      expect(screen.getByText('2× 2000 km')).toBeTruthy();
    });

    it('renders range labels for hop rings in imperial units', () => {
      const prediction: PropagationPrediction = makePropagationPrediction({
        hops: [makeHop({ n: 1, rangeKm: 1000 })],
      });
      render(
        <svg>
          <RadarLabels
            cx={150}
            cy={150}
            size={300}
            margin={20}
            prediction={prediction}
            kmToPx={0.05}
            units="imperial"
          />
        </svg>,
      );

      expect(screen.getByText('1× 621 mi')).toBeTruthy();
    });
  });

  describe('RadarHopRings', () => {
    it('renders circular hop rings when azimuthalHops is not provided or has <= 1 item', () => {
      const prediction: PropagationPrediction = makePropagationPrediction({
        hops: [
          makeHop({ n: 1, rangeKm: 1000 }),
          makeHop({ n: 2, rangeKm: 2000 }),
        ],
        azimuthalHops: [makeAzimuthalHop({ phiDeg: 0, rangeKm: [1000] })],
      });

      const { container } = render(
        <svg>
          <RadarHopRings
            prediction={prediction}
            cx={150}
            cy={150}
            kmToPx={0.05}
          />
        </svg>,
      );

      const circles = container.querySelectorAll('circle');
      expect(circles).toHaveLength(2);

      // Rings rendered in reverse order (k = 1, then k = 0)
      const ringHop2 = circles[0];
      expect(ringHop2?.getAttribute('r')).toBe('100'); // 2000 * 0.05
      expect(ringHop2?.getAttribute('stroke')).toBe('var(--text)');
      expect(ringHop2?.getAttribute('stroke-opacity')).toBe('0.6');
      expect(ringHop2?.getAttribute('stroke-dasharray')).toBeNull();
      expect(ringHop2?.getAttribute('fill')).toBe('none');

      const ringHop1 = circles[1];
      expect(ringHop1?.getAttribute('r')).toBe('50'); // 1000 * 0.05
      expect(ringHop1?.getAttribute('stroke')).toBe('var(--text)');
      expect(ringHop1?.getAttribute('stroke-opacity')).toBe('0.85');
      expect(ringHop1?.getAttribute('stroke-dasharray')).toBeNull();
      expect(ringHop1?.getAttribute('fill')).toBe('none');
    });

    it('renders unfilled azimuthal arcs in compass orientation with descriptive SVG titles', () => {
      const prediction: PropagationPrediction = makePropagationPrediction({
        hops: [makeHop({ n: 1, rangeKm: 1000 })],
        azimuthalHops: [
          makeAzimuthalHop({ phiDeg: 0, rangeKm: [1000] }),
          makeAzimuthalHop({ phiDeg: 90, rangeKm: [1000] }),
          makeAzimuthalHop({ phiDeg: 180, rangeKm: [1000] }),
          makeAzimuthalHop({ phiDeg: 270, rangeKm: [1000] }),
        ],
      });

      const { container } = render(
        <svg>
          <RadarHopRings
            prediction={prediction}
            cx={150}
            cy={150}
            kmToPx={0.05}
          />
        </svg>,
      );

      const lines = container.querySelectorAll('line');
      expect(lines).toHaveLength(4);
      expect(container.querySelectorAll('polygon')).toHaveLength(0);
      // NEC phi=0 is East, phi=90 is North: the first arc joins those bearings.
      expect(Number(lines[0]?.getAttribute('x1'))).toBeCloseTo(200, 8);
      expect(Number(lines[0]?.getAttribute('y1'))).toBeCloseTo(150, 8);
      expect(Number(lines[0]?.getAttribute('x2'))).toBeCloseTo(150, 8);
      expect(Number(lines[0]?.getAttribute('y2'))).toBeCloseTo(100, 8);
      expect(lines[0]?.querySelector('title')?.textContent)
        .toBe('Bearing 90°, elevation 15.0°, realized antenna gain 4.00 dBi: 1× lands at 1000 km.');
    });
  });

  describe('half-power beam outlines', () => {
    // Zenith-included beam towards N/S, a lower beam E/W, nothing W.
    const beamHops = () => [
      makeAzimuthalHop({ phiDeg: 0, rangeKm: [0], halfPowerElevationDeg: { lowDeg: 30, highDeg: 90 }, halfPowerRangeKm: { nearKm: 0, farKm: 800 } }),
      makeAzimuthalHop({ phiDeg: 90, rangeKm: [0], halfPowerElevationDeg: { lowDeg: 50, highDeg: 90 }, halfPowerRangeKm: { nearKm: 0, farKm: 400 } }),
      makeAzimuthalHop({ phiDeg: 180, rangeKm: [0], halfPowerElevationDeg: { lowDeg: 30, highDeg: 90 }, halfPowerRangeKm: { nearKm: 0, farKm: 800 } }),
      makeAzimuthalHop({ phiDeg: 270, rangeKm: [0], halfPowerElevationDeg: { lowDeg: 50, highDeg: 90 }, halfPowerRangeKm: { nearKm: 0, farKm: 400 } }),
    ];

    it('follows the beam far edge rather than the zero-range peak ray', () => {
      const prediction = makePropagationPrediction({ hops: [makeHop({ n: 1, rangeKm: 0 })], azimuthalHops: beamHops() });
      const { container } = render(<svg><RadarHopRings prediction={prediction} cx={150} cy={150} kmToPx={0.1} /></svg>);
      const lines = Array.from(container.querySelectorAll('line'));
      // No dashed near edge: the beam includes the zenith at every bearing.
      expect(lines).toHaveLength(4);
      expect(Number(lines[0]?.getAttribute('x1'))).toBeCloseTo(230, 8); // East, 800 km
      expect(Number(lines[0]?.getAttribute('y2'))).toBeCloseTo(110, 8); // North, 400 km
      expect(lines[0]?.querySelector('title')?.textContent).toContain('half-power beam 30.0–90.0° elevation, farthest landing 800 km after 1 hop');
    });

    it('names only the hop count, at the outline\'s farthest point', () => {
      const prediction = makePropagationPrediction({ hops: [makeHop({ n: 1, rangeKm: 0 })], azimuthalHops: beamHops() });
      render(<svg><RadarLabels cx={150} cy={150} size={300} margin={24} prediction={prediction} kmToPx={0.1} units="metric" /></svg>);
      const label = screen.getByText('1×');
      // East, 800 km, 9 px inside: x = 150 + 71 + 3.
      expect(Number(label.getAttribute('x'))).toBeCloseTo(224, 8);
      expect(screen.queryByText(/km/)).toBeNull();
    });

    it('draws a dashed near edge when the beam leaves a gap close in', () => {
      const hops = beamHops().map((hop) => ({ ...hop, halfPowerRangeKm: { nearKm: 200, farKm: 800 } }));
      const prediction = makePropagationPrediction({ hops: [makeHop({ n: 1, rangeKm: 500 })], azimuthalHops: hops });
      const { container } = render(<svg><RadarHopRings prediction={prediction} cx={150} cy={150} kmToPx={0.1} /></svg>);
      const dashed = Array.from(container.querySelectorAll('line')).filter((line) => line.getAttribute('stroke-dasharray'));
      expect(dashed).toHaveLength(4);
      expect(Number(dashed[0]?.getAttribute('x1'))).toBeCloseTo(170, 8);
    });
  });

  describe('RadarCoverage', () => {
    // Two sectors (N and S at 180° width), strongest near the centre.
    function coverage() {
      const relativeDb = new Float64Array(2 * COVERAGE_BINS).fill(-Infinity);
      for (let bin = 0; bin < 10; bin++) relativeDb[bin] = -bin * 3; // 0 … −27 dB
      relativeDb[COVERAGE_BINS + 5] = -40; // below the floor: not drawn
      return {
        maxRangeKm: 6400, binKm: 100, bearingsDeg: [0, 180], sectorWidthDeg: 180,
        relativeDb, dominantHops: new Uint8Array(2 * COVERAGE_BINS), peakDensity: 1,
      };
    }

    it('shades bins by strength band, merging runs and skipping cells below the floor', () => {
      const prediction = makePropagationPrediction({ coverage: coverage() });
      const { container } = render(<svg><RadarCoverage prediction={prediction} cx={150} cy={150} kmToPx={0.02} units="metric" /></svg>);
      const groups = Array.from(container.querySelectorAll('g > g'));
      // Weakest band first; each band's opacity is on its group.
      expect(groups.map((g) => g.getAttribute('fill'))).toEqual(STRENGTH_BANDS.map((b) => b.fill).reverse());
      expect(groups.map((g) => Number(g.getAttribute('opacity')))).toEqual(STRENGTH_BANDS.map((b) => b.opacity).reverse());
      // 0,−3,−6 | −9,−12 | −15,−18 | −21,−24 | −27: one merged path per band, North sector only.
      const paths = Array.from(container.querySelectorAll('path'));
      expect(paths).toHaveLength(5);
      const strongest = groups[groups.length - 1]!.querySelector('path')!;
      expect(strongest.querySelector('title')!.textContent).toBe('Bearing 0°, 0 km–300 km: up to 0.0 dB relative to the strongest point');
    });

    it('bands relative strength from strongest to weakest', () => {
      expect([0, -5.9, -6, -11, -17, -23, -29.9, -30, -31].map(strengthBand)).toEqual([0, 0, 0, 1, 2, 3, 4, 4, -1]);
    });

    it('shades absolute received power in S-meter bands', () => {
      const relativeDb = new Float64Array(2 * COVERAGE_BINS).fill(-Infinity);
      const receivedDbm = new Float64Array(2 * COVERAGE_BINS).fill(-Infinity);
      receivedDbm[0] = -60; // S9+13
      receivedDbm[1] = -90; // S5–7
      receivedDbm[2] = -130; // below S1: not drawn
      const prediction = makePropagationPrediction({
        coverage: {
          maxRangeKm: 6400, binKm: 100, bearingsDeg: [0, 180], sectorWidthDeg: 180,
          relativeDb, receivedDbm, dominantHops: new Uint8Array(2 * COVERAGE_BINS), peakDensity: 1,
        },
      });
      const { container } = render(<svg><RadarCoverage prediction={prediction} cx={150} cy={150} kmToPx={0.02} units="metric" /></svg>);
      const groups = Array.from(container.querySelectorAll('g > g'));
      expect(groups.map((g) => g.getAttribute('fill'))).toEqual(SIGNAL_BANDS.map((b) => b.fill).reverse());
      const titles = Array.from(container.querySelectorAll('path title')).map((t) => t.textContent);
      expect(titles).toContain('Bearing 0°, 0 km–100 km: up to S9+13 dB (-60 dBm)');
      expect(titles).toContain('Bearing 0°, 100 km–200 km: up to S6 (-90 dBm)');
      expect(titles).toHaveLength(2);
    });

    it('labels S-meter readings', () => {
      expect([-50, -73, -79, -121, -140].map(sMeterLabel)).toEqual(['S9+23 dB', 'S9+0 dB', 'S8', 'S1', 'S0']);
    });

    it('draws nothing without a coverage map', () => {
      const { container } = render(<svg><RadarCoverage prediction={makePropagationPrediction()} cx={150} cy={150} kmToPx={0.02} units="metric" /></svg>);
      expect(container.querySelectorAll('path')).toHaveLength(0);
    });
  });

  describe('RadarLegend', () => {
    it('explains relative strength without implying an absolute signal level', () => {
      const { container } = render(<RadarLegend />);
      const caption = container.querySelector('figcaption')!.textContent!;
      expect(caption).toContain('dB below the strongest point');
      expect(caption).toContain('No absolute signal level');
      expect(screen.queryByText(/Open|Marginal|Closed|weak signal/)).toBeNull();
    });

    it('explains the S-meter scale and that readability depends on noise', () => {
      const { container } = render(<RadarLegend absolute />);
      const caption = container.querySelector('figcaption')!.textContent!;
      expect(caption).toContain('S9+S7–9S5–7S3–5S1–3');
      expect(caption).toContain('isotropic receiving antenna');
      expect(caption).toContain('D-layer absorption (Davies/Rawer)');
      expect(caption).toContain('depends on the noise where you listen');
    });

    it('shows a swatch per strength band, strongest first', () => {
      const { container } = render(<RadarLegend />);
      const swatches = Array.from(container.querySelectorAll('rect'));
      expect(swatches.map((r) => r.getAttribute('fill'))).toEqual(STRENGTH_BANDS.map((b) => b.fill));
      expect(swatches[0]!.getAttribute('fill')).toBe('var(--success)');
    });
  });
});
