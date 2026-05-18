import { describe, expect, it } from 'vitest';
import {
  useAntennaStore,
  buildWires,
  selectSimulationInput,
  computeEffectiveSlope,
  DIPOLE_LEFT_TAG,
  DIPOLE_RIGHT_TAG,
  DELTA_BASE_TAG,
  type AntennaState,
} from '../src/store/antennaStore';
import { FEED_BRIDGE_TAG } from '../src/physics/constants';

describe('antennaStore selectors', () => {
  describe('buildWires', () => {
    it('generates a single wire when no feedline is configured (EW)', () => {
      // Arrange
      const state = {
        antennaType: 'dipole' as const,
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        frequency: 7.1,
        vAngle: 180,
        legSlope: 0,
        feedlineId: 'none',
        feedlineLength: 0,
        feedlineOffset: 0,
      };

      // Act
      const wires = buildWires(state);

      // Assert
      expect(wires).toHaveLength(1);
      // EW is 90 deg -> [1, 0]
      expect(wires[0].start[0]).toBeCloseTo(-10, 5);
      expect(wires[0].start[1]).toBeCloseTo(0, 5);
      expect(wires[0].end[0]).toBeCloseTo(10, 5);
      expect(wires[0].end[1]).toBeCloseTo(0, 5);
      expect(wires[0].radius).toBe(0.001);
      expect(wires[0].segments).toBe(21);
    });

    it('generates correct wire coordinates for NS orientation (no feedline)', () => {
      const state = {
        antennaType: 'dipole' as const,
        length: 20,
        height: 15,
        orientation: 'NS' as const,
        wireRadius: 0.002,
        segments: 11,
        frequency: 7.1,
        vAngle: 180,
        legSlope: 0,
        feedlineId: 'none',
        feedlineLength: 0,
        feedlineOffset: 0,
      };
      const wires = buildWires(state);
      expect(wires).toHaveLength(1);
      // NS is 0 deg -> [0, 1]
      expect(wires[0].start[0]).toBeCloseTo(0, 5);
      expect(wires[0].start[1]).toBeCloseTo(-10, 5);
      expect(wires[0].end[0]).toBeCloseTo(0, 5);
      expect(wires[0].end[1]).toBeCloseTo(10, 5);
    });

    it('generates correct wire coordinates for numeric orientation (45 deg)', () => {
      const state = {
        antennaType: 'dipole' as const,
        length: 10,
        height: 5,
        orientation: 45,
        wireRadius: 0.001,
        segments: 11,
        frequency: 7.1,
        vAngle: 180,
        legSlope: 0,
        feedlineId: 'none',
        feedlineLength: 0,
        feedlineOffset: 0,
      };
      const wires = buildWires(state);
      expect(wires).toHaveLength(1);
      const half = 5;
      // 45 deg radio -> unit circle 45 deg [cos45, sin45]
      const cos45 = Math.SQRT1_2;
      const sin45 = Math.SQRT1_2;
      expect(wires[0].start[0]).toBeCloseTo(-half * cos45, 5);
      expect(wires[0].start[1]).toBeCloseTo(-half * sin45, 5);
      expect(wires[0].end[0]).toBeCloseTo(half * cos45, 5);
      expect(wires[0].end[1]).toBeCloseTo(half * sin45, 5);
    });

    it('builds split-dipole + bridge + shield when feedline is configured', () => {
      const wires = buildWires({
        antennaType: 'dipole' as const,
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        frequency: 7.1,
        vAngle: 180,
        legSlope: 0,
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 0,
      });

      // Expect 4 wires: left half, right half, source bridge, shield.
      expect(wires).toHaveLength(4);
      const tags = wires.map((w) => w.tag).sort();
      expect(tags).toEqual([1, 2, 3, 4]);

      const bridge = wires.find((w) => w.tag === 3)!;
      expect(bridge.segments).toBe(1);

      const left = wires.find((w) => w.tag === 1)!;
      const right = wires.find((w) => w.tag === 2)!;
      // The two halves should meet at the bridge endpoints.
      expect(left.end).toEqual(bridge.start);
      expect(right.start).toEqual(bridge.end);
    });

    it('shifts the source bridge along the dipole axis when offset is nonzero', () => {
      const wires = buildWires({
        antennaType: 'dipole' as const,
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        frequency: 7.1,
        vAngle: 180,
        legSlope: 0,
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 2, // 2 m east of centre
      });

      const bridge = wires.find((w) => w.tag === 3)!;
      // Bridge midpoint x ≈ 2.
      const midX = (bridge.start[0] + bridge.end[0]) / 2;
      expect(midX).toBeCloseTo(2, 5);

      const left = wires.find((w) => w.tag === 1)!;
      const right = wires.find((w) => w.tag === 2)!;
      // Left half is now longer than the right half.
      const leftLen = Math.abs(left.end[0] - left.start[0]);
      const rightLen = Math.abs(right.end[0] - right.start[0]);
      expect(leftLen).toBeGreaterThan(rightLen);
    });

    it('clamps offset so the bridge cannot escape the dipole', () => {
      const wires = buildWires({
        antennaType: 'dipole' as const,
        length: 4,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        frequency: 7.1,
        vAngle: 180,
        legSlope: 0,
        feedlineId: 'rg58',
        feedlineLength: 5,
        feedlineOffset: 999, // absurdly large
      });
      const bridge = wires.find((w) => w.tag === 3)!;
      // The bridge midpoint must remain inside [-length/2, +length/2].
      const midX = (bridge.start[0] + bridge.end[0]) / 2;
      expect(midX).toBeLessThanOrEqual(2);
      expect(midX).toBeGreaterThanOrEqual(-2);
    });
  });

  describe('ground logic (via selectSimulationInput)', () => {
    it('returns free space ground when height is <= 0', () => {
      // Arrange
      const state = useAntennaStore.getState();

      // Act
      const input = selectSimulationInput({ ...state, height: 0 });

      // Assert
      expect(input.ground.type).toBe('free');
    });

    it('returns perfect ground when groundId is perfect', () => {
      const state = useAntennaStore.getState();
      const input = selectSimulationInput({ ...state, height: 10, groundId: 'perfect' });
      expect(input.ground.type).toBe('perfect');
    });

    it('returns real ground with sigma and epsilon when groundId is custom', () => {
      const state = useAntennaStore.getState();
      const input = selectSimulationInput({ ...state, height: 10, groundId: 'custom', groundSigma: 0.005, groundEpsilon: 13 });
      expect(input.ground.type).toBe('real');
      if (input.ground.type === 'real') {
        expect(input.ground.sigma).toBe(0.005);
        expect(input.ground.epsilon).toBe(13);
      }
    });
  });

  describe('selectSimulationInput', () => {
    it('combines state into simulation input correctly (no feedline)', () => {
      // Arrange
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        frequency: 14.1,
        length: 10,
        height: 5,
        orientation: 'EW' as const,
        segments: 11,
        antennaType: 'dipole' as const,
        feedlineId: 'none',
        feedlineLength: 0,
      };

      // Act
      const input = selectSimulationInput(testState);

      // Assert
      expect(input.frequencyMHz).toBe(14.1);
      expect(input.wires).toHaveLength(1);
      expect(input.wires[0].segments).toBe(11);
      expect(input.excitation.wireTag).toBe(1);
      expect(input.excitation.segment).toBe(6); // Math.ceil(11 / 2)
      expect(input.patternResolution.thetaSteps).toBe(37);
      expect(input.patternResolution.phiSteps).toBe(72);
      expect(input.transmissionLines).toBeUndefined();
      expect(input.loads).toBeUndefined();
    });

    it('builds split-dipole topology with TL card when a feedline is configured', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        frequency: 14.1,
        height: 10,
        segments: 21,
        antennaType: 'dipole' as const,
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 0,
        balunEnabled: false,
      };

      const input = selectSimulationInput(testState);

      // Four wires: left dipole (1), right dipole (2), source bridge (3),
      // coax shield (4).
      expect(input.wires).toHaveLength(4);
      const tags = input.wires.map((w) => w.tag).sort();
      expect(tags).toEqual([1, 2, 3, 4]);
      const shield = input.wires.find((w) => w.tag === 4)!;
      expect(shield.start[2]).toBe(10);
      expect(shield.end[2]).toBeCloseTo(2, 5);
      // EX moves to bottom of shield (the rig).
      expect(input.excitation.wireTag).toBe(4);
      // TL card connects source bridge to rig segment.
      expect(input.transmissionLines).toHaveLength(1);
      const tl = input.transmissionLines![0];
      expect(tl.fromTag).toBe(3); // source bridge
      expect(tl.toTag).toBe(4);   // shield
      expect(tl.z0).toBe(50);
      // Electrical length = physical / VF (RG-58 VF = 0.66).
      expect(tl.lengthM).toBeCloseTo(8 / 0.66, 5);
      // No balun => no load card.
      expect(input.loads).toBeUndefined();
    });

    it('shield is attached to one side of the bridge (asymmetric feed)', () => {
      const state = useAntennaStore.getState();
      const input = selectSimulationInput({
        ...state,
        height: 10,
        antennaType: 'dipole',
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 1.5,
      });
      const right = input.wires.find((w) => w.tag === 2)!;
      const shield = input.wires.find((w) => w.tag === 4)!;
      // The shield's top vertex must coincide with the right half's start.
      expect(shield.start).toEqual(right.start);
    });

    it('generates sloping-V geometry correctly', () => {
      const state = {
        antennaType: 'sloping-v' as const,
        length: 80, // ~2 lambda
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        frequency: 7.1,
        vAngle: 90,
        legSlope: 30,
        feedlineId: 'none',
      };

      const wires = buildWires(state);
      expect(wires).toHaveLength(3); // Two legs + feed bridge

      // Left leg: Tip to ApexBridge connection
      const left = wires.find((w) => w.tag === 1)!;
      // Right leg: ApexBridge connection to Tip
      const right = wires.find((w) => w.tag === 2)!;
      // Bridge
      const bridge = wires.find((w) => w.tag === 3)!;

      expect(left.end).toEqual(bridge.start);
      expect(right.start).toEqual(bridge.end);

      // Bridge is horizontal at apex height
      expect(bridge.start[2]).toBe(10);
      expect(bridge.end[2]).toBe(10);

      // legLen = (80 - 0.1) / 2 = 39.95
      // Max drop = 10 - 0.5 = 9.5.
      // maxSin = 9.5 / 39.95 ≈ 0.237.
      // maxSlope = asin(0.237) ≈ 13.7 deg.
      // 30 deg > 13.7 deg, so it should be clamped to 0.5m tip height.
      expect(left.start[2]).toBeCloseTo(0.5, 5);
      expect(right.end[2]).toBeCloseTo(0.5, 5);
    });

    it('clamps sloping-V slope to prevent tips hitting ground', () => {
      const state = {
        antennaType: 'sloping-v' as const,
        length: 100, // half = 50
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        frequency: 7.1,
        vAngle: 180,
        legSlope: 45, // requested 45 deg
        feedlineId: 'none',
      };

      const wires = buildWires(state);
      // maxSin = (10 - 0.5) / 50 = 9.5 / 50 = 0.19
      // maxSlope = asin(0.19) ≈ 10.95 deg
      // tip_z should be 0.5
      expect(wires.find((w) => w.tag === 1)!.start[2]).toBeCloseTo(0.5, 5);
      expect(wires.find((w) => w.tag === 2)!.end[2]).toBeCloseTo(0.5, 5);
    });

    it('adds an LD choke balun on the shield when balun is enabled', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        height: 10,
        antennaType: 'dipole' as const,
        feedlineId: 'rg213',
        feedlineLength: 6,
        feedlineOffset: 0,
        balunEnabled: true,
      };

      const input = selectSimulationInput(testState);

      expect(input.loads).toHaveLength(1);
      const ld = input.loads![0];
      expect(ld.type).toBe(4); // impedance load
      expect(ld.wireTag).toBe(4); // shield wire (FEEDLINE_SHIELD_TAG)
      expect(ld.segmentStart).toBe(1); // top of shield (near feedpoint)
      expect(ld.segmentEnd).toBe(1);
      expect(ld.param1).toBeGreaterThan(500); // ~kΩ choke
      expect(ld.param2).toBe(0);
    });

    it('does NOT include feedline logic for non-dipoles even if state is somehow set', () => {
      const state = useAntennaStore.getState();
      const input = selectSimulationInput({
        ...state,
        antennaType: 'sloping-v',
        feedlineId: 'rg58',
        feedlineLength: 10,
      });

      // Even if feedline state is present, selectSimulationInput should
      // ignore it for non-dipoles.
      expect(input.wires.some(w => w.tag === 4)).toBe(false);
      expect(input.transmissionLines).toBeUndefined();
    });

    it('clamps shield bottom above ground when feedline length exceeds height', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        antennaType: 'dipole' as const,
        height: 5,
        feedlineId: 'rg213',
        feedlineLength: 30, // would push bottom into the ground
      };

      const input = selectSimulationInput(testState);

      const shield = input.wires.find((w) => w.tag === 4)!;
      expect(shield).toBeDefined();
      // Bottom must be safely above z=0.
      expect(shield.end[2]).toBeGreaterThan(0);
      // Top stays at the feedpoint height.
      expect(shield.start[2]).toBe(5);
    });
  });
});

describe('antennaStore actions', () => {
  describe('topology and defaults', () => {
    it('sets initial defaults correctly per spec', () => {
      const s = useAntennaStore.getState();
      expect(s.antennaType).toBe('dipole');
      expect(s.vAngle).toBe(180);
      expect(s.legSlope).toBe(0);
    });

    it('setAntennaType(non-dipole) clears feedline state for unsupported types', () => {
      const store = useAntennaStore.getState();
      store.setFeedline('rg58');
      store.setFeedlineLength(10);
      store.setFeedlineOffset(1);

      // Sloping-v does NOT support feedlines per spec.
      store.setAntennaType('sloping-v');
      const s = useAntennaStore.getState();
      expect(s.antennaType).toBe('sloping-v');
      expect(s.feedlineId).toBe('none');
      expect(s.feedlineLength).toBe(0);
      expect(s.feedlineOffset).toBe(0);
    });

    it('setAntennaType sets correct default lengths and angles for each type', () => {
      const store = useAntennaStore.getState();
      const freq = 7.1;
      const lambda = 299.792458 / freq;
      store.setFrequency(freq);

      store.setAntennaType('dipole');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 0.5 * 0.95, 3);
      expect(useAntennaStore.getState().vAngle).toBe(180);
      expect(useAntennaStore.getState().legSlope).toBe(0);

      store.setAntennaType('inverted-v');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 0.5 * 0.97, 3);
      expect(useAntennaStore.getState().vAngle).toBe(120);
      expect(useAntennaStore.getState().legSlope).toBe(0);

      store.setAntennaType('delta-loop');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda, 3);

      store.setAntennaType('sloping-v');
      // Default is 2λ total (1λ per leg) — minimum for end-fire travelling-wave behaviour.
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 2, 3);
      // V-angle from physics formula: cosV = (1 − 0.371λ/L) / cos(slope).
      // At h=10m, 7.1 MHz, 2λ total: slope≈13°, cosSlope≈0.974 → V≈99.6°.
      expect(useAntennaStore.getState().vAngle).toBeCloseTo(99.65, 1);
      // legSlope is unused for sloping-V (slope is auto-computed); reset to 0.
      expect(useAntennaStore.getState().legSlope).toBe(0);

      store.setAntennaType('v-beam');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 2, 3);
    });

    it('setAntennaType("sloping-v") sets default terminatingResistor=300 when currently 0', () => {
      const store = useAntennaStore.getState();
      store.setTerminatingResistor(0);
      store.setAntennaType('sloping-v');
      expect(useAntennaStore.getState().terminatingResistor).toBe(300);
    });

    it('setAntennaType("sloping-v") preserves a pre-set non-zero terminatingResistor', () => {
      const store = useAntennaStore.getState();
      store.setTerminatingResistor(400);
      store.setAntennaType('sloping-v');
      expect(useAntennaStore.getState().terminatingResistor).toBe(400);
    });

    it('setHalfWaveLength is topology-aware', () => {
      const store = useAntennaStore.getState();
      const freq = 14.1;
      const lambda = 299.792458 / freq;
      store.setFrequency(freq);

      store.setAntennaType('delta-loop');
      store.setLength(5); // manual override
      store.setHalfWaveLength();
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda, 3);

      store.setAntennaType('sloping-v');
      store.setLength(5);
      store.setHalfWaveLength();
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 2, 3);
    });

    it('clamps vAngle to [10, 180]', () => {
      const store = useAntennaStore.getState();
      store.setVAngle(5);
      expect(useAntennaStore.getState().vAngle).toBe(10);
      store.setVAngle(200);
      expect(useAntennaStore.getState().vAngle).toBe(180);
      store.setVAngle(45);
      expect(useAntennaStore.getState().vAngle).toBe(45);
    });

    it('clamps legSlope to [0, 90]', () => {
      const store = useAntennaStore.getState();
      store.setLegSlope(-10);
      expect(useAntennaStore.getState().legSlope).toBe(0);
      store.setLegSlope(100);
      expect(useAntennaStore.getState().legSlope).toBe(90);
      store.setLegSlope(25);
      expect(useAntennaStore.getState().legSlope).toBe(25);
    });
  });

  it('updates orientation and normalizes correctly', () => {
    const store = useAntennaStore.getState();

    store.setOrientation(370);
    expect(useAntennaStore.getState().orientation).toBe(10);

    store.setOrientation(-10);
    expect(useAntennaStore.getState().orientation).toBe(350);

    store.setOrientation('NS');
    expect(useAntennaStore.getState().orientation).toBe('NS');
  });

  it('updates frequency and clamps correctly', () => {
    // Arrange
    const store = useAntennaStore.getState();

    // Act
    store.setFrequency(40); // Max is 30

    // Assert
    expect(useAntennaStore.getState().frequency).toBe(30);

    // Act
    store.setFrequency(1); // Min is 1.8

    // Assert
    expect(useAntennaStore.getState().frequency).toBe(1.8);

    // Act
    store.setFrequency(14.1);

    // Assert
    expect(useAntennaStore.getState().frequency).toBe(14.1);
  });

  describe('feedline', () => {
    it('clears feedline state when switching from dipole to non-dipole', () => {
      const store = useAntennaStore.getState();
      store.setAntennaType('dipole');
      store.setFeedline('rg58');
      store.setFeedlineLength(15);
      store.setFeedlineOffset(2);
      store.setBalunEnabled(true);

      expect(useAntennaStore.getState().feedlineId).toBe('rg58');

      // Act
      store.setAntennaType('sloping-v');

      // Assert
      const s = useAntennaStore.getState();
      expect(s.antennaType).toBe('sloping-v');
      expect(s.feedlineId).toBe('none');
      expect(s.feedlineLength).toBe(0);
      expect(s.feedlineOffset).toBe(0);
      expect(s.balunEnabled).toBe(false);
    });

    it('updates feedline preset id', () => {
      const store = useAntennaStore.getState();
      store.setFeedline('rg213');
      expect(useAntennaStore.getState().feedlineId).toBe('rg213');
      store.setFeedline('none');
      expect(useAntennaStore.getState().feedlineId).toBe('none');
    });

    it('throws on unknown feedline id', () => {
      const store = useAntennaStore.getState();
      expect(() => store.setFeedline('not-a-real-cable')).toThrow();
    });

    it('clamps feedline length to a reasonable range', () => {
      const store = useAntennaStore.getState();
      store.setFeedlineLength(-5);
      expect(useAntennaStore.getState().feedlineLength).toBe(0);
      store.setFeedlineLength(500);
      expect(useAntennaStore.getState().feedlineLength).toBe(200);
      store.setFeedlineLength(15);
      expect(useAntennaStore.getState().feedlineLength).toBe(15);
    });

    it('toggles balun enabled flag', () => {
      const store = useAntennaStore.getState();
      store.setBalunEnabled(true);
      expect(useAntennaStore.getState().balunEnabled).toBe(true);
      store.setBalunEnabled(false);
      expect(useAntennaStore.getState().balunEnabled).toBe(false);
    });

    it('clamps feedline offset to ±length/2', () => {
      const store = useAntennaStore.getState();
      store.setLength(10); // half = 5
      store.setFeedlineOffset(50);
      expect(useAntennaStore.getState().feedlineOffset).toBeLessThanOrEqual(5);
      store.setFeedlineOffset(-50);
      expect(useAntennaStore.getState().feedlineOffset).toBeGreaterThanOrEqual(-5);
      store.setFeedlineOffset(2);
      expect(useAntennaStore.getState().feedlineOffset).toBe(2);
    });

    it('re-clamps offset when the dipole length is shortened', () => {
      const store = useAntennaStore.getState();
      store.setLength(10);
      store.setFeedlineOffset(4);
      expect(useAntennaStore.getState().feedlineOffset).toBe(4);
      // Shorten the dipole; the +4m offset is no longer valid.
      store.setLength(4);
      const offsetAfter = useAntennaStore.getState().feedlineOffset;
      // New limit is 4/2 - 0.1 = 1.9.
      expect(offsetAfter).toBeLessThanOrEqual(1.9);
    });
  });

  describe('propagation', () => {
    it('clamps T-index to the practical range', () => {
      const store = useAntennaStore.getState();
      store.setTIndex(99999);
      expect(useAntennaStore.getState().tIndex).toBe(250);
      store.setTIndex(-99999);
      expect(useAntennaStore.getState().tIndex).toBe(-100);
      store.setTIndex(75);
      expect(useAntennaStore.getState().tIndex).toBe(75);
    });

    it('accepts and clears latitude', () => {
      const store = useAntennaStore.getState();
      store.setLatitude(51.5);
      expect(useAntennaStore.getState().latitudeDeg).toBe(51.5);
      store.setLatitude(null);
      expect(useAntennaStore.getState().latitudeDeg).toBeNull();
    });

    it('clamps latitude to ±90', () => {
      const store = useAntennaStore.getState();
      store.setLatitude(120);
      expect(useAntennaStore.getState().latitudeDeg).toBe(90);
      store.setLatitude(-120);
      expect(useAntennaStore.getState().latitudeDeg).toBe(-90);
    });

    it('wraps longitude into ±180', () => {
      const store = useAntennaStore.getState();
      store.setLongitude(200);
      expect(useAntennaStore.getState().longitudeDeg).toBeCloseTo(-160, 5);
      store.setLongitude(-200);
      expect(useAntennaStore.getState().longitudeDeg).toBeCloseTo(160, 5);
    });

    it('clamps month override and accepts null', () => {
      const store = useAntennaStore.getState();
      store.setMonthOverride(15);
      expect(useAntennaStore.getState().monthOverride).toBe(12);
      store.setMonthOverride(0);
      expect(useAntennaStore.getState().monthOverride).toBe(1);
      store.setMonthOverride(null);
      expect(useAntennaStore.getState().monthOverride).toBeNull();
    });

    it('clamps UTC hour override and accepts null', () => {
      const store = useAntennaStore.getState();
      store.setUtcHourOverride(50);
      expect(useAntennaStore.getState().utcHourOverride).toBe(23.99);
      store.setUtcHourOverride(-5);
      expect(useAntennaStore.getState().utcHourOverride).toBe(0);
      store.setUtcHourOverride(null);
      expect(useAntennaStore.getState().utcHourOverride).toBeNull();
    });

    it('updates geolocation status', () => {
      const store = useAntennaStore.getState();
      store.setGeolocationStatus('requesting');
      expect(useAntennaStore.getState().geolocationStatus).toBe('requesting');
      store.setGeolocationStatus('denied');
      expect(useAntennaStore.getState().geolocationStatus).toBe('denied');
    });
  });

  describe('Sloping V Geometry', () => {
    it('performs the hand-check at 7.1 MHz, height 10m, slope 45 deg', () => {
      // λ = 299.792458 / 7.1 = 42.2243m.
      // Sloping V ref length = λ * 2 * 0.95 = 80.2262m.
      const length = 80.22615;
      const state = {
        antennaType: 'sloping-v' as const,
        length,
        height: 10,
        legSlope: 45,
      };

      const result = computeEffectiveSlope(state);

      // maxSin = (10 - 0.5) / (80.226 / 2) = 9.5 / 40.113 ≈ 0.23683
      // maxSlope = asin(0.23683) ≈ 13.701 deg
      expect(result.clamped).toBe(true);
      expect(result.effectiveDeg).toBeCloseTo(13.701, 2);
      expect(result.tipHeightM).toBeCloseTo(0.5, 5);
    });

    it('reports clamped=false when slope is shallow', () => {
      const state = {
        antennaType: 'sloping-v' as const,
        length: 20,
        height: 10,
        legSlope: 10,
      };
      const result = computeEffectiveSlope(state);
      expect(result.clamped).toBe(false);
      expect(result.effectiveDeg).toBe(10);
    });

    it('sets excitation on the apex bridge for sloping-v', () => {
      const state = {
        ...useAntennaStore.getState(),
        antennaType: 'sloping-v' as const,
        length: 80,
        height: 10,
        legSlope: 15,
        vAngle: 90,
        terminatingResistor: 0, // no stubs; test focuses on excitation placement
      };
      const input = selectSimulationInput(state as AntennaState);
      expect(input.wires).toHaveLength(3);

      expect(input.excitation.wireTag).toBe(3); // FEED_BRIDGE_TAG
      expect(input.excitation.segment).toBe(1);
    });
  });

  describe('V-Beam Geometry', () => {
    // λ at 7.1 MHz ≈ 42.224 m; default v-beam length = 2λ ≈ 84.448 m
    const lambda = 299.792458 / 7.1;
    const commonState = {
      antennaType: 'v-beam' as const,
      length: lambda * 2,
      height: 10,
      orientation: 'EW' as const,
      wireRadius: 0.001,
      segments: 21,
      frequency: 7.1,
      vAngle: 60,
      legSlope: 0,
      terminatingResistor: 0,
    };

    it('generates exactly 3 GW wires (2 legs + 1 bridge, no termination)', () => {
      const wires = buildWires(commonState);
      expect(wires).toHaveLength(3);
    });

    it('both leg endpoints are at z=height (horizontal legs, no z=0)', () => {
      const wires = buildWires(commonState);
      for (const wire of wires) {
        expect(wire.start[2]).toBeCloseTo(commonState.height);
        expect(wire.end[2]).toBeCloseTo(commonState.height);
        expect(wire.start[2]).not.toBeCloseTo(0);
        expect(wire.end[2]).not.toBeCloseTo(0);
      }
    });

    it('apex is bridged across (0, 0, height)', () => {
      const wires = buildWires(commonState);
      const left = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      const right = wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
      const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;

      expect(bridge.start[2]).toBeCloseTo(commonState.height);
      expect(bridge.end[2]).toBeCloseTo(commonState.height);
      expect(left.end).toEqual(bridge.start);
      expect(right.start).toEqual(bridge.end);
    });

    it('each leg length roughly equals half the total antenna length minus bridge', () => {
      const wires = buildWires(commonState);
      const left = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      const right = wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;

      const dist = (a: [number, number, number], b: [number, number, number]) =>
        Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

      // We expect the leg to be length / 2, minus a small bridge part, but roughly half.
      expect(dist(left.start, left.end)).toBeCloseTo(commonState.length / 2, 0);
      expect(dist(right.start, right.end)).toBeCloseTo(commonState.length / 2, 0);
    });

    it('excitation is on the apex bridge', () => {
      const state = { ...useAntennaStore.getState(), ...commonState };
      const input = selectSimulationInput(state as AntennaState);

      expect(input.excitation.wireTag).toBe(FEED_BRIDGE_TAG);
      expect(input.excitation.segment).toBe(1);
    });

    it('has no transmission lines or loads', () => {
      const state = { ...useAntennaStore.getState(), ...commonState };
      const input = selectSimulationInput(state as AntennaState);
      expect(input.transmissionLines).toBeUndefined();
      expect(input.loads).toBeUndefined();
    });

    it('uses at least SEGS_PER_WAVELENGTH segments per leg', () => {
      const wires = buildWires(commonState);
      // For 1λ leg at 7.1 MHz, minSegs = ceil(20 * λ / λ) = 20.
      expect(wires[0].segments).toBeGreaterThanOrEqual(20);
      expect(wires[1].segments).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Inverted V Geometry', () => {
    const commonState = {
      length: 20,
      height: 10,
      orientation: 'EW' as const,
      wireRadius: 0.001,
      segments: 21,
      frequency: 7.1,
      vAngle: 120,
      legSlope: 0,
    };

    it('places the apex at the specified height', () => {
      const wires = buildWires({ ...commonState, antennaType: 'inverted-v' });
      const bridge = wires.find(w => w.tag === 3)!;
      expect(bridge.start[2]).toBeCloseTo(10);
      expect(bridge.end[2]).toBeCloseTo(10);
    });

    it('calculates leg endpoints correctly based on vAngle', () => {
      // Total length 20m. Bridge 0.1m. Each leg = (20 - 0.1) / 2 = 9.95m.
      // For 120 deg apex, drop angle is 30 deg.
      // Drop = 9.95 * sin(30) = 4.975m.
      // Tip Z = 10 - 4.975 = 5.025m.
      const wires = buildWires({ ...commonState, antennaType: 'inverted-v', vAngle: 120 });
      const leftWire = wires.find(w => w.tag === DIPOLE_LEFT_TAG)!;
      expect(leftWire.start[2]).toBeCloseTo(5.025);
    });

    it('clamps tip height to SLOPING_V_MIN_TIP_Z_M (0.5m)', () => {
      // Length 20m (9.975m per leg), Height 2m.
      // 60 deg drop (vAngle 60) would drop 9.975 * sin(60) = 8.638m.
      // 2 - 8.638 = -6.638m (underground).
      // Max drop allowed = 2 - 0.5 = 1.5m.
      const wires = buildWires({ ...commonState, antennaType: 'inverted-v', height: 2, vAngle: 60 });
      const leftWire = wires.find(w => w.tag === DIPOLE_LEFT_TAG)!;
      expect(leftWire.start[2]).toBeGreaterThanOrEqual(0.49);
      expect(leftWire.start[2]).toBeLessThanOrEqual(0.51);
    });

    it('places excitation on the apex bridge', () => {
      const state = { ...useAntennaStore.getState(), ...commonState, antennaType: 'inverted-v' };
      const input = selectSimulationInput(state as AntennaState);
      expect(input.excitation.wireTag).toBe(3);
      expect(input.excitation.segment).toBe(1);
    });

    it('uses at least 20 segments per wavelength on each leg', () => {
      const lambda = 299.792458 / 7.1;
      const state = { ...commonState, antennaType: 'inverted-v', frequency: 7.1, length: lambda / 2, segments: 10 };
      const wires = buildWires(state as Parameters<typeof buildWires>[0]);

      const expected = Math.max(9, Math.ceil(20 * (state.length / 2) / lambda));
      expect(wires[0].segments).toBeGreaterThanOrEqual(expected);

      // Try a longer wire: 2 lambda per leg.
      // Expected segments = ceil(20 * 2) = 40.
      const longState = { ...commonState, antennaType: 'inverted-v', frequency: 7.1, length: lambda * 4, segments: 10 };
      const longWires = buildWires(longState as Parameters<typeof buildWires>[0]);
      expect(longWires[0].segments).toBeGreaterThanOrEqual(40);
    });

    it('emits no transmission lines or loads for Inverted V', () => {
      const state = { ...useAntennaStore.getState(), ...commonState, antennaType: 'inverted-v' };
      const input = selectSimulationInput(state as AntennaState);
      expect(input.transmissionLines).toBeUndefined();
      expect(input.loads).toBeUndefined();
    });
  });

  describe('Delta Loop Geometry', () => {
    // λ at 7.1 MHz ≈ 42.224 m; default delta loop perimeter = 1λ
    const lambda = 299.792458 / 7.1;

    const baseState = {
      antennaType: 'delta-loop' as const,
      length: lambda,         // perimeter = 1λ
      height: 15,
      orientation: 'EW' as const,
      wireRadius: 0.001,
      segments: 21,
      frequency: 7.1,
      vAngle: 180,
      legSlope: 0,
      terminatingResistor: 0,
    };

    it('produces exactly 3 wires with distinct tags', () => {
      const wires = buildWires(baseState);
      expect(wires).toHaveLength(3);
      const tags = wires.map((w) => w.tag).sort((a, b) => a - b);
      expect(tags).toEqual([DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG, DELTA_BASE_TAG]);
    });

    it('apex is at full mast height on all leg endpoints', () => {
      const wires = buildWires(baseState);
      const leftLeg = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      const rightLeg = wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
      // Left leg: start = leftCorner, end = apex
      expect(leftLeg.end[2]).toBeCloseTo(baseState.height);
      // Right leg: start = apex, end = rightCorner
      expect(rightLeg.start[2]).toBeCloseTo(baseState.height);
      // Apex coordinates agree between the two legs
      expect(leftLeg.end[0]).toBeCloseTo(rightLeg.start[0]);
      expect(leftLeg.end[1]).toBeCloseTo(rightLeg.start[1]);
      expect(leftLeg.end[2]).toBeCloseTo(rightLeg.start[2]);
    });

    it('equilateral triangle when mast height allows it (7.1 MHz, 15 m)', () => {
      // P = λ ≈ 42.224 m. Equilateral height = P * sqrt(3) / 6 ≈ 12.18 m.
      // 15 m - 0.5 m = 14.5 m available, so equilateral fits.
      const wires = buildWires(baseState);
      const equilateralHeight = (lambda * Math.sqrt(3)) / 6;
      const sideLen = lambda / 3;

      const leftLeg = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      const base = wires.find((w) => w.tag === DELTA_BASE_TAG)!;

      // Base width = side length (equilateral)
      const baseWidth = Math.sqrt(
        (base.start[0] - base.end[0]) ** 2 + (base.start[1] - base.end[1]) ** 2,
      );
      expect(baseWidth).toBeCloseTo(sideLen, 2);

      // Triangle height: apex z - base z
      const triHeight = leftLeg.end[2] - leftLeg.start[2];
      expect(triHeight).toBeCloseTo(equilateralHeight, 2);
    });

    it('preserves full perimeter when height forces isosceles shape', () => {
      // Mast height 5 m: equilateral height ≈ 12.18 m, but available is 4.5 m.
      const shortState = { ...baseState, height: 5 };
      const wires = buildWires(shortState);

      const leftLeg = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      const rightLeg = wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
      const base = wires.find((w) => w.tag === DELTA_BASE_TAG)!;

      const dist3d = (
        a: readonly [number, number, number],
        b: readonly [number, number, number],
      ) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

      const leftLen = dist3d(leftLeg.start, leftLeg.end);
      const rightLen = dist3d(rightLeg.start, rightLeg.end);
      const baseLen = dist3d(base.start, base.end);
      const actualPerimeter = leftLen + rightLen + baseLen;

      expect(actualPerimeter).toBeCloseTo(lambda, 1);
    });

    it('base corners stay above minimum height (SLOPING_V_MIN_TIP_Z_M = 0.5 m)', () => {
      // Very short mast — base must not go below 0.5 m.
      const shortState = { ...baseState, height: 2 };
      const wires = buildWires(shortState);
      const base = wires.find((w) => w.tag === DELTA_BASE_TAG)!;
      expect(base.start[2]).toBeGreaterThanOrEqual(0.49);
      expect(base.end[2]).toBeGreaterThanOrEqual(0.49);
    });

    it('excitation lands on the left leg at its last (apex) segment', () => {
      const state = { ...useAntennaStore.getState(), ...baseState };
      const input = selectSimulationInput(state as AntennaState);

      const leftLeg = input.wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      expect(input.excitation.wireTag).toBe(DIPOLE_LEFT_TAG);
      expect(input.excitation.segment).toBe(leftLeg.segments);
    });

    it('emits no transmission lines or loads', () => {
      const state = { ...useAntennaStore.getState(), ...baseState };
      const input = selectSimulationInput(state as AntennaState);
      expect(input.transmissionLines).toBeUndefined();
      expect(input.loads).toBeUndefined();
    });
  });
});
