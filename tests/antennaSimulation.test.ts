import { describe, expect, it } from 'vitest';
import {
  clampSwrView,
  defaultSwrSpan,
  selectSwrWindow,
  recommendedTerminatingResistor,
  computeOptimalVAngleDeg,
  legMultipleFromLength,
  calculateDefaultLength,
  selectAtuConfig,
  buildWires,
  selectSimulationInput,
  SLOPING_V_DEFAULT_TERMINATION_OHMS,
  TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS,
} from '../src/store/antennaSimulation';
import {
  SWEEP_F_MIN_MHZ,
  SWEEP_F_MAX_MHZ,
  FOLDED_DIPOLE_FEED_R_OHMS,
  ATU_COMPONENT_Q,
  halfWaveLength,
} from '../src/physics/constants';
import type { AntennaType } from '../src/physics/types';
import type { AntennaState } from '../src/store/antennaStore';

describe('antennaSimulation', () => {
  describe('clampSwrView', () => {
    it('clamps span to min span (0.05 MHz) when requested span is too small', () => {
      const result = clampSwrView(14.1, 0.01);
      expect(result.span).toBe(0.05);
      expect(result.center).toBe(14.1);
    });

    it('clamps span to full HF range when requested span exceeds max span', () => {
      const fullSpan = SWEEP_F_MAX_MHZ - SWEEP_F_MIN_MHZ; // 30 - 1.0 = 29.0
      const result = clampSwrView(14.1, 100);
      expect(result.span).toBe(fullSpan);
      expect(result.center).toBe(SWEEP_F_MIN_MHZ + fullSpan / 2); // 1.0 + 14.5 = 15.5
    });

    it('clamps center near lower boundary to prevent span extending below SWEEP_F_MIN_MHZ', () => {
      const span = 2.0;
      // half = 1.0; min center = SWEEP_F_MIN_MHZ (1.0) + 1.0 = 2.0
      const result = clampSwrView(1.2, span);
      expect(result.span).toBe(span);
      expect(result.center).toBe(2.0);
    });

    it('clamps center near upper boundary to prevent span extending above SWEEP_F_MAX_MHZ', () => {
      const span = 4.0;
      // half = 2.0; max center = 30.0 - 2.0 = 28.0
      const result = clampSwrView(29.5, span);
      expect(result.span).toBe(span);
      expect(result.center).toBe(28.0);
    });

    it('returns exact center and span when well within boundaries', () => {
      const result = clampSwrView(14.1, 2.0);
      expect(result.center).toBe(14.1);
      expect(result.span).toBe(2.0);
    });
  });

  describe('defaultSwrSpan', () => {
    it('calculates 20% of operating frequency as default span', () => {
      const span = defaultSwrSpan(14.0);
      // 20% of 14.0 = 2.8
      expect(span).toBeCloseTo(2.8, 5);
    });

    it('clamps default span near minimum frequency', () => {
      const span = defaultSwrSpan(1.8);
      // 20% of 1.8 = 0.36
      expect(span).toBeCloseTo(0.36, 5);
    });
  });

  describe('selectSwrWindow', () => {
    it('returns startMHz and endMHz calculated from center and clamped span', () => {
      const state = {
        swrViewCenterMHz: 14.0,
        swrViewSpanMHz: 2.0,
      };
      const window = selectSwrWindow(state);
      expect(window.startMHz).toBe(13.0);
      expect(window.endMHz).toBe(15.0);
    });
  });

  describe('recommendedTerminatingResistor', () => {
    it('returns specific resistor values for terminated types', () => {
      expect(recommendedTerminatingResistor('sloping-v')).toBe(SLOPING_V_DEFAULT_TERMINATION_OHMS);
      expect(recommendedTerminatingResistor('terminated-delta')).toBe(TERMINATED_DELTA_DEFAULT_TERMINATION_OHMS);
      expect(recommendedTerminatingResistor('folded-dipole')).toBe(FOLDED_DIPOLE_FEED_R_OHMS);
    });

    it('returns 0 for non-terminated antenna types', () => {
      const types: AntennaType[] = ['dipole', 'inverted-v', 'delta-loop', 'vertical-whip', 'inverted-l'];
      for (const t of types) {
        expect(recommendedTerminatingResistor(t)).toBe(0);
      }
    });

    it('returns 0 for unrecognized antenna types', () => {
      expect(recommendedTerminatingResistor('unknown' as AntennaType)).toBe(0);
    });
  });

  describe('computeOptimalVAngleDeg', () => {
    it('computes Kraus formula without height parameter', () => {
      const angle = computeOptimalVAngleDeg(40, 14.1);
      expect(angle).toBeGreaterThan(10);
      expect(angle).toBeLessThan(180);
    });

    it('adjusts V-angle for height when above SLOPING_V_MIN_TIP_Z_M', () => {
      const angleGround = computeOptimalVAngleDeg(40, 14.1, 0);
      const angleElevated = computeOptimalVAngleDeg(40, 14.1, 10);
      expect(angleElevated).not.toBe(angleGround);
    });

    it('handles extreme leg lengths by clamping output between 10 and 180 degrees', () => {
      expect(computeOptimalVAngleDeg(0.01, 14.1)).toBe(180);
      expect(computeOptimalVAngleDeg(1000, 28.0)).toBeGreaterThanOrEqual(10);
    });
  });

  describe('legMultipleFromLength', () => {
    it('calculates integer wavelength multiple per leg', () => {
      const lambda = 299.792458 / 14.1;
      expect(legMultipleFromLength(lambda * 2, 14.1)).toBe(1);
      expect(legMultipleFromLength(lambda * 4, 14.1)).toBe(2);
    });

    it('returns minimum of 1 for very short lengths', () => {
      expect(legMultipleFromLength(0.1, 14.1)).toBe(1);
    });
  });

  describe('calculateDefaultLength', () => {
    const freq = 14.1;
    const lambda = 299.792458 / freq;

    it('returns correct lengths per antenna type', () => {
      expect(calculateDefaultLength('dipole', freq)).toBeCloseTo(halfWaveLength(freq), 5);
      expect(calculateDefaultLength('inverted-v', freq)).toBeCloseTo(lambda * 0.5 * 0.97, 5);
      expect(calculateDefaultLength('delta-loop', freq)).toBeCloseTo(lambda, 5);
      expect(calculateDefaultLength('sloping-v', freq)).toBeCloseTo(lambda * 2, 5);
      expect(calculateDefaultLength('terminated-delta', freq)).toBeCloseTo(lambda, 5);
      expect(calculateDefaultLength('vertical-whip', freq)).toBeCloseTo(lambda * 0.25 * 0.95, 5);
      expect(calculateDefaultLength('inverted-l', freq)).toBeCloseTo(lambda * 0.25 * 0.95, 5);
      expect(calculateDefaultLength('folded-dipole', freq)).toBeCloseTo(halfWaveLength(freq), 5);
    });

    it('falls back to half wave length for unknown antenna types', () => {
      expect(calculateDefaultLength('unknown' as AntennaType, freq)).toBeCloseTo(halfWaveLength(freq), 5);
    });
  });

  describe('selectAtuConfig', () => {
    it('returns undefined when ATU is disabled', () => {
      const config = selectAtuConfig({
        atuEnabled: false,
        frequency: 14.1,
        feedlineId: 'rg58',
        feedlineLength: 10,
        atuMainFeedlineLength: 20,
      });
      expect(config).toBeUndefined();
    });

    it('returns valid AtuMatchConfig when ATU is enabled', () => {
      const config = selectAtuConfig({
        atuEnabled: true,
        frequency: 14.1,
        feedlineId: 'rg58',
        feedlineLength: 10,
        atuMainFeedlineLength: 20,
      });
      expect(config).toBeDefined();
      expect(config?.componentQ).toBe(ATU_COMPONENT_Q);
      expect(config?.mainMatchedLossDb).toBeGreaterThan(0);
    });
  });

  describe('buildWires and selectSimulationInput', () => {
    it('builds wires for supported antenna types', () => {
      const types: AntennaType[] = [
        'dipole',
        'inverted-v',
        'sloping-v',
        'delta-loop',
        'terminated-delta',
        'vertical-whip',
        'inverted-l',
        'folded-dipole',
      ];

      for (const antennaType of types) {
        const wires = buildWires({
          antennaType,
          length: 20,
          height: 10,
          orientation: 'EW',
          wireRadius: 0.001,
          segments: 21,
          frequency: 7.1,
          vAngle: 120,
          legSlope: 0,
          feedlineId: 'none',
          feedlineLength: 0,
          feedlineOffset: 0,
          whipCounterpoise: true,
          foldedDipoleAperture: 0.1,
          terminatingResistor: recommendedTerminatingResistor(antennaType),
        });

        expect(wires.length).toBeGreaterThan(0);
      }
    });

    it('builds simulation input for a full state including loads and transmission lines', () => {
      const dummyState: AntennaState = {
        antennaType: 'dipole',
        frequency: 7.1,
        designFrequency: 7.1,
        length: 20,
        height: 10,
        orientation: 'EW',
        wireRadius: 0.001,
        segments: 21,
        vAngle: 180,
        legSlope: 0,
        foldedDipoleAperture: 0.1,
        terminatingResistor: 0,
        whipCounterpoise: false,
        groundId: 'pastoral',
        groundSigma: 0.005,
        groundEpsilon: 13,
        feedlineId: 'rg58',
        feedlineLength: 10,
        feedlineOffset: 0,
        theme: 'dark',
        units: 'metric',
        mode: 'normal',
        colormap: 'viridis',
        patternScale: 1,
        dbRange: 30,
        colorMaxDb: 10,
        showGrid: true,
        showAxes: true,
        showPolarCuts: true,
        transformerEnabled: true,
        transformerRatio: 1,
        swrViewCenterMHz: 7.1,
        swrViewSpanMHz: 1.4,
        atuEnabled: false,
        atuMainFeedlineLength: 20,
        latitudeDeg: null,
        longitudeDeg: null,
        monthOverride: null,
        utcHourOverride: null,
        geolocationStatus: 'idle',
        result: null,
        feedpointImpedance: null,
        sweep: [],
        error: null,
        loading: false,
        engineReady: true,
        comparisonReference: null,

        setAntennaType: () => {},
        setFrequency: () => {},
        setLength: () => {},
        setHalfWaveLength: () => {},
        setLegLengthMultiple: () => {},
        setHeight: () => {},
        setOrientation: () => {},
        setVAngle: () => {},
        setLegSlope: () => {},
        setFoldedDipoleAperture: () => {},
        setTerminatingResistor: () => {},
        setWhipCounterpoise: () => {},
        setWireRadius: () => {},
        setSegments: () => {},
        setGround: () => {},
        setCustomGround: () => {},
        setFeedline: () => {},
        setFeedlineLength: () => {},
        setFeedlineOffset: () => {},
        setTheme: () => {},
        toggleTheme: () => {},
        setUnits: () => {},
        toggleUnits: () => {},
        setMode: () => {},
        toggleMode: () => {},
        setColormap: () => {},
        setPatternScale: () => {},
        setDbRange: () => {},
        setColorMaxDb: () => {},
        setShowGrid: () => {},
        setShowAxes: () => {},
        setShowPolarCuts: () => {},
        setTransformerEnabled: () => {},
        setTransformerRatio: () => {},
        zoomSwrView: () => {},
        panSwrView: () => {},
        panSwrViewByMHz: () => {},
        resetSwrView: () => {},
        setAtuEnabled: () => {},
        setAtuMainFeedlineLength: () => {},
        captureComparisonReference: () => {},
        clearComparisonReference: () => {},
        setLatitude: () => {},
        setLongitude: () => {},
        setMonthOverride: () => {},
        setUtcHourOverride: () => {},
        setGeolocationStatus: () => {},
        _setSimulationData: () => {},
        _setSweep: () => {},
        _setError: () => {},
        _setLoading: () => {},
        _setEngineReady: () => {},
      };

      const simInput = selectSimulationInput(dummyState);
      expect(simInput.frequencyMHz).toBe(7.1);
      expect(simInput.wires.length).toBeGreaterThan(0);
      expect(simInput.ground.type).toBe('real');
      expect(simInput.transmissionLines).toHaveLength(1);
      expect(simInput.loads).toHaveLength(1);
    });
  });
});
