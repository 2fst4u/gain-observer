import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LegendSwatch,
  RadarGrid,
  RadarHopRings,
  RadarLabels,
  RadarLegend,
} from '../src/components/Charts/PropagationRadarComponents';
import type { PropagationPrediction } from '../src/physics/propagation';
import { makeAzimuthalHop, makeHop, makePropagationPrediction } from './helpers/factories';

describe('PropagationRadarComponents', () => {
  describe('RadarGrid', () => {
    it('renders background disc, inner dashed gridlines, and cross-hair axes', () => {
      const { container } = render(
        <svg>
          <RadarGrid cx={150} cy={150} size={300} maxRadiusPx={120} margin={15} />
        </svg>,
      );

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(4); // 1 background + 3 inner gridlines

      // Background disc
      expect(circles[0]?.getAttribute('cx')).toBe('150');
      expect(circles[0]?.getAttribute('cy')).toBe('150');
      expect(circles[0]?.getAttribute('r')).toBe('120');

      // Inner gridlines at 25%, 50%, 75%
      expect(circles[1]?.getAttribute('r')).toBe('30'); // 120 * 0.25
      expect(circles[2]?.getAttribute('r')).toBe('60'); // 120 * 0.5
      expect(circles[3]?.getAttribute('r')).toBe('90'); // 120 * 0.75
      expect(circles[1]?.getAttribute('stroke-dasharray')).toBe('2 3');

      // Cross-hair lines
      const lines = container.querySelectorAll('line');
      expect(lines.length).toBe(2);
      // Vertical line: x1=150, y1=15, x2=150, y2=285
      expect(lines[0]?.getAttribute('x1')).toBe('150');
      expect(lines[0]?.getAttribute('y1')).toBe('15');
      expect(lines[0]?.getAttribute('x2')).toBe('150');
      expect(lines[0]?.getAttribute('y2')).toBe('285');
      // Horizontal line: x1=15, y1=150, x2=285, y2=150
      expect(lines[1]?.getAttribute('x1')).toBe('15');
      expect(lines[1]?.getAttribute('y1')).toBe('150');
      expect(lines[1]?.getAttribute('x2')).toBe('285');
      expect(lines[1]?.getAttribute('y2')).toBe('150');
    });
  });

  describe('RadarLabels', () => {
    it('renders cardinal directions and hop distance labels in metric units', () => {
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
            margin={15}
            prediction={prediction}
            kmToPx={0.05}
            units="metric"
          />
        </svg>,
      );

      // Cardinal labels
      expect(screen.getByText('N')).toBeTruthy();
      expect(screen.getByText('S')).toBeTruthy();
      expect(screen.getByText('E')).toBeTruthy();
      expect(screen.getByText('W')).toBeTruthy();

      // Hop range labels in metric
      expect(screen.getByText(/1× 1000 km/)).toBeTruthy();
      expect(screen.getByText(/2× 2000 km/)).toBeTruthy();
    });

    it('renders hop distance labels in imperial units', () => {
      const prediction: PropagationPrediction = makePropagationPrediction({
        hops: [makeHop({ n: 1, rangeKm: 1000 })],
      });

      render(
        <svg>
          <RadarLabels
            cx={150}
            cy={150}
            size={300}
            margin={15}
            prediction={prediction}
            kmToPx={0.05}
            units="imperial"
          />
        </svg>,
      );

      // 1000 km ≈ 621 mi
      expect(screen.getByText(/1× 621 mi/)).toBeTruthy();
    });
  });

  describe('RadarHopRings', () => {
    it('renders concentric circles when azimuthalHops is omitted or has 1 entry', () => {
      const prediction: PropagationPrediction = makePropagationPrediction({
        hops: [
          makeHop({ n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful' }),
          makeHop({ n: 2, rangeKm: 2000, status: 'closed', linkQuality: 'unusable' }),
        ],
        azimuthalHops: undefined,
      });

      const { container } = render(
        <svg>
          <RadarHopRings prediction={prediction} cx={150} cy={150} kmToPx={0.05} />
        </svg>,
      );

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(2);

      // Unusable hop (rendered first due to reverse loop iteration: n=2 first)
      const ring2 = circles[0];
      expect(ring2?.getAttribute('r')).toBe('100'); // 2000 * 0.05
      expect(ring2?.getAttribute('stroke-dasharray')).toBe('4 3');
      expect(ring2?.getAttribute('stroke-opacity')).toBe('0.35');

      // Useful open hop (rendered second: n=1)
      const ring1 = circles[1];
      expect(ring1?.getAttribute('r')).toBe('50'); // 1000 * 0.05
      expect(ring1?.getAttribute('stroke-dasharray')).toBeNull();
      expect(ring1?.getAttribute('stroke-opacity')).toBe('0.85');
    });

    it('renders polygon azimuthal wedges when azimuthalHops.length > 1', () => {
      const prediction: PropagationPrediction = makePropagationPrediction({
        hops: [makeHop({ n: 1, rangeKm: 1000 })],
        azimuthalHops: [
          makeAzimuthalHop({ phiDeg: 0, rangeKm: [1000], status: 'open' }),
          makeAzimuthalHop({ phiDeg: 90, rangeKm: [1000], status: 'marginal' }),
        ],
      });

      const { container } = render(
        <svg>
          <RadarHopRings prediction={prediction} cx={150} cy={150} kmToPx={0.05} />
        </svg>,
      );

      const polygons = container.querySelectorAll('polygon');
      expect(polygons.length).toBe(2);
    });
  });

  describe('LegendSwatch', () => {
    it('renders swatch with given color dot and label', () => {
      render(<LegendSwatch color="var(--success)" label="Test Status" />);
      expect(screen.getByText('Test Status')).toBeTruthy();
    });
  });

  describe('RadarLegend', () => {
    it('renders figcaption with status swatches and note', () => {
      render(<RadarLegend />);

      expect(screen.getByText('Open')).toBeTruthy();
      expect(screen.getByText('Marginal')).toBeTruthy();
      expect(screen.getByText('Closed')).toBeTruthy();
      expect(screen.getByText('Faint/dashed = weak signal')).toBeTruthy();
    });
  });
});
