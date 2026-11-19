// Physics worker — hosts the NEC-2 Wasm solver off the main thread.
//
// Protocol:
//   → main posts { id, type: 'simulate', input, feedpointInput?, displayRatio?,
//                  sweepPoints?, window?, skipSweep? }
//              or { id, type: 'sweep', input, window, sweepPoints?, part? }
//   ← worker posts { id, type: 'result', result, sweep, feedpointImpedance? },
//                  { id, type: 'sweep', sweep, part? } or { id, type: 'error', message }
//
// The worker also emits { type: 'ready' } when the engine has initialised.
//
// Several of these workers can run side by side: the main thread hands the
// pattern solve to one and splits the SWR sweep's frequencies across the rest
// (`part` says which slice a reply carries). Request ids only increase, and the
// main thread accepts only the newest, so a queued request that has been
// superseded before it starts is dropped unanswered.

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
      /** Leave the sweep to other workers; the reply carries an empty sweep. */
      skipSweep?: boolean;
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
      /** Index of this slice when one sweep is split across workers. */
      part?: number;
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
  | { id: number; type: 'sweep'; sweep: readonly SweepPoint[]; part?: number }
  | { id: number; type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

// Surface worker-side errors explicitly so they don't vanish silently.
self.addEventListener('error', (ev) => {
  if (import.meta.env.DEV) {
    console.error('[worker error]', ev.message, ev.error);
  }
});
self.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
  if (import.meta.env.DEV) {
    console.error('[worker unhandledrejection]', ev.reason);
  }
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
    if (import.meta.env.DEV) console.error('[worker] engine init failed', err);
    ctx.postMessage({
      id: -1,
      type: 'error',
      message: `Engine init failed: ${err instanceof Error ? err.message : String(err)}`,
    } satisfies WorkerResponse);
  });

function runRequest(msg: WorkerRequest): Promise<void> {
  if (msg.type === 'simulate') {
    const feedpointInput = msg.feedpointInput;
    return Promise.all([
      engine.simulate(msg.input),
      msg.skipSweep
        ? Promise.resolve([] as SweepPoint[])
        : engine.sweepImpedance(msg.input, {
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
  }
  return engine
    .sweepImpedance(msg.input, {
      points: msg.sweepPoints,
      displayRatio: msg.displayRatio,
      window: msg.window,
    })
    .then((sweep) => {
      ctx.postMessage({ id: msg.id, type: 'sweep', sweep, part: msg.part } satisfies WorkerResponse);
    })
    .catch((err: unknown) => {
      ctx.postMessage({
        id: msg.id,
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerResponse);
    });
}

// Requests run one after another. While a solve is running, slider drags can
// queue several newer requests; only the newest is still wanted, so each
// request checks on reaching the front of the queue whether it was superseded.
let newestId = -Infinity;
let queue: Promise<void> = Promise.resolve();

ctx.addEventListener('message', (ev: MessageEvent<WorkerRequest>) => {
  // Security: drop cross-origin messages
  if (ev.origin && ev.origin !== '' && ev.origin !== self.location.origin) {
    if (import.meta.env.DEV) console.warn('[worker] dropping cross-origin message from', ev.origin);
    return;
  }
  const msg = ev.data;
  if (msg.type !== 'simulate' && msg.type !== 'sweep') return;
  newestId = Math.max(newestId, msg.id);
  queue = queue.then(() => (msg.id < newestId ? undefined : runRequest(msg)));
});
