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
import type { SimulationInput, SimulationResult, SweepPoint, ImpedanceResult } from '../physics/types';

/** Absolute frequency window the SWR sweep samples across. */
export interface SweepWindow {
  startMHz: number;
  endMHz: number;
}

export type WorkerRequest =
  | {
      id: number;
      type: 'simulate';
      input: SimulationInput;
      /**
       * Optional bare-antenna input (no feedline/transformer) whose feedpoint
       * impedance is solved alongside the main result. It gives the Match
       * suggestion a transformer-independent reference so the suggested ratio
       * doesn't drift each time it is applied.
       */
      feedpointInput?: SimulationInput;
      displayRatio?: number;
      sweepPoints?: number;
      window?: SweepWindow;
    }
  // Sweep-only recompute: re-runs just the impedance sweep over a new window
  // (zoom/pan) without recomputing the radiation pattern. Much cheaper than a
  // full simulate when only the SWR view window changed.
  | {
      id: number;
      type: 'sweep';
      input: SimulationInput;
      displayRatio?: number;
      sweepPoints?: number;
      window: SweepWindow;
    };

export type WorkerResponse =
  | { type: 'ready' }
  | {
      id: number;
      type: 'result';
      result: SimulationResult;
      sweep: readonly SweepPoint[];
      /** Bare-antenna feedpoint impedance, present when `feedpointInput` was sent. */
      feedpointImpedance?: ImpedanceResult;
    }
  | { id: number; type: 'sweep'; sweep: readonly SweepPoint[] }
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
    const feedpointInput = msg.feedpointInput;
    Promise.all([
      engine.simulate(msg.input),
      engine.sweepImpedance(msg.input, {
        points: msg.sweepPoints,
        displayRatio: msg.displayRatio,
        window: msg.window,
      }),
      feedpointInput
        ? engine.feedpointImpedance(feedpointInput)
        : Promise.resolve(undefined),
    ])
      .then(([result, sweep, feedpointImpedance]) => {
        ctx.postMessage({
          id: msg.id,
          type: 'result',
          result,
          sweep,
          feedpointImpedance,
        } satisfies WorkerResponse);
      })
      .catch((err: unknown) => {
        ctx.postMessage({
          id: msg.id,
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        } satisfies WorkerResponse);
      });
  } else if (msg.type === 'sweep') {
    engine
      .sweepImpedance(msg.input, {
        points: msg.sweepPoints,
        displayRatio: msg.displayRatio,
        window: msg.window,
      })
      .then((sweep) => {
        ctx.postMessage({ id: msg.id, type: 'sweep', sweep } satisfies WorkerResponse);
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
