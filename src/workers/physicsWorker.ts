// Physics worker — hosts the NEC-2 Wasm solver off the main thread.
//
// Protocol:
//   → main posts { id, type: 'simulate', input, displayRatio?, sweepPoints?,
//                  charPoints?, maxAdaptiveIter?, skipBroadScan? }
//   ← worker posts { id, type: 'result', result } or { id, type: 'error', message }
//
// The worker also emits { type: 'ready' } when the engine has initialised.

/// <reference lib="webworker" />

import { Nec2Engine } from '../physics/nec2Engine';
import type { SimulationInput, SimulationResult, SweepPoint } from '../physics/types';

export type WorkerRequest =
  | {
      id: number;
      type: 'simulate';
      input: SimulationInput;
      displayRatio?: number;
      sweepPoints?: number;
      charPoints?: number;
      maxAdaptiveIter?: number;
      skipBroadScan?: boolean;
    };

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


const engine = new Nec2Engine({
  // The worker is served from the same origin as the app, so "/" resolves
  // to the same host. This keeps the wasm file path stable.
  baseUrl: '/',
});

engine
  .init()
  .then(() => {
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
        points: msg.sweepPoints,
        displayRatio: msg.displayRatio,
        charPoints: msg.charPoints,
        maxIter: msg.maxAdaptiveIter,
        skipBroadScan: msg.skipBroadScan,
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
