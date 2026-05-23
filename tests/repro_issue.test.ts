import { describe, expect, it } from 'vitest';
import { useAntennaStore, INITIAL_HEIGHT } from '../src/store/antennaStore';

describe('Reproduction of height issue when switching from whip', () => {
  it('should reset height to default when switching from vertical-whip to dipole', () => {
    const store = useAntennaStore.getState();

    // 1. Start with dipole (default height should be INITIAL_HEIGHT)
    store.setAntennaType('dipole');
    expect(useAntennaStore.getState().height).toBe(INITIAL_HEIGHT);

    // 2. Switch to vertical-whip (height should become 0)
    store.setAntennaType('vertical-whip');
    expect(useAntennaStore.getState().height).toBe(0);

    // 3. Switch back to dipole (height should revert to INITIAL_HEIGHT)
    store.setAntennaType('dipole');
    expect(useAntennaStore.getState().height).toBe(INITIAL_HEIGHT);
  });
});
