import { describe, expect, it, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatsReadout } from '../src/components/Panel/StatsReadout';
import { useAntennaStore } from '../src/store/antennaStore';
import type { TerminationDiagnostics } from '../src/physics/types';

describe('StatsReadout', () => {
  beforeEach(() => {
    cleanup();
    // Reset store before each test; include antennaType to prevent state bleed
    useAntennaStore.setState({
      antennaType: 'dipole',
      result: null,
      mode: 'normal',
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
    // Gain label replaces the old ambiguous "Max gain"
    expect(getByText('Gain')).not.toBeNull();
    expect(getByText('5.50 dBi')).not.toBeNull();
    expect(getByText('25.0°')).not.toBeNull();
    expect(getByText('90°')).not.toBeNull();
    expect(getByText('1.20:1')).not.toBeNull();
    expect(container.textContent).toContain('45.0 +j10.0 Ω');
    // SWR label updated to "vs 50 Ω"
    expect(container.textContent).toContain('SWR (vs 50 Ω)');
  });

  it('labels impedance as "Feedpoint" when no feedline is configured', () => {
    useAntennaStore.setState({
      feedlineId: 'none',
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2.0,
        takeoffElevationDeg: 30,
        takeoffAzimuthDeg: 0,
        impedance: { R: 70, X: 5 },
        swr: 1.5,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<StatsReadout />);
    expect(container.textContent).toContain('Feedpoint (R + jX)');
    expect(container.textContent).not.toContain('Source impedance');
  });

  it('labels impedance as "Source impedance" when a feedline is active', () => {
    useAntennaStore.setState({
      feedlineId: 'rg58',
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2.0,
        takeoffElevationDeg: 30,
        takeoffAzimuthDeg: 0,
        impedance: { R: 70, X: 5 },
        swr: 1.5,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<StatsReadout />);
    expect(container.textContent).toContain('Source impedance (R + jX)');
    expect(container.textContent).not.toContain('Feedpoint (R + jX)');
  });

  it('renders directivity and efficiency when power budget data is provided', () => {
    useAntennaStore.setState({
      result: {
        computeTimeMs: 10,
        maxGainDbi: 3.0,
        // efficiency = 0.5 → directivity = 3.0 - 10*log10(0.5) ≈ 3.0 + 3.01 ≈ 6.01 dBi
        efficiency: 0.5,
        maxDirectivityDbi: 3.0 - 10 * Math.log10(0.5),
        // mismatch loss = 0 (perfect match) → realized gain = gain
        maxRealizedGainDbi: 3.0,
        takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText } = render(<StatsReadout />);

    expect(getByText('Gain')).not.toBeNull();
    expect(getByText('Directivity')).not.toBeNull();
    expect(getByText('Realized gain')).not.toBeNull();
    expect(getByText('Efficiency')).not.toBeNull();
    expect(getByText('50.0%')).not.toBeNull();
    // Directivity = 3.0 + 10·log10(2) ≈ 6.01 dBi
    expect(getByText('6.01 dBi')).not.toBeNull();
  });

  it('omits directivity and efficiency when power budget is unavailable', () => {
    useAntennaStore.setState({
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2.15,
        // no efficiency / maxDirectivityDbi fields
        maxRealizedGainDbi: 1.8,
        takeoffElevationDeg: 20,
        takeoffAzimuthDeg: 0,
        impedance: { R: 73, X: 0 },
        swr: 1.46,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container, getByText } = render(<StatsReadout />);
    expect(getByText('Gain')).not.toBeNull();
    expect(container.textContent).not.toContain('Directivity');
    expect(container.textContent).not.toContain('Efficiency');
    expect(getByText('Realized gain')).not.toBeNull();
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

  it('does not render termination section or note for dipole', () => {
    const diagnostics: TerminationDiagnostics = {
      currentRippleByTag: [
        { tagNo: 1, magnitudes: [2e-3, 1e-3], ripple: 2, rippleDb: 6.02 },
      ],
      powerBudget: {
        inputW: 0.01, radiatedW: 0.006, structureLossW: 0,
        networkLossW: 0.004, efficiencyPct: 60,
      },
      frontBackDb: 8.5,
    };
    useAntennaStore.setState({
      antennaType: 'dipole',
      result: {
        computeTimeMs: 10, maxGainDbi: 2, takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0, impedance: { R: 50, X: 0 }, swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
        terminationDiagnostics: diagnostics,
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    const { container } = render(<StatsReadout />);
    expect(container.textContent).not.toContain('Termination effectiveness');
    expect(container.textContent).not.toContain('Termination reduces reflections');
  });

});
