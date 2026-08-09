import { describe, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAntennaGeometry } from '../src/components/Scene/useAntennaGeometry';

describe('useAntennaGeometry benchmark', () => {
  it('benchmarks useAntennaGeometry', () => {
    const props = {
      type: 'delta-loop' as const,
      length: 10,
      height: 10,
      orientation: 'horizontal' as const,
      wireRadius: 0.001,
      segments: 21,
      feedlineId: 'rg58',
      feedlineLength: 10,
      feedlineOffset: 0,
      whipCounterpoise: false,
      vAngle: 90,
      legSlope: 45,
      frequency: 14.1,
      foldedDipoleAperture: 0.1,
    };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const p = { ...props, frequency: props.frequency + i * 0.001 };
      renderHook(() => useAntennaGeometry(p));
    }
    const end = performance.now();
    console.log(`Benchmark completed in ${end - start}ms`);
  });
});