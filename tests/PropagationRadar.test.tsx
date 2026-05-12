import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PropagationRadar } from '../src/components/Charts/PropagationRadar';
import type { PropagationPrediction } from '../src/physics/propagation';

describe('PropagationRadar', () => {
  it('renders radar with rings', () => {
    const prediction: PropagationPrediction = {
      mode: 'skywave',
      criticalFreqMhz: 10,
      hops: [
        { n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful' },
        { n: 2, rangeKm: 2000, status: 'marginal', linkQuality: 'weak' },
      ],
    };
    render(<PropagationRadar prediction={prediction} units="metric" size={300} />);
    expect(screen.getByRole('img', { name: /radar plot/i })).toBeTruthy();
  });

  it('renders azimuthal hop wedges', () => {
    const prediction: PropagationPrediction = {
      mode: 'skywave',
      criticalFreqMhz: 10,
      hops: [
        { n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful' },
      ],
      azimuthalHops: [
        { phiDeg: 0, rangeKm: [1000], status: 'open', linkQuality: 'useful' },
        { phiDeg: 90, rangeKm: [1000], status: 'marginal', linkQuality: 'weak' },
        { phiDeg: 180, rangeKm: [1000], status: 'open', linkQuality: 'useful' },
        { phiDeg: 270, rangeKm: [1000], status: 'closed', linkQuality: 'unusable' },
      ],
    };
    const { container } = render(<PropagationRadar prediction={prediction} units="metric" size={300} />);
    // Look for wedges
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(4);
  });
});
