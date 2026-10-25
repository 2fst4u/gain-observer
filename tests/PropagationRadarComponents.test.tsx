import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LegendSwatch,
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
          makeHop({ n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful' }),
          makeHop({ n: 2, rangeKm: 2000, status: 'closed', linkQuality: 'unusable' }),
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
      expect(ringHop2?.getAttribute('stroke-opacity')).toBe('0.35');
      expect(ringHop2?.getAttribute('stroke-dasharray')).toBe('4 3');

      const ringHop1 = circles[1];
      expect(ringHop1?.getAttribute('r')).toBe('50'); // 1000 * 0.05
      expect(ringHop1?.getAttribute('stroke-opacity')).toBe('0.85');
      expect(ringHop1?.getAttribute('stroke-dasharray')).toBeNull();
    });

    it('renders azimuthal wedges when azimuthalHops has more than 1 item', () => {
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

      const polygons = container.querySelectorAll('polygon');
      expect(polygons.length).toBeGreaterThan(0);
    });
  });

  describe('LegendSwatch', () => {
    it('renders label and a colored dot with aria-hidden', () => {
      const { container } = render(
        <LegendSwatch color="var(--success)" label="Open" />,
      );

      expect(screen.getByText('Open')).toBeTruthy();
      const dot = container.querySelector('span > span');
      expect(dot?.getAttribute('aria-hidden')).toBe('true');
      expect(dot?.style.background).toBe('var(--success)');
    });
  });

  describe('RadarLegend', () => {
    it('renders legend caption with all status swatches and note', () => {
      render(<RadarLegend />);

      expect(screen.getByText('Open')).toBeTruthy();
      expect(screen.getByText('Marginal')).toBeTruthy();
      expect(screen.getByText('Closed')).toBeTruthy();
      expect(screen.getByText('Faint/dashed = weak signal')).toBeTruthy();
    });
  });
});
