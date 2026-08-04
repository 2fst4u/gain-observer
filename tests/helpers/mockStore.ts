// Helper for tests that mock `useAntennaStore` and drive a component from a
// hand-built slice of state.
//
// Those tests supply only the handful of fields the component under test
// reads, so the object genuinely isn't a full `AntennaState`. Annotating the
// selector with the narrower mock type doesn't type-check — selector
// parameters are contravariant, so a selector declared over the full state
// isn't assignable to one declared over a subset. Casting the state at the
// single point where it's handed to the selector keeps the selector itself
// correctly typed and confines the unsoundness to one place.
//
// Callers must `vi.mock` the store module first; this only sets the
// implementation.

import { vi } from 'vitest';
import { useAntennaStore, type AntennaState } from '../../src/store/antennaStore';

/**
 * Partial state — every field is optional, and only what the component reads
 * need be present. Field *types* are still checked against the real store, so
 * a misspelled or wrongly-typed mock field is a compile error rather than an
 * `undefined` the component silently renders around.
 */
export type MockAntennaState = Partial<AntennaState>;

/**
 * Make the mocked `useAntennaStore` resolve selectors against `state`.
 *
 * Pass a thunk when the test mutates a captured variable between renders to
 * simulate an external store update — the thunk is re-run on every hook call,
 * so the new value is picked up. A plain object is snapshotted once.
 */
export function mockAntennaStore(state: MockAntennaState | (() => MockAntennaState)): void {
  const read = typeof state === 'function' ? state : () => state;
  vi.mocked(useAntennaStore).mockImplementation((selector?: (s: AntennaState) => unknown) => {
    const current = read() as unknown as AntennaState;
    return selector ? selector(current) : current;
  });
}
