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
      // The choke balun has been removed; we no longer emit any LD load
      // tied to the shield wire here.
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

    it('preserves length when switching between resonant wire types', () => {
      const store = useAntennaStore.getState();
      store.setType('dipole');
      store.setLength(15.5); // user-chosen
      store.setType('inverted-v');
      expect(useAntennaStore.getState().length).toBe(15.5);
    });

    it('auto-resizes sloping V to ~4λ total length', () => {
      const store = useAntennaStore.getState();
      store.setFrequency(7.1);
      store.setType('dipole');
      store.setLength(20);
      store.setType('sloping-v');
      const state = useAntennaStore.getState();
      // Directional vee-beam default: about two wavelengths per leg (4λ total).
      // 4 * 299.792/7.1 ≈ 168.9 m
      expect(state.length).toBeGreaterThan(160);
      expect(state.length).toBeLessThan(180);
    });

    it('setHalfWaveLength is topology-aware: ½λ for dipole/V, 4λ for sloping V / v-beam, 1λ for delta-loop', () => {
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

      store.setType('sloping-v');
      store.setHalfWaveLength();
      const slopingVLen = useAntennaStore.getState().length;
      // 4λ at 7.1 MHz ≈ 168.9 m
      expect(slopingVLen).toBeGreaterThan(160);
      expect(slopingVLen).toBeLessThan(180);
      expect(slopingVLen).toBeGreaterThan(loopLen);
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
      terminatedEnabled: true,
      terminatingResistor: 450,
    });
    // We expect exactly 2 termination LD cards.
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

  it('sloping V: terminates the far ends with a non-radiating resistor network', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'sloping-v',
      length: 80,
      height: 12,
      segments: 21,
      vAngle: 60,
      legSlope: 30,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 500,
    });
    const rightLeg = input.wires.find((w) => w.tag === 2)!;
    // Two leg wires + one 1-segment apex source bridge (tag 3). The bridge
    // is now always present so the feed is symmetric.
    expect(input.wires).toHaveLength(3);
    expect(input.wires.map((w) => w.tag).sort()).toEqual([1, 2, 3]);
    expect(input.wires.every((w) => w.start[2] > 0 && w.end[2] > 0)).toBe(true);
    expect(input.loads).toBeUndefined();
    expect(input.networks).toHaveLength(1);
    expect(input.networks![0]).toMatchObject({
      fromTag: 1,
      fromSegment: 1,
      toTag: 2,
      toSegment: rightLeg.segments,
      y11Real: 1 / 500,
      y12Real: -1 / 500,
      y22Real: 1 / 500,
    });
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

  it('delta loop: solver feedpoint is at the apex bridge', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'delta-loop',
      length: 42,
      height: 15,
      segments: 21,
      feedlineId: 'none',
      terminatedEnabled: false,
    });
    const leftLeg = input.wires.find((w) => w.tag === 1)!;
    // The apex source bridge (tag 3) is now always present; the feed
    // sits on its single segment for a symmetric balanced source.
    const bridge = input.wires.find((w) => w.tag === 3)!;
    expect(bridge).toBeDefined();
    expect(bridge.segments).toBe(1);
    expect(input.excitation.wireTag).toBe(3);
    expect(input.excitation.segment).toBe(1);
    // The bridge midpoint sits at the apex height (the bridge endpoints
    // are tiny offsets either side of the apex along the dipole axis).
    expect(leftLeg.end[2]).toBeCloseTo(15, 5);
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
    // Two leg wires (tags 1, 2) plus the always-present 1-segment apex
    // source bridge (tag 3). No termination floaters.
    expect(input.wires).toHaveLength(3);
    const tags = input.wires.map((w) => w.tag).sort();
    expect(tags).toEqual([1, 2, 3]);
  });
});

describe('V geometry (sanity-only checks for current implementation)', () => {
  // These tests pin down the *current* behaviour of buildVWires after the
  // PR-101 follow-ups so future changes don't silently regress it. They do
  // NOT validate that the antenna is electrically correct (in particular,
  // the sloping V remains symmetric about its bisector — see PR review).
  it('inverted V: legs + apex bridge lie in a single vertical plane along the orientation axis', () => {
    const wires = buildWires({
      type: 'inverted-v',
      length: 20,
      height: 10,
      orientation: 'EW',
      wireRadius: 0.001,
      segments: 21,
      vAngle: 120,
    });
    // Two legs + 1-segment apex source bridge (so the feed is symmetric).
    expect(wires).toHaveLength(3);
    const left = wires.find((w) => w.tag === 1)!;
    const right = wires.find((w) => w.tag === 2)!;
    const bridge = wires.find((w) => w.tag === 3)!;
    expect(bridge.segments).toBe(1);
    // Leg outer endpoints lie on the X axis (Y=0) for EW orientation.
    expect(left.start[1]).toBeCloseTo(0, 5);
    expect(right.end[1]).toBeCloseTo(0, 5);
    // The bridge spans between the two leg inner ends at the apex height.
    expect(left.end).toEqual(bridge.start);
    expect(right.start).toEqual(bridge.end);
    // The bridge endpoints sit a small 2.5 cm offset away from the apex
    // along each leg's axis (the bridge is a 5 cm wire spanning the
    // two leg inner ends). At apex height 10 m with a 120° angle the
    // z-component of that offset is ~1.2 cm.
    expect(left.end[2]).toBeCloseTo(10, 1);
    expect(right.start[2]).toBeCloseTo(10, 1);
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
    // Two leg wires + apex bridge + base wire = 4 wires.
    expect(wires).toHaveLength(4);
    const expectedSide = 30 / 3;
    const baseWire = wires.find((w) => Math.abs(w.start[2] - w.end[2]) < 1e-6 && w.start[2] < 15)!;
    const baseLen = Math.hypot(
      baseWire.end[0] - baseWire.start[0],
      baseWire.end[1] - baseWire.start[1],
    );
    expect(baseLen).toBeCloseTo(expectedSide, 4);
    // Apex above the midpoint of the base, at full height.
    const apexCandidates = wires
      .flatMap((w) => [w.start, w.end])
      .filter((p) => p[2] > baseWire.start[2] + 1e-6);
    const apexZ = Math.max(...apexCandidates.map((p) => p[2]));
    expect(apexZ).toBe(15);
  });
});

describe('v-beam excitation and geometry', () => {
  it('v-beam is fed by a 1-segment apex bridge for a symmetric balanced source', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'v-beam',
      length: 80,
      height: 15,
      segments: 21,
      vAngle: 60,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 450,
    });
    // V-beam feed sits on the apex source bridge (tag 3). This drives the
    // two legs as a single balanced voltage source — exactly the textbook
    // model of an apex-fed V — rather than asymmetrically feeding one leg.
    const bridge = input.wires.find((w) => w.tag === 3)!;
    expect(bridge).toBeDefined();
    expect(bridge.segments).toBe(1);
    expect(input.excitation.wireTag).toBe(3);
    expect(input.excitation.segment).toBe(1);
  });

  it('v-beam terminated: creates a far-end NT resistor, not floating LD stubs', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'v-beam',
      length: 80,
      height: 15,
      segments: 21,
      vAngle: 60,
      feedlineId: 'none',
      terminatedEnabled: true,
      terminatingResistor: 450,
    });
    const rightLeg = input.wires.find((w) => w.tag === 2)!;
    // Two legs + 1-segment apex source bridge.
    expect(input.wires).toHaveLength(3);
    expect(input.wires.map((w) => w.tag).sort()).toEqual([1, 2, 3]);
    expect(input.wires.every((w) => w.start[2] > 0 && w.end[2] > 0)).toBe(true);
    expect(input.loads).toBeUndefined();
    expect(input.networks).toHaveLength(1);
    expect(input.networks![0]).toMatchObject({
      fromTag: 1,
      fromSegment: 1,
      toTag: 2,
      toSegment: rightLeg.segments,
      y11Real: 1 / 450,
      y12Real: -1 / 450,
      y22Real: 1 / 450,
    });
  });

  it('sloping-v uses a wavelength-based segment floor for multi-wavelength legs', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'sloping-v',
      length: 170,
      height: 20,
      segments: 21,
      vAngle: 60,
      legSlope: 20,
      feedlineId: 'none',
      terminatedEnabled: false,
    });
    const leftLeg = input.wires.find((w) => w.tag === 1)!;
    // The apex source bridge (tag 3) is now always present for symmetric
    // feed. Each leg is roughly 2λ long at the default 7.1 MHz, so the
    // wavelength-based floor (~20 segs/λ) gives 30–60 segments per leg.
    expect(input.wires.some((w) => w.tag === 3)).toBe(true);
    expect(leftLeg.segments).toBeGreaterThanOrEqual(20);
    // Sanity cap: should still be in a reasonable range, not blown up to
    // hundreds of segments by mis-applying the bridge length factor.
    expect(leftLeg.segments).toBeLessThan(200);
  });

  it('matching transformer stores the ratio explicitly instead of changing the SWR reference impedance', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      matchingTransformer: 9,
    });
    expect(input.systemZ0).toBe(50);
    expect(input.transformerRatio).toBe(9);
  });

  it('sloping-v auto-enables termination on type switch', () => {
    const store = useAntennaStore.getState();
    store.setType('dipole');
    store.setTerminatedEnabled(false);
    store.setType('sloping-v');
    expect(useAntennaStore.getState().terminatedEnabled).toBe(true);
  });

  it('sloping-v without termination produces no termination network or LD cards', () => {
    const state = useAntennaStore.getState();
    const input = selectSimulationInput({
      ...state,
      type: 'sloping-v',
      length: 80,
      height: 15,
      segments: 21,
      vAngle: 60,
      legSlope: 30,
      feedlineId: 'none',
      terminatedEnabled: false,
      terminatingResistor: 450,
    });
    // Two legs + apex source bridge, no termination drops.
    expect(input.wires).toHaveLength(3);
    expect(input.wires.map((w) => w.tag).sort()).toEqual([1, 2, 3]);
    expect(input.loads).toBeUndefined();
    expect(input.networks).toBeUndefined();
  });
});
