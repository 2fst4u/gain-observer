import { describe, expect, it } from 'vitest';
import { useAntennaStore, buildWires, selectSimulationInput } from '../src/store/antennaStore';


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
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
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
        length: 4,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
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
        feedlineId: 'rg58',
        feedlineLength: 8,
        feedlineOffset: 1.5,
      });
      const right = input.wires.find((w) => w.tag === 2)!;
      const shield = input.wires.find((w) => w.tag === 4)!;
      // The shield's top vertex must coincide with the right half's start.
      expect(shield.start).toEqual(right.start);
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
      expect(ld.wireTag).toBe(4); // shield wire (FEEDLINE_SHIELD_TAG)
      expect(ld.segmentStart).toBe(1); // top of shield (near feedpoint)
      expect(ld.segmentEnd).toBe(1);
      expect(ld.param1).toBeGreaterThan(500); // ~kΩ choke
      expect(ld.param2).toBe(0);
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

  describe('type changes reset dependent state', () => {
    it('clears stale feedlineId when switching to a non-dipole type', () => {
      const store = useAntennaStore.getState();
      store.setType('dipole');
      store.setFeedline('rg58');
      expect(useAntennaStore.getState().feedlineId).toBe('rg58');
      store.setType('inverted-v');
      expect(useAntennaStore.getState().feedlineId).toBe('none');
    });

    it('clears terminatedEnabled when antenna type changes', () => {
      const store = useAntennaStore.getState();
      store.setType('dipole');
      store.setTerminatedEnabled(true);
      expect(useAntennaStore.getState().terminatedEnabled).toBe(true);
      store.setType('delta-loop');
      expect(useAntennaStore.getState().terminatedEnabled).toBe(false);
    });

    it('auto-resizes length to ~1λ when switching to delta loop', () => {
      const store = useAntennaStore.getState();
      store.setFrequency(7.1);
      store.setType('dipole');
      store.setLength(20); // some wire length
      store.setType('delta-loop');
      const state = useAntennaStore.getState();
      // c/f at 7.1 MHz ≈ 42.224 m. Delta loop perimeter = 1λ.
      expect(state.length).toBeGreaterThan(40);
      expect(state.length).toBeLessThan(45);
    });

    it('auto-resizes length back to ~½λ when leaving delta loop', () => {
      const store = useAntennaStore.getState();
      store.setFrequency(7.1);
      store.setType('delta-loop');
      // length is now ~42 m
      store.setType('inverted-v');
      const state = useAntennaStore.getState();
      // ½λ at 7.1 MHz with 0.95 end-effect ≈ 20.06 m.
      expect(state.length).toBeGreaterThan(18);
      expect(state.length).toBeLessThan(22);
    });

    it('does not resize length when switching between non-loop types', () => {
      const store = useAntennaStore.getState();
      store.setType('dipole');
      store.setLength(15.5); // user-chosen
      store.setType('inverted-v');
      expect(useAntennaStore.getState().length).toBe(15.5);
      store.setType('sloping-v');
      expect(useAntennaStore.getState().length).toBe(15.5);
    });

    it('setHalfWaveLength is topology-aware: ½λ for dipole/V, 1λ for delta-loop', () => {
      const store = useAntennaStore.getState();
      store.setFrequency(7.1);

      store.setType('dipole');
      store.setHalfWaveLength();
      const dipoleLen = useAntennaStore.getState().length;
      expect(dipoleLen).toBeGreaterThan(18);
      expect(dipoleLen).toBeLessThan(22); // ~20.06 m

      store.setType('delta-loop');
      store.setHalfWaveLength();
      const loopLen = useAntennaStore.getState().length;
      // Loop perimeter = 1λ, roughly 2× the dipole's ½λ × 0.95 factor.
      expect(loopLen).toBeGreaterThan(40);
      expect(loopLen).toBeLessThan(45); // ~42.22 m
      expect(loopLen).toBeGreaterThan(dipoleLen);
    });
  });
});

describe('termination loading', () => {
  it('plain dipole: emits two LD cards on the tips of the single wire', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'dipole',
      length: 20,
      height: 10,
      segments: 21,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 600,
    });
    expect(input.loads).toBeDefined();
    expect(input.loads).toHaveLength(2);
    // Both loads are on the single dipole wire (tag 1).
    expect(input.loads!.every((l) => l.wireTag === 1)).toBe(true);
    const segs = input.loads!.map((l) => l.segmentStart).sort((a, b) => a - b);
    expect(segs[0]).toBe(1); // outer tip 1
    expect(segs[1]).toBe(21); // outer tip N
    expect(input.loads!.every((l) => l.param1 === 600 && l.param2 === 0)).toBe(true);
  });

  it('split dipole (with feedline): LD on outer tip of each half, not on the bridge', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'dipole',
      length: 20,
      height: 10,
      segments: 21,
      feedlineId: 'rg58',
      feedlineLength: 8,
      feedlineOffset: 0,
      balunEnabled: false,
      terminatedEnabled: true,
      terminatingResistor: 450,
    });
    // We expect exactly 2 termination LD cards (no balun since balun=false).
    expect(input.loads).toBeDefined();
    expect(input.loads).toHaveLength(2);
    const leftTagLoad = input.loads!.find((l) => l.wireTag === 1);
    const rightTagLoad = input.loads!.find((l) => l.wireTag === 2);
    expect(leftTagLoad).toBeDefined();
    expect(rightTagLoad).toBeDefined();
    expect(leftTagLoad!.segmentStart).toBe(1); // outermost (left tip)
    const rightHalf = input.wires.find((w) => w.tag === 2)!;
    expect(rightTagLoad!.segmentStart).toBe(rightHalf.segments); // outermost (right tip)
  });

  it('inverted V: LD on the open tip of each leg (tag 1 seg 1, tag 2 seg N)', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'inverted-v',
      length: 20,
      height: 10,
      segments: 21,
      vAngle: 120,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 800,
    });
    expect(input.loads).toBeDefined();
    expect(input.loads).toHaveLength(2);
    const leg1Wire = input.wires.find((w) => w.tag === 1)!;
    const leg2Wire = input.wires.find((w) => w.tag === 2)!;
    const leg1Load = input.loads!.find((l) => l.wireTag === 1);
    const leg2Load = input.loads!.find((l) => l.wireTag === 2);
    expect(leg1Load).toBeDefined();
    expect(leg2Load).toBeDefined();
    // Leg 1 wire goes end1 -> apex; segment 1 is the leg tip (open end).
    expect(leg1Load!.segmentStart).toBe(1);
    // Leg 2 wire goes apex -> end2; segment N is the leg tip.
    expect(leg2Load!.segmentStart).toBe(leg2Wire.segments);
    // Sanity: not on apex segments.
    expect(leg1Load!.segmentStart).not.toBe(leg1Wire.segments);
    expect(leg2Load!.segmentStart).not.toBe(1);
  });

  it('sloping V: same tip-loading topology as inverted V', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'sloping-v',
      length: 30,
      height: 12,
      segments: 21,
      vAngle: 90,
      legSlope: 30,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 500,
    });
    expect(input.loads).toBeDefined();
    expect(input.loads).toHaveLength(2);
    expect(input.loads!.some((l) => l.wireTag === 1 && l.segmentStart === 1)).toBe(true);
    const leg2 = input.wires.find((w) => w.tag === 2)!;
    expect(input.loads!.some((l) => l.wireTag === 2 && l.segmentStart === leg2.segments)).toBe(true);
  });

  it('delta loop: a single LD card at the centre of the bottom (base) wire', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'delta-loop',
      length: 42,
      height: 15,
      segments: 21,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 800,
    });
    expect(input.loads).toBeDefined();
    expect(input.loads).toHaveLength(1);
    const ld = input.loads![0];
    // Base wire has its own tag (DELTA_BASE_TAG=5) to avoid clashing
    // with the left leg, which also conventionally uses tag 1.
    expect(ld.wireTag).toBe(5);
    const bottomWire = input.wires.find((w) => w.tag === 5)!;
    expect(ld.segmentStart).toBe(Math.ceil(bottomWire.segments / 2));
    expect(ld.param1).toBe(800);
  });

  it('terminated=false produces no LD cards', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'dipole',
      feedlineId: 'none',
      terminatedEnabled: false,
    });
    expect(input.loads).toBeUndefined();
  });

  it('V geometry no longer adds floating drop-to-ground wires', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'inverted-v',
      length: 20,
      height: 10,
      segments: 21,
      vAngle: 120,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 600,
    });
    // Expect only the two leg wires (tags 1 and 2). No TERM_LEFT_TAG=10 /
    // TERM_RIGHT_TAG=11 floaters.
    expect(input.wires).toHaveLength(2);
    const tags = input.wires.map((w) => w.tag).sort();
    expect(tags).toEqual([1, 2]);
  });
});

describe('V geometry (sanity-only checks for current implementation)', () => {
  // These tests pin down the *current* behaviour of buildVWires after the
  // PR-101 follow-ups so future changes don't silently regress it. They do
  // NOT validate that the antenna is electrically correct (in particular,
  // the sloping V remains symmetric about its bisector — see PR review).
  it('inverted V: legs lie in a single vertical plane along the orientation axis', () => {
    const wires = buildWires({
      type: 'inverted-v',
      length: 20,
      height: 10,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 21,
      vAngle: 120,
    });
    expect(wires).toHaveLength(2);
    const left = wires.find((w) => w.tag === 1)!;
    const right = wires.find((w) => w.tag === 2)!;
    // Leg endpoints lie on the X axis (Y=0) for EW orientation.
    expect(left.start[1]).toBeCloseTo(0, 5);
    expect(right.end[1]).toBeCloseTo(0, 5);
    // Apex is at z=10 with x=y=0; both wires share that vertex.
    expect(left.end).toEqual(right.start);
    expect(left.end[2]).toBe(10);
    // Leg tips drop below apex by length/2 * sin((180-120)/2 deg).
    const expectedDrop = 10 * Math.sin((30 * Math.PI) / 180);
    expect(left.start[2]).toBeCloseTo(10 - expectedDrop, 5);
    expect(right.end[2]).toBeCloseTo(10 - expectedDrop, 5);
  });

  it('delta loop: equilateral triangle with apex up and base = side length', () => {
    const wires = buildWires({
      type: 'delta-loop',
      length: 30, // perimeter
      height: 15,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 21,
    });
    expect(wires).toHaveLength(3);
    const expectedSide = 30 / 3;
    // The base wire (DIPOLE_TAG=1, bottom) endpoints have z = baseZ < apex.
    const leftLeg = wires.find((w) => w.tag === 1)!; // left -> apex (DIPOLE_LEFT_TAG=1 ?? clash)
    // Note: DIPOLE_TAG and DIPOLE_LEFT_TAG share the value 1 in this codebase.
    // The base wire is the one whose segment runs purely horizontally.
    const baseWire = wires.find((w) => Math.abs(w.start[2] - w.end[2]) < 1e-6)!;
    const baseLen = Math.hypot(
      baseWire.end[0] - baseWire.start[0],
      baseWire.end[1] - baseWire.start[1],
    );
    expect(baseLen).toBeCloseTo(expectedSide, 4);
    // Apex above the midpoint of the base, at full height.
    void leftLeg;
    const apexCandidates = wires
      .flatMap((w) => [w.start, w.end])
      .filter((p) => p[2] > baseWire.start[2] + 1e-6);
    // Several wire endpoints may coincide at the apex; just check the highest.
    const apexZ = Math.max(...apexCandidates.map((p) => p[2]));
    expect(apexZ).toBe(15);
  });
});
