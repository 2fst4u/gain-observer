import { describe, expect, it } from 'vitest';
import { useAntennaStore, buildWires, selectSimulationInput } from '../src/store/antennaStore';


describe('antennaStore selectors', () => {
  describe('buildWires', () => {
    it('generates correct wire coordinates for EW orientation', () => {
      // Arrange
      const state = {
        length: 20,
        height: 10,
        orientation: 'EW' as const,
        wireRadius: 0.001,
        segments: 21,
      };

      // Act
      const wires = buildWires(state);

      // Assert
      expect(wires).toHaveLength(1);
      expect(wires[0].start).toEqual([-10, 0, 10]);
      expect(wires[0].end).toEqual([10, 0, 10]);
      expect(wires[0].radius).toBe(0.001);
      expect(wires[0].segments).toBe(21);
    });

    it('generates correct wire coordinates for NS orientation', () => {
      const state = {
        length: 20,
        height: 15,
        orientation: 'NS' as const,
        wireRadius: 0.002,
        segments: 11,
      };
      const wires = buildWires(state);
      expect(wires[0].start).toEqual([0, -10, 15]);
      expect(wires[0].end).toEqual([0, 10, 15]);
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

    it('adds shield wire and TL card when a feedline is configured', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        frequency: 14.1,
        height: 10,
        segments: 11,
        feedlineId: 'rg58',
        feedlineLength: 8,
        balunEnabled: false,
      };

      const input = selectSimulationInput(testState);

      // Two wires: dipole (tag 1) + shield (tag 2).
      expect(input.wires).toHaveLength(2);
      expect(input.wires[0].tag).toBe(1);
      expect(input.wires[1].tag).toBe(2);
      // Shield should drop straight down from feedpoint at (0,0,h).
      expect(input.wires[1].start).toEqual([0, 0, 10]);
      expect(input.wires[1].end[2]).toBeCloseTo(2, 5);
      // EX moves to bottom of shield (the rig).
      expect(input.excitation.wireTag).toBe(2);
      // TL card connects dipole feedpoint to bottom-of-shield.
      expect(input.transmissionLines).toHaveLength(1);
      const tl = input.transmissionLines![0];
      expect(tl.fromTag).toBe(1);
      expect(tl.toTag).toBe(2);
      expect(tl.z0).toBe(50);
      // Electrical length = physical / VF (RG-58 VF = 0.66).
      expect(tl.lengthM).toBeCloseTo(8 / 0.66, 5);
      // No balun => no load card.
      expect(input.loads).toBeUndefined();
    });

    it('adds an LD choke balun on the shield when balun is enabled', () => {
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        height: 10,
        feedlineId: 'rg213',
        feedlineLength: 6,
        balunEnabled: true,
      };

      const input = selectSimulationInput(testState);

      expect(input.loads).toHaveLength(1);
      const ld = input.loads![0];
      expect(ld.type).toBe(4); // impedance load
      expect(ld.wireTag).toBe(2); // shield wire
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

      const shield = input.wires.find((w) => w.tag === 2)!;
      expect(shield).toBeDefined();
      // Bottom must be safely above z=0.
      expect(shield.end[2]).toBeGreaterThan(0);
      // Top stays at the feedpoint.
      expect(shield.start[2]).toBe(5);
    });
  });
});

describe('antennaStore actions', () => {
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
  });
});
