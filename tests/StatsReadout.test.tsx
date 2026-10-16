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
      atuEnabled: false,
      transformerEnabled: false,
      feedlineId: 'none',
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
    // takeoffAzimuthDeg is NEC azimuth φ (0° = +X = East). The row reports a
    // compass bearing, so φ = 90° (which is +Y) reads as 0° = North.
    expect(getByText('0°')).not.toBeNull();
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

  it('renders realized gain correctly with transformer in display', () => {
    // Arrange
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 4,
      feedlineId: 'none',
      result: {
        computeTimeMs: 10,
        maxGainDbi: 5.0,
        maxRealizedGainDbi: 4.0, // should be ignored, re-calculated
        takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0,
        impedance: { R: 200, X: 0 },
        swr: 4.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    // Act
    const { getByText } = render(<StatsReadout />);

    // Assert (displayedRealizedGainDbi = 5.0 + 0 - 0.2 = 4.8 dBi)
    expect(getByText('4.80 dBi')).not.toBeNull();
  });

  it('renders realized gain correctly with transformer in model', () => {
    // Arrange
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 4,
      feedlineId: 'rg58',
      result: {
        computeTimeMs: 10, maxGainDbi: 5.0, maxRealizedGainDbi: 4.5,
        takeoffElevationDeg: 15, takeoffAzimuthDeg: 0, impedance: { R: 50, X: 0 },
        swr: 1.0, pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    // Act
    const { getByText } = render(<StatsReadout />);

    // Assert (displayedRealizedGainDbi = 4.5 - 0.2 = 4.3 dBi)
    expect(getByText('4.30 dBi')).not.toBeNull();
  });

  it('renders realized gain correctly with choke only (transformer enabled, ratio 1)', () => {
    // Arrange
    useAntennaStore.setState({
      transformerEnabled: true,
      transformerRatio: 1,
      feedlineId: 'none',
      result: {
        computeTimeMs: 10, maxGainDbi: 5.0, maxRealizedGainDbi: 4.5,
        takeoffElevationDeg: 15, takeoffAzimuthDeg: 0, impedance: { R: 50, X: 0 },
        swr: 1.0, pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    // Act
    const { getByText } = render(<StatsReadout />);

    // Assert (displayedRealizedGainDbi = 4.5 - 0.2 = 4.3 dBi)
    expect(getByText('4.30 dBi')).not.toBeNull();
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

  it('reads termination dissipation from the structure-loss bucket', () => {
    // Every termination in this app is an LD-4 segment load, and NEC books LD
    // loads as STRUCTURE LOSS — NETWORK LOSS covers NT-card two-port networks,
    // which these decks never emit. Reading networkLossW alone made this row
    // display 0.00 mW no matter how much the resistor was absorbing.
    const diagnostics: TerminationDiagnostics = {
      currentRippleByTag: [
        { tagNo: 1, magnitudes: [2e-3, 1e-3], ripple: 2, rippleDb: 2.0 },
      ],
      powerBudget: {
        inputW: 0.01, radiatedW: 0.006, structureLossW: 0.004,
        networkLossW: 0, efficiencyPct: 60,
      },
      frontBackDb: 8.5,
    };
    useAntennaStore.setState({
      antennaType: 'sloping-v',
      result: {
        computeTimeMs: 10, maxGainDbi: 2, takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0, impedance: { R: 50, X: 0 }, swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
        terminationDiagnostics: diagnostics,
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText } = render(<StatsReadout />);
    expect(getByText('4.00 mW')).not.toBeNull();
  });

  it('renders termination section for sloping-v with front-back ratio', () => {
    // Arrange
    const diagnostics: TerminationDiagnostics = {
      currentRippleByTag: [
        { tagNo: 1, magnitudes: [2e-3, 1e-3], ripple: 2, rippleDb: 2.0 },
        { tagNo: 2, magnitudes: [2e-3, 1e-3], ripple: 2, rippleDb: 11.0 },
      ],
      powerBudget: {
        inputW: 0.01, radiatedW: 0.006, structureLossW: 0,
        networkLossW: 0.004, efficiencyPct: 60,
      },
      frontBackDb: 8.5,
    };
    useAntennaStore.setState({
      antennaType: 'sloping-v',
      result: {
        computeTimeMs: 10, maxGainDbi: 2, takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0, impedance: { R: 50, X: 0 }, swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
        terminationDiagnostics: diagnostics,
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    // Act
    const { container } = render(<StatsReadout />);

    // Assert
    expect(container.textContent).toContain('Termination effectiveness');
    expect(container.textContent).toContain('8.5 dB');
  });

  it('renders termination section with infinity and default tag names', () => {
    // Arrange
    const diagnostics: TerminationDiagnostics = {
      currentRippleByTag: [
        { tagNo: 1, magnitudes: [2e-3, 0], ripple: Infinity, rippleDb: Infinity },
      ],
      powerBudget: {
        inputW: 0.01, radiatedW: 0.006, structureLossW: 0,
        networkLossW: 0.004, efficiencyPct: 60,
      },
      frontBackDb: null,
    };
    useAntennaStore.setState({
      antennaType: 'sloping-v',
      result: {
        computeTimeMs: 10, maxGainDbi: 2, takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0, impedance: { R: 50, X: 0 }, swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
        terminationDiagnostics: diagnostics,
      } as unknown as import('../src/physics/types').SimulationResult,
    });
    // Act
    const { container } = render(<StatsReadout />);

    // Assert
    expect(container.textContent).toContain('Termination effectiveness');
    expect(container.textContent).toContain('∞ dB');
    expect(container.textContent).toContain('Left leg ripple');
  });

  it('applies correct SWR threshold colors and negative reactance formatting', () => {
    // SWR > 2 -> danger color, negative reactance -> −jX
    useAntennaStore.setState({
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2.0,
        takeoffElevationDeg: 30,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: -25.5 },
        swr: 2.5,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText, container } = render(<StatsReadout />);
    const swrValue = getByText('2.50:1');
    expect(swrValue.style.color).toBe('var(--danger)');
    expect(container.textContent).toContain('50.0 −j25.5 Ω');
    cleanup();

    // SWR > 1.5 and <= 2 -> warning color
    useAntennaStore.setState({
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2.0,
        takeoffElevationDeg: 30,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.8,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText: getByTextWarning } = render(<StatsReadout />);
    const swrWarning = getByTextWarning('1.80:1');
    expect(swrWarning.style.color).toBe('var(--warning)');
    cleanup();

    // SWR <= 1.5 -> success color
    useAntennaStore.setState({
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2.0,
        takeoffElevationDeg: 30,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.2,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText: getByTextSuccess } = render(<StatsReadout />);
    const swrSuccess = getByTextSuccess('1.20:1');
    expect(swrSuccess.style.color).toBe('var(--success)');
  });

  it('renders title tooltips correctly when ATU is enabled', () => {
    useAntennaStore.setState({
      atuEnabled: true,
      frequency: 14.1,
      feedlineId: 'rg58',
      feedlineLength: 10,
      atuMainFeedlineLength: 15,
      result: {
        computeTimeMs: 10,
        maxGainDbi: 5.0,
        takeoffElevationDeg: 20,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<StatsReadout />);
    expect(container.textContent).toContain('Source impedance (R + jX)');
    expect(container.innerHTML).toContain('Impedance the radio sees with the ATU at the mast base matched');
    expect(container.innerHTML).toContain('Voltage SWR your radio sees with the mast-base ATU matched');
    expect(container.innerHTML).toContain('Realized gain (dBi): antenna gain delivered through the mast-base ATU');
  });

  it('renders title tooltips correctly with feedline active and transformer enabled', () => {
    useAntennaStore.setState({
      feedlineId: 'rg58',
      transformerEnabled: true,
      transformerRatio: 4,
      result: {
        computeTimeMs: 10,
        maxGainDbi: 5.0,
        takeoffElevationDeg: 20,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<StatsReadout />);
    expect(container.innerHTML).toContain('with the 4:1 transformer fitted at the antenna terminals');
    expect(container.innerHTML).toContain('Voltage SWR at the source end of the feedline against 50 Ω (with the transformer fitted at the antenna)');
  });

  it('renders title tooltips correctly when transformer is enabled without feedline', () => {
    useAntennaStore.setState({
      feedlineId: 'none',
      transformerEnabled: true,
      transformerRatio: 4,
      result: {
        computeTimeMs: 10,
        maxGainDbi: 5.0,
        takeoffElevationDeg: 20,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<StatsReadout />);
    expect(container.innerHTML).toContain('Impedance after the 4:1 transformer fitted at the antenna terminals.');
    expect(container.innerHTML).toContain('Voltage SWR at the radio side of the antenna\'s 4:1 transformer against 50 Ω.');
    expect(container.innerHTML).toContain('Realized gain (dBi): antenna gain after mismatch loss against 50 Ω with the 4:1 transformer fitted');
  });

  it('renders termination section ripple colors and leg labels correctly', () => {
    const diagnostics: TerminationDiagnostics = {
      currentRippleByTag: [
        { tagNo: 1, magnitudes: [2e-3, 1e-3], ripple: 1.2, rippleDb: 2.0 }, // Left leg (<3 dB -> success)
        { tagNo: 2, magnitudes: [2e-3, 1e-3], ripple: 2.0, rippleDb: 6.0 }, // Right leg (3-10 dB -> warning)
        { tagNo: 3, magnitudes: [2e-3, 1e-3], ripple: 4.0, rippleDb: 12.0 }, // Custom tag (>=10 dB -> danger, ignored in filter though)
      ],
      powerBudget: null,
      frontBackDb: null,
    };
    useAntennaStore.setState({
      antennaType: 'sloping-v',
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2,
        takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
        terminationDiagnostics: diagnostics,
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { getByText, container } = render(<StatsReadout />);
    const leftRipple = getByText('2.0 dB');
    const rightRipple = getByText('6.0 dB');
    expect(leftRipple.style.color).toBe('var(--success)');
    expect(rightRipple.style.color).toBe('var(--warning)');
    expect(container.textContent).toContain('Left leg ripple');
    expect(container.textContent).toContain('Right leg ripple');
  });

  it('returns null for TerminationSection when diagnostics has no content', () => {
    const diagnostics: TerminationDiagnostics = {
      currentRippleByTag: [],
      powerBudget: null,
      frontBackDb: null,
    };
    useAntennaStore.setState({
      antennaType: 'sloping-v',
      result: {
        computeTimeMs: 10,
        maxGainDbi: 2,
        takeoffElevationDeg: 15,
        takeoffAzimuthDeg: 0,
        impedance: { R: 50, X: 0 },
        swr: 1.0,
        pattern: { data: new Float32Array([1]), phiSteps: 1, thetaSteps: 1 },
        terminationDiagnostics: diagnostics,
      } as unknown as import('../src/physics/types').SimulationResult,
    });

    const { container } = render(<StatsReadout />);
    expect(container.textContent).not.toContain('Termination effectiveness');
  });
});
