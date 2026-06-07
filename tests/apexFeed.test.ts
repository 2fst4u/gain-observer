import { describe, it, expect } from 'vitest';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { buildNecCards } from '../src/physics/necCard';
import { parseGwLine, getNecLines, expectExcitation } from './necInspect';
import { FEED_BRIDGE_TAG, LEFT_LEG_TAG, DELTA_BASE_TAG } from '../src/physics/constants';

describe('Apex Feed and Geometry', () => {
  it('should generate a balanced bridge for Inverted V', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('inverted-v');
    store.setFeedline('none');
    store.setFrequency(7.1);
    store.setLength(20.5);
    store.setHeight(10);
    store.setVAngle(120);

    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);

    // Verify bridge GW card
    const gwLines = getNecLines(deck, 'GW');
    const bridgeLine = gwLines.find(l => parseGwLine(l).tag === FEED_BRIDGE_TAG);
    expect(bridgeLine).toBeDefined();
    const bridge = parseGwLine(bridgeLine!);
    expect(bridge.segments).toBe(1);

    // Y coordinates should be balanced around 0 if oriented EW (90 deg)
    // EW orientation means wires are along X axis? No, orientationVector(90) is [0, 1] which is along Y axis (North/South in compass, but 90 deg is East?)
    // Let's check orientationVector:
    // rad = ((90 - 90) * Math.PI) / 180 = 0. [cos(0), sin(0)] = [1, 0].
    // So 90 deg (EW) is along X axis.
    expect(bridge.y1).toBeCloseTo(0);
    expect(bridge.y2).toBeCloseTo(0);
    expect(bridge.x1).toBeLessThan(0);
    expect(bridge.x2).toBeGreaterThan(0);
    expect(Math.abs(bridge.x1)).toBeCloseTo(Math.abs(bridge.x2));

    // Verify excitation on bridge
    expectExcitation(deck, FEED_BRIDGE_TAG, 1);
  });

  it('should generate a balanced bridge for Sloping V', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('sloping-v');
    store.setFeedline('none');
    store.setFrequency(7.1);
    store.setLength(40); // 20m per leg
    store.setHeight(15);
    store.setVAngle(90);
    store.setLegSlope(30);

    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);

    const gwLines = getNecLines(deck, 'GW');
    const bridgeLine = gwLines.find(l => parseGwLine(l).tag === FEED_BRIDGE_TAG);
    expect(bridgeLine).toBeDefined();
    const bridge = parseGwLine(bridgeLine!);
    expect(bridge.segments).toBe(1);

    expectExcitation(deck, FEED_BRIDGE_TAG, 1);
  });

  it('should feed the apex (last segment of left leg) for Delta Loop', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setFeedline('none');
    store.setFrequency(7.1);
    store.setLength(42); // perimeter
    store.setHeight(15);

    const input = selectSimulationInput(useAntennaStore.getState());
    const deck = buildNecCards(input);

    const gwLines = getNecLines(deck, 'GW');

    // Left leg (tag 1) ends at the apex — excitation must land on its last segment.
    const leftLegLine = gwLines.find(l => parseGwLine(l).tag === LEFT_LEG_TAG);
    expect(leftLegLine).toBeDefined();
    const leftLeg = parseGwLine(leftLegLine!);

    expectExcitation(deck, LEFT_LEG_TAG, leftLeg.segments);

    // Base wire must use DELTA_BASE_TAG (tag 6), not RIGHT_LEG_TAG (tag 2).
    const baseLine = gwLines.find(l => parseGwLine(l).tag === DELTA_BASE_TAG);
    expect(baseLine).toBeDefined();
  });
});
