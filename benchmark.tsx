import React from 'react';
import { renderToString } from 'react-dom/server';
import { PropagationRadar } from './src/components/Charts/PropagationRadar';
import type { PropagationPrediction } from './src/physics/propagation';

const prediction: PropagationPrediction = {
  mode: 'skywave',
  criticalFreqMhz: 10,
  hops: [
    { n: 1, rangeKm: 1000, status: 'open', linkQuality: 'useful' },
    { n: 2, rangeKm: 2000, status: 'marginal', linkQuality: 'weak' },
    { n: 3, rangeKm: 3000, status: 'closed', linkQuality: 'unusable' },
  ],
  azimuthalHops: Array.from({ length: 360 }).map((_, i) => ({
    phiDeg: i,
    rangeKm: [1000, 2000, 3000],
    status: i % 2 === 0 ? 'open' : 'marginal',
    linkQuality: i % 2 === 0 ? 'useful' : 'weak',
  })),
};

const start = performance.now();
for (let i = 0; i < 1000; i++) {
  renderToString(<PropagationRadar prediction={prediction} units="metric" size={300} />);
}
const end = performance.now();
console.log(`Render time for 1000 iterations: ${end - start} ms`);
