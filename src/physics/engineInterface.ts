// Engine abstraction so swapping solvers (or adding a JS fallback) is trivial.
//
// Usage:
//   const engine = await getEngine();
//   const result = await engine.simulate(input);

import { Nec2Engine } from './nec2Engine';
import type { Engine } from './types';

let singleton: Engine | null = null;

export function getEngine(): Engine {
  if (!singleton) {
    singleton = new Nec2Engine();
  }
  return singleton;
}

/** For tests: inject a specific engine (e.g. mock). */
export function _setEngineForTesting(engine: Engine | null): void {
  singleton = engine;
}
