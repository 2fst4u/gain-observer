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
    it('combines state into simulation input correctly', () => {
      // Arrange
      const state = useAntennaStore.getState();
      const testState = {
        ...state,
        frequency: 14.1,
        length: 10,
        height: 5,
        orientation: 'EW' as const,
        segments: 11,
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
});
