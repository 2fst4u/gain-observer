import { describe, expect, it, beforeEach } from 'vitest';
import { buildDeltaLoopWires, deltaLoopBaseZ } from '../src/store/antennaGeometry';
import { useAntennaStore, selectSimulationInput } from '../src/store/antennaStore';
import { DELTA_CORNER_PERIMETER_WL } from '../src/physics/constants';
import { DELTA_BASE_TAG, FEED_BRIDGE_TAG, FEEDLINE_SHIELD_TAG, LEFT_LEG_TAG, RIGHT_LEG_TAG } from '../src/physics/tags';

const base = { length: 42.2, height: 8, orientation: 'EW' as const, wireRadius: 0.001, segments: 21, frequency: 7.1 };
const near = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-9);

describe('corner-fed delta loop', () => {
  const original = useAntennaStore.getState();
  beforeEach(() => useAntennaStore.setState(original, true));

  it('keeps the same triangle as the apex feed and starts the left leg at the corner', () => {
    const apex = buildDeltaLoopWires(base);
    const corner = buildDeltaLoopWires({ ...base, feed: 'corner' });
    const bz = deltaLoopBaseZ(42.2, 8);
    expect(bz).toBeCloseTo(0.5, 9);
    const leftApex = apex.find((w) => w.tag === LEFT_LEG_TAG)!;
    const leftCorner = corner.find((w) => w.tag === LEFT_LEG_TAG)!;
    expect(near(leftCorner.start, leftApex.start)).toBe(true);
    expect(leftCorner.start[2]).toBeCloseTo(bz, 9);
    expect(near(leftCorner.end, [0, 0, 8])).toBe(true);
    expect(corner.some((w) => w.tag === RIGHT_LEG_TAG)).toBe(true);
    expect(corner.some((w) => w.tag === DELTA_BASE_TAG)).toBe(true);
  });

  it('places the source bridge and coax at the corner when a feedline is modelled', () => {
    const wires = buildDeltaLoopWires({ ...base, feed: 'corner', feedlineShield: { bottomZ: 0.3, radius: 0.0025, segments: 11, lengthM: 10, frequencyMHz: 7.1 } });
    const bridge = wires.find((w) => w.tag === FEED_BRIDGE_TAG)!;
    const shield = wires.find((w) => w.tag === FEEDLINE_SHIELD_TAG)!;
    expect(bridge.start[2]).toBeCloseTo(0.5, 9);
    expect(bridge.end[2]).toBeGreaterThan(0.5);
    expect(near(shield.start, bridge.start)).toBe(true);
    expect(shield.end[2]).toBeCloseTo(0.3, 6);
    // Nothing goes above the apex or near the apex feed.
    expect(wires.every((w) => w.start[2] <= 8 + 1e-9 && w.end[2] <= 8 + 1e-9)).toBe(true);
  });

  it('excites the corner with and without coax, and resonates near 1.03λ', () => {
    const store = useAntennaStore.getState();
    store.setAntennaType('delta-loop');
    store.setHeight(8);
    useAntennaStore.getState().setDeltaFeed('corner');
    useAntennaStore.setState({ feedlineId: 'none' });
    let input = selectSimulationInput(useAntennaStore.getState());
    expect(input.excitation).toEqual({ wireTag: LEFT_LEG_TAG, segment: 1 });
    useAntennaStore.setState({ feedlineId: 'rg58', feedlineLength: 10 });
    input = selectSimulationInput(useAntennaStore.getState());
    expect(input.excitation.wireTag).toBe(FEEDLINE_SHIELD_TAG);
    expect(input.wires.find((w) => w.tag === FEED_BRIDGE_TAG)!.start[2]).toBeCloseTo(0.5, 9);
    useAntennaStore.getState().setHalfWaveLength();
    const s = useAntennaStore.getState();
    expect(s.length).toBeCloseTo(DELTA_CORNER_PERIMETER_WL * 299.792458 / s.frequency, 9);
  });

  it('ignores invalid feed values and captures the feed in comparisons', () => {
    useAntennaStore.getState().setAntennaType('delta-loop');
    useAntennaStore.getState().setDeltaFeed('corner');
    useAntennaStore.getState().setDeltaFeed('middle' as never);
    expect(useAntennaStore.getState().deltaFeed).toBe('corner');
    useAntennaStore.setState({ result: {} as never, sweep: [{ frequencyMHz: 7, R: 50, X: 0, swr: 1 }] });
    useAntennaStore.getState().captureComparisonReference();
    expect(useAntennaStore.getState().comparisonReference!.deltaFeed).toBe('corner');
  });
});
