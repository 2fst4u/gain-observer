import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PropagationRadar } from '../src/components/Charts/PropagationRadar';
import type { PropagationPrediction } from '../src/physics/propagation';
import { makeAzimuthalHop, makeHop, makePropagationPrediction } from './helpers/factories';

describe('PropagationRadar', () => {
  it('renders radar with rings', () => {
    const prediction: PropagationPrediction = makePropagationPrediction({
      hops: [
        makeHop({ n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful' }),
        makeHop({ n: 2, rangeKm: 2000, status: 'marginal', linkQuality: 'weak' }),
      ],
    });
    render(<PropagationRadar prediction={prediction} units="metric" size={300} />);
    expect(screen.getByRole('img', { name: /radar plot/i })).toBeTruthy();
  });

  it('renders azimuthal hop wedges', () => {
    const prediction: PropagationPrediction = makePropagationPrediction({
      hops: [
        makeHop({ n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful' }),
      ],
      azimuthalHops: [
        makeAzimuthalHop({ phiDeg: 0, rangeKm: [1000], status: 'open', linkQuality: 'useful' }),
        makeAzimuthalHop({ phiDeg: 90, rangeKm: [1000], status: 'marginal', linkQuality: 'weak' }),
        makeAzimuthalHop({ phiDeg: 180, rangeKm: [1000], status: 'open', linkQuality: 'useful' }),
        makeAzimuthalHop({ phiDeg: 270, rangeKm: [1000], status: 'closed', linkQuality: 'unusable' }),
      ],
    });
    const { container } = render(<PropagationRadar prediction={prediction} units="metric" size={300} />);
    // Look for wedges
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(4);
  });

  it('draws each radial at its compass bearing, not at its NEC φ', () => {
    // One long radial due East (bearing 90°, which is NEC φ = 0°) and short
    // ones elsewhere. Plotting φ as a bearing would swing this radial to the
    // top of the plot (North) instead of the right-hand side.
    const prediction: PropagationPrediction = makePropagationPrediction({
      hops: [makeHop({ n: 1, rangeKm: 4000 })],
      azimuthalHops: [
        makeAzimuthalHop({ phiDeg: 0, rangeKm: [4000] }),
        makeAzimuthalHop({ phiDeg: 90, rangeKm: [100] }),
        makeAzimuthalHop({ phiDeg: 180, rangeKm: [100] }),
        makeAzimuthalHop({ phiDeg: 270, rangeKm: [100] }),
      ],
    });
    const { container } = render(<PropagationRadar prediction={prediction} units="metric" size={300} />);
    const points = Array.from(container.querySelectorAll('polygon')).flatMap((poly) =>
      (poly.getAttribute('points') ?? '')
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(',').map(Number) as [number, number]),
    );
    const cx = 150;
    const cy = 150;
    // The far vertex must lie to the right of centre (East) and level with it,
    // not above it (North).
    const far = points.reduce((a, b) =>
      Math.hypot(b[0] - cx, b[1] - cy) > Math.hypot(a[0] - cx, a[1] - cy) ? b : a,
    );
    expect(far[0] - cx).toBeGreaterThan(50);
    expect(Math.abs(far[1] - cy)).toBeLessThan(1);
  });
});
