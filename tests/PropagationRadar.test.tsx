import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PropagationRadar } from '../src/components/Charts/PropagationRadar';
import { makeAzimuthalHop, makeHop, makePropagationPrediction } from './helpers/factories';

describe('PropagationRadar', () => {
  it('draws unfilled ideal arcs and identifies that coverage is not calculated', () => {
    const { container } = render(<PropagationRadar prediction={makePropagationPrediction()} units="metric" size={300} />);
    expect(screen.getByRole('img', { name: /geometry radar plot/i })).toBeTruthy();
    expect(screen.getByText(/no coverage or signal forecast/)).toBeDefined();
    const arc = Array.from(container.querySelectorAll('circle')).find((element) => element.getAttribute('stroke') === 'var(--accent)');
    expect(arc?.getAttribute('fill')).toBe('none');
  });

  it('draws the East lobe on the right using compass bearings, without filled coverage wedges', () => {
    const prediction = makePropagationPrediction({
      hops: [makeHop({ rangeKm: 4000 })],
      azimuthalHops: [
        makeAzimuthalHop({ phiDeg: 0, rangeKm: [4000] }),
        makeAzimuthalHop({ phiDeg: 90, rangeKm: [100] }),
        makeAzimuthalHop({ phiDeg: 180, rangeKm: [100] }),
        makeAzimuthalHop({ phiDeg: 270, rangeKm: [100] }),
      ],
    });
    const { container } = render(<PropagationRadar prediction={prediction} units="metric" size={300} />);
    const arcs = Array.from(container.querySelectorAll('line')).filter((line) => line.getAttribute('stroke') === 'var(--accent)');
    expect(arcs).toHaveLength(4);
    expect(container.querySelectorAll('polygon')).toHaveLength(0);
    const points = arcs.flatMap((line) => [[Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))], [Number(line.getAttribute('x2')), Number(line.getAttribute('y2'))]]);
    const far = points.reduce((a, b) => Math.hypot(b[0]! - 150, b[1]! - 150) > Math.hypot(a[0]! - 150, a[1]! - 150) ? b : a);
    expect(far[0]! - 150).toBeGreaterThan(50);
    expect(Math.abs(far[1]! - 150)).toBeLessThan(1);
  });
});
