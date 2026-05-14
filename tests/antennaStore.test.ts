import { describe, expect, it } from 'vitest';
import { useAntennaStore, buildWires, selectSimulationInput, DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG, DIPOLE_TAG, FEED_BRIDGE_TAG, FEEDLINE_SHIELD_TAG } from '../src/store/antennaStore';

describe('antennaStore selectors', () => {
  describe('buildWires', () => {
    it('generates a single wire when no feedline is configured (EW)', () => {
      // Arrange
      const state = {
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
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
        length: 20,
        height: 15,
        orientation: 'NS' as const,
        wireRadius: 0.002,
        segments: 11,
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
        length: 10,
        height: 5,
        orientation: 45,
        wireRadius: 0.001,
        segments: 11,
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
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 0,
      });

      // Expect 4 wires: left half, right half, source bridge, shield.
      expect(wires).toHaveLength(4);
      const tags = wires.map((w) => w.tag).sort();
      expect(tags).toEqual([1, 2, 3, 4]);

      const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
      expect(bridge.segments).toBe(1);

      const left = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      const right = wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
      // The two halves should meet at the bridge endpoints.
      expect(left.end).toEqual(bridge.start);
      expect(right.start).toEqual(bridge.end);
    });

    it('shifts the source bridge along the dipole axis when offset is nonzero', () => {
      const wires = buildWires({
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 2, // 2 m east of centre
      });

      const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
      // Bridge midpoint x ≈ 2.
      const midX = (bridge.start[0] + bridge.end[0]) / 2;
      expect(midX).toBeCloseTo(2, 5);

      const left = wires.find((w) => w.tag === DIPOLE_LEFT_TAG)!;
      const right = wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
      // Left half is now longer than the right half.
      const leftLen = Math.abs(left.end[0] - left.start[0]);
      const rightLen = Math.abs(right.end[0] - right.start[0]);
      expect(leftLen).toBeGreaterThan(rightLen);
    });

    it('clamps offset so the bridge cannot escape the dipole', () => {
      const wires = buildWires({
        length: 4,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        feedlineId: 'rg58',
        feedlineLength: 5,
        feedlineOffset: 999, // absurdly large
      });
      const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
      // The bridge midpoint must remain inside [-length/2, +length/2].
      const midX = (bridge.start[0] + bridge.end[0]) / 2;
      expect(midX).toBeLessThanOrEqual(2);
      expect(midX).toBeGreaterThanOrEqual(-2);
    });
  });

  describe('inverted-v geometry', () => {
    it('generates inverted-v geometry correctly', () => {
      const state = {
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        antennaType: 'inverted-v' as const,
        vAngle: 120,
        frequency: 7.1,
      };
      const wires = buildWires(state);
      expect(wires).toHaveLength(2);
      const apex = wires[0].end;
      expect(apex).toEqual([0, 0, 10]);
      expect(wires[1].start).toEqual([0, 0, 10]);

      // drop = (180 - 120) / 2 = 30 deg
      // sin(30) = 0.5. half-length = 10. drop height = 10 * 0.5 = 5.
      // Tip Z = 10 - 5 = 5.
      expect(wires[0].start[2]).toBeCloseTo(5, 5);
      expect(wires[1].end[2]).toBeCloseTo(5, 5);

      // cos(30) = 0.866. horizontal length = 10 * 0.866 = 8.66.
      // EW orientation -> dx=1, dy=0.
      expect(Math.abs(wires[0].start[0])).toBeCloseTo(8.66, 2);
      expect(wires[0].start[1]).toBe(0);
      expect(Math.abs(wires[1].end[0])).toBeCloseTo(8.66, 2);
    });

    it('clamps inverted-v tips to SLOPING_V_MIN_TIP_Z_M (0.5m)', () => {
      const state = {
        length: 100,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        antennaType: 'inverted-v' as const,
        vAngle: 60, // sin(60) = 0.866. 50 * 0.866 = 43.3m drop. Tip would be at -33.3m.
        frequency: 7.1,
      };
      const wires = buildWires(state);
      expect(wires[0].start[2]).toBeCloseTo(0.5, 5);
      expect(wires[1].end[2]).toBeCloseTo(0.5, 5);
    });

    it('uses 20 segments per wavelength for inverted-v', () => {
      const lambda = 299.792458 / 7.1; // ~42.22m
      const state = {
        length: lambda / 2, // ~21.11m. leg = ~10.55m
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 11, // requested small, but spec rule should override
        antennaType: 'inverted-v' as const,
        vAngle: 120,
        frequency: 7.1,
      };
      const wires = buildWires(state);
      // 20 segments per wavelength. leg is 0.25 lambda. 20 * 0.25 = 5 segments.
      // But we have a min segments per leg rule (9).
      expect(wires[0].segments).toBeGreaterThanOrEqual(9);
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
        feedlineId: 'none',
        feedlineLength: 0,
      };

      // Act
      const input = selectSimulationInput(testState);

      // Assert
      expect(input.frequencyMHz).toBe(14.1);
      expect(input.wires).toHaveLength(1);
      expect(input.wires[0].segments).toBe(11);
      expect(input.excitation.wireTag).toBe(DIPOLE_TAG);
      expect(input.excitation.segment).toBe(6); // Math.ceil(11 / 2)
      expect(input.patternResolution.thetaSteps).toBe(37);
      expect(input.patternResolution.phiSteps).toBe(72);
      expect(input.transmissionLines).toBeUndefined();
      expect(input.loads).toBeUndefined();
    });

    it('lands excitation on the apex segment for inverted-v', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        antennaType: 'inverted-v' as const,
        frequency: 7.1,
        length: 20,
        height: 10,
        segments: 21,
      };
      const input = selectSimulationInput(testState);
      expect(input.wires).toHaveLength(2);
      expect(input.excitation.wireTag).toBe(DIPOLE_LEFT_TAG);
      // Apex is at the end of the left leg.
      expect(input.excitation.segment).toBe(input.wires[0].segments);
    });

    it('builds split-dipole topology with TL card when a feedline is configured', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        frequency: 14.1,
        height: 10,
        segments: 21,
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
      const shield = input.wires.find((w) => w.tag === FEEDLINE_SHIELD_TAG)!;
      expect(shield.start[2]).toBe(10);
      expect(shield.end[2]).toBeCloseTo(2, 5);
      // EX moves to bottom of shield (the rig).
      expect(input.excitation.wireTag).toBe(FEEDLINE_SHIELD_TAG);
      // TL card connects source bridge to rig segment.
      expect(input.transmissionLines).toHaveLength(1);
      const tl = input.transmissionLines![0];
      expect(tl.fromTag).toBe(FEED_BRIDGE_TAG); // source bridge
      expect(tl.toTag).toBe(FEEDLINE_SHIELD_TAG);   // shield
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
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 1.5,
      });
      const right = input.wires.find((w) => w.tag === DIPOLE_RIGHT_TAG)!;
      const shield = input.wires.find((w) => w.tag === FEEDLINE_SHIELD_TAG)!;
      // The shield's top vertex must coincide with the right half's start.
      expect(shield.start).toEqual(right.start);
    });

    it('generates sloping-V geometry correctly', () => {
      const state = {
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        antennaType: 'sloping-v' as const,
        legSlope: 30, // 30 degrees down
        vAngle: 90, // 90 degrees opening
        feedlineId: 'none',
      };

      const wires = buildWires(state);
      expect(wires).toHaveLength(2); // Two legs joined at apex

      const apex = wires[0].end;
      expect(apex).toEqual([0, 0, 10]);

      // tip_z = 10 - 10 * sin(30) = 10 - 10 * 0.5 = 5.
      expect(wires[0].start[2]).toBeCloseTo(5, 5);
      expect(wires[1].end[2]).toBeCloseTo(5, 5);

      // check X/Y coordinates for 90 deg opening.
      // orientation EW -> dx=1, dy=0. px=0, py=1.
      // openingHalf = 45 deg.
      // L.x = 10 * cos(30) * cos(45) = 10 * 0.866025 * 0.707107 = 6.123724
      // L.y = 10 * cos(30) * sin(45) * side = 10 * 0.866025 * 0.707107 * side = 6.123724 * side
      expect(Math.abs(wires[0].start[0])).toBeCloseTo(6.1237, 4);
      expect(Math.abs(wires[0].start[1])).toBeCloseTo(6.1237, 4);
    });

    it('clamps sloping-V slope to prevent tips hitting ground', () => {
      const state = {
        length: 100, // half = 50
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
        antennaType: 'sloping-v' as const,
        legSlope: 45, // requested 45 deg
        vAngle: 180,
        feedlineId: 'none',
      };

      const wires = buildWires(state);
      // maxSin = (10 - 0.5) / 50 = 9.5 / 50 = 0.19
      // maxSlope = asin(0.19) ≈ 10.95 deg
      // tip_z should be 0.5
      expect(wires[0].start[2]).toBeCloseTo(0.5, 5);
      expect(wires[1].end[2]).toBeCloseTo(0.5, 5);
    });

    it('adds an LD choke balun on the shield when balun is enabled', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        height: 10,
        feedlineId: 'rg213',
        feedlineLength: 6,
        feedlineOffset: 0,
        balunEnabled: true,
      };

      const input = selectSimulationInput(testState);

      expect(input.loads).toHaveLength(1);
      const ld = input.loads![0];
      expect(ld.type).toBe(4); // impedance load
      expect(ld.wireTag).toBe(FEEDLINE_SHIELD_TAG); // shield wire (FEEDLINE_SHIELD_TAG)
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
        height: 5,
        feedlineId: 'rg213',
        feedlineLength: 30, // would push bottom into the ground
      };

      const input = selectSimulationInput(testState);

      const shield = input.wires.find((w) => w.tag === FEEDLINE_SHIELD_TAG)!;
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
    it('sets initial defaults correctly', () => {
      const s = useAntennaStore.getState();
      expect(s.type).toBe('dipole');
      expect(s.vAngle).toBe(180);
      expect(s.slope).toBe(0);
      expect(s.legSlope).toBe(0);
    });

    it('setType(non-dipole) clears feedline state', () => {
      const store = useAntennaStore.getState();
      store.setFeedline('rg58');
      store.setFeedlineLength(10);
      store.setFeedlineOffset(1);

      store.setType('inverted-v');
      const s = useAntennaStore.getState();
      expect(s.type).toBe('inverted-v');
      expect(s.feedlineId).toBe('none');
      expect(s.feedlineLength).toBe(0);
      expect(s.feedlineOffset).toBe(0);
    });

    it('setType sets correct default lengths for each type', () => {
      const store = useAntennaStore.getState();
      const freq = 7.1;
      const lambda = 299.792458 / freq;
      store.setFrequency(freq);

      store.setType('dipole');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 0.5 * 0.95, 3);

      store.setType('inverted-v');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 0.5 * 0.95, 3);

      store.setType('delta-loop');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda, 3);

      store.setType('sloping-v');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 2, 3);

      store.setType('v-beam');
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda * 2, 3);
    });

    it('setHalfWaveLength is topology-aware', () => {
      const store = useAntennaStore.getState();
      const freq = 14.1;
      const lambda = 299.792458 / freq;
      store.setFrequency(freq);

      store.setType('delta-loop');
      store.setLength(5); // manual override
      store.setHalfWaveLength();
      expect(useAntennaStore.getState().length).toBeCloseTo(lambda, 3);

      store.setType('sloping-v');
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
      // New limit is 4/2 - 0.05 = 1.95.
      expect(offsetAfter).toBeLessThanOrEqual(1.95);
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
});
