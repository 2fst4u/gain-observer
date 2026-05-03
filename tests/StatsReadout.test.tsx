import { describe, expect, it, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatsReadout } from '../src/components/Panel/StatsReadout';
import { useAntennaStore } from '../src/store/antennaStore';

describe('StatsReadout', () => {
  beforeEach(() => {
    cleanup();
    // Reset store before each test
    useAntennaStore.setState({
      result: null,
      mode: 'standard',
      comparisonReference: null,
    });
  });

  it('renders "Computing…" when there is no result', () => {
    const { getByText } = render(<StatsReadout />);
    expect(getByText('Computing…')).not.toBeNull();
  });

  it('renders standard stats when result is present', () => {
    useAntennaStore.setState({
      result: {
        computeTimeMs: 15,
        maxGainDbi: 5.5,
        takeoffElevationDeg: 25,
        takeoffAzimuthDeg: 90,
        impedance: { R: 45, X: 10 },
        swr: 1.2,
        pattern: { data: new Float32Array([1, 2, 3]), phiSteps: 1, thetaSteps: 3 }
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText, container } = render(<StatsReadout />);

    expect(getByText('15 ms')).not.toBeNull();
    expect(getByText('5.50 dBi')).not.toBeNull();
    expect(getByText('25.0°')).not.toBeNull();
    expect(getByText('90°')).not.toBeNull();
    expect(getByText('1.20:1')).not.toBeNull();
    expect(container.textContent).toContain('45.0 +j10.0 Ω');
  });

  it('renders comparison stats when mode is comparison and reference exists', () => {
    useAntennaStore.setState({
      mode: 'comparison',
      result: {
        maxGainDbi: 6,
        takeoffElevationDeg: 20,
        swr: 1.5,
        impedance: { R: 50, X: 0 },
        computeTimeMs: 10,
        takeoffAzimuthDeg: 90,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 }
      } as unknown as import('../src/physics/types').SimulationResult,
      comparisonReference: {
        result: {
          maxGainDbi: 4,
          takeoffElevationDeg: 30,
          swr: 2.0,
          impedance: { R: 40, X: -10 }
        }
      } as unknown as import('../src/store/antennaStore').ComparisonSnapshot,
    });

    const { getByText, getAllByText } = render(<StatsReadout />);
    expect(getByText('Versus reference')).not.toBeNull();
    expect(getByText('+2.00 dB')).not.toBeNull();
    expect(getByText('-10.0°')).not.toBeNull();
    expect(getByText('-0.50')).not.toBeNull();
    const plus10Elements = getAllByText('+10.0 Ω');
    expect(plus10Elements.length).toBe(2); // R delta: 50 - 40, X delta: 0 - (-10) = +10
  });

  it('renders NVIS stats when mode is nvis', () => {
    useAntennaStore.setState({
      mode: 'nvis',
      result: {
        maxGainDbi: 5,
        pattern: {
          data: new Float32Array([2.5]), // Zenith gain
          phiSteps: 72,
          thetaSteps: 37,
        },
        computeTimeMs: 10,
        takeoffElevationDeg: 90,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.0
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText } = render(<StatsReadout />);
    expect(getByText('Zenith gain (NVIS)')).not.toBeNull();
    expect(getByText('2.50 dBi')).not.toBeNull();
    // ratio: 2.5 - 5 = -2.5
    expect(getByText('-2.50 dB')).not.toBeNull();
  });
});
