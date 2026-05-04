// Physics worker — hosts the NEC-2 Wasm solver off the main thread.
//
// Protocol:
//   → main posts { id, type: 'simulate', input }
//   ← worker posts { id, type: 'result', result } or { id, type: 'error', message }
//
// The worker also emits { type: 'ready' } when the engine has initialised.

/// <reference lib="webworker" />

import { Nec2Engine } from '../physics/nec2Engine';
import type { SimulationInput, SimulationResult, SweepPoint } from '../physics/types';

export type WorkerRequest =
  | { id: number; type: 'simulate'; input: SimulationInput };

export type WorkerResponse =
  | { type: 'ready' }
  | { id: number; type: 'result'; result: SimulationResult; sweep: readonly SweepPoint[] }
  | { id: number; type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// Surface worker-side errors explicitly so they don't vanish silently.
self.addEventListener('error', (ev) => {
  console.error('[worker error]', ev.message, ev.error);
});
self.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  console.error('[worker unhandledrejection]', ev.reason);
});

console.log('[worker] booting, creating engine');

const engine = new Nec2Engine({
  // The worker is served from the same origin as the app, so "/" resolves
  // to the same host. This keeps the wasm file path stable.
  baseUrl: '/',
});

const SWEEP_POINTS = 15;
const SWEEP_SPAN_FRACTION = 0.2;

engine
  .init()
  .then(() => {
    console.log('[worker] engine init complete, posting ready');
    ctx.postMessage({ type: 'ready' } satisfies WorkerResponse);
  })
  .catch((err: unknown) => {
    console.error('[worker] engine init failed', err);
    ctx.postMessage({
      id: -1,
      type: 'error',
      message: `Engine init failed: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies WorkerResponse);
  });

ctx.addEventListener('message', (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'simulate') {
    Promise.all([
      engine.simulate(msg.input),
      engine.sweepImpedance(msg.input, {
        points: SWEEP_POINTS,
        spanFraction: SWEEP_SPAN_FRACTION,
      }),
    ])
      .then(([result, sweep]) => {
        ctx.postMessage({ id: msg.id, type: 'result', result, sweep } satisfies WorkerResponse);
      })
      .catch((err: unknown) => {
        ctx.postMessage({
          id: msg.id,
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        } satisfies WorkerResponse);
      });
  }
});
