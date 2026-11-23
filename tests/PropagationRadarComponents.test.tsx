import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RadarGrid,
  RadarHopRings,
  RadarLabels,
  RadarLegend,
} from '../src/components/Charts/PropagationRadarComponents';
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
      expect(ringHop2?.getAttribute('stroke-opacity')).toBe('0.75');
      expect(ringHop2?.getAttribute('stroke-dasharray')).toBeNull();
      expect(ringHop2?.getAttribute('fill')).toBe('none');

      const ringHop1 = circles[1];
      expect(ringHop1?.getAttribute('r')).toBe('50'); // 1000 * 0.05
      expect(ringHop1?.getAttribute('stroke-opacity')).toBe('0.75');
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

  describe('RadarLegend', () => {
    it('describes landing distances without implying coverage or received signal', () => {
      const { container } = render(<RadarLegend />);

      expect(container.querySelector('figcaption')?.textContent)
        .toBe('Where the half-power beam\'s rays land · IRI monthly median · no signal forecast');
      expect(screen.queryByText(/Open|Marginal|Closed|weak signal/)).toBeNull();
    });
  });
});
