// usePhysicsEngine — lifecycle-managed, debounced wrapper around the physics
// web worker. Pushes results into the Zustand store.

import { useEffect, useRef } from 'react';
import type { SweepWindow, WorkerRequest, WorkerResponse } from '../workers/physicsWorker';
import { useAntennaStore, selectSimulationInput, selectSwrWindow, isFeedlineActive, type AntennaState } from '../store/antennaStore';
import type { ImpedanceResult, SimulationResult, SweepPoint } from '../physics/types';
import { detectLODLevel, LOD_TABLE } from './useAdaptiveLOD';

// Detected once per page load — navigator properties don't change at runtime.
const LOD_CONFIG = LOD_TABLE[detectLODLevel()];

// Fields the solve itself writes. A store update that touches only these is
// the engine reporting back, never a model change, so it must not rebuild the
// simulation input: an invalid mesh would otherwise throw again on every
// error/loading update. Everything else is compared via selectSimulationInput,
// so a new model field cannot be missed.
const SOLVE_OUTPUT_FIELDS = new Set<keyof AntennaState>([
  'result', 'sweep', 'feedpointImpedance', 'loading', 'error', 'engineReady',
]);

function changedOnlySolveOutputs(state: AntennaState, prev: AntennaState): boolean {
  for (const key in state) {
    const k = key as keyof AntennaState;
    if (state[k] !== prev[k] && !SOLVE_OUTPUT_FIELDS.has(k)) return false;
  }
  return true;
}

// Scientific values must not change with the device's rendering budget. A 2°
// grid matches 1° sampling to within 0.001 dB in escaping efficiency and peak
// gain for every antenna type, at about a quarter of the far-field work.
const PATTERN_RESOLUTION = { thetaSteps: 91, phiSteps: 180 } as const;

export interface UsePhysicsEngineOptions {
  /** Debounce window in ms for rapid slider/input changes. */
  debounceMs?: number;
  /** Parallel solver workers. Defaults to the core count, capped per device tier. */
  workerCount?: number;
}

/**
 * Each real-ground sweep frequency costs a Sommerfeld ground table (~25 ms),
 * so the SWR sweep, not the pattern, dominates a solve. Its frequencies are
 * independent, so they are split across workers while one of them computes the
 * pattern. The page itself is idle while it waits, so one worker per core (up
 * to the device tier's cap) is fastest: in Chromium on four cores a default
 * dipole re-solve took ~590 ms on one worker, ~410 ms on three, ~300 ms on four.
 */
function defaultWorkerCount(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 1 : 1;
  return Math.max(1, Math.min(LOD_CONFIG.maxWorkers, cores));
}

/** Fewest frequencies per slice; smaller slices cost more in overhead than they save. */
const MIN_POINTS_PER_SLICE = 3;

export interface SweepSlice extends SweepWindow {
  readonly points: number;
}

/**
 * Split an evenly spaced sweep into at most `slices` contiguous, non-
 * overlapping pieces on the same frequency grid, so their concatenation is
 * the sweep a single worker would have produced.
 */
export function planSweepSlices(window: SweepWindow, points: number, slices: number): SweepSlice[] {
  const n = Math.max(1, Math.min(Math.floor(slices), Math.floor(points / MIN_POINTS_PER_SLICE)));
  if (n <= 1) return [{ ...window, points }];
  const step = (window.endMHz - window.startMHz) / (points - 1);
  const out: SweepSlice[] = [];
  let first = 0;
  for (let k = 0; k < n; k++) {
    const count = Math.floor(points / n) + (k < points % n ? 1 : 0);
    const last = first + count - 1;
    out.push({
      startMHz: window.startMHz + first * step,
      endMHz: k === n - 1 ? window.endMHz : window.startMHz + last * step,
      points: count,
    });
    first = last + 1;
  }
  return out;
}

/**
 * The transformer ratio applied only in the display layer (not baked into the
 * NEC model). Mirrors SWRChart's `transformerInDisplay` rule so the adaptive
 * sweep frames its window around the SWR curve the user actually sees. Returns
 * 1 when the swept R/X already reflect what's displayed.
 */
function displayTransformerRatio(s: AntennaState): number {
  const feedlineActive = isFeedlineActive(s);
  const inDisplay = s.transformerEnabled && !feedlineActive && s.transformerRatio > 1;
  return inDisplay ? s.transformerRatio : 1;
}

/** Replies still owed for the newest request. */
interface PendingSolve {
  readonly id: number;
  readonly kind: 'full' | 'sweep';
  /** Sweep slices in frequency order; empty when the 'result' reply carries the sweep. */
  readonly parts: (readonly SweepPoint[] | undefined)[];
  remaining: number;
  result?: SimulationResult;
  sweep?: readonly SweepPoint[];
  feedpointImpedance?: ImpedanceResult | null;
}

function handleWorkerMessage(
  msg: WorkerResponse,
  pending: PendingSolve | null,
  fullPending: boolean,
  setFullPending: (val: boolean) => void
): void {
  if (msg.type === 'ready') {
    useAntennaStore.getState()._setEngineReady(true);
    return;
  }
  if (msg.type === 'error') {
    // Discard stale results: only the latest request's response is accepted.
    if ((!pending || msg.id !== pending.id) && msg.id !== -1) return;
    // Sweep-only requests are sent only while no full solve is pending, so a
    // failure with nothing pending came from a zoom/pan re-sweep. The pattern
    // solve on screen is still valid for the current model; keep it.
    const sweepOnly = msg.id !== -1 && !fullPending;
    setFullPending(false);
    if (pending) pending.remaining = -1;
    useAntennaStore.getState()._setError(msg.message, sweepOnly);
    return;
  }
  if (!pending || msg.id !== pending.id || pending.remaining <= 0) return;
  if (msg.type === 'result') {
    pending.result = msg.result as SimulationResult;
    pending.feedpointImpedance = msg.feedpointImpedance ?? null;
    if (pending.parts.length === 0) pending.sweep = msg.sweep;
  } else {
    if (pending.parts.length === 0) pending.sweep = msg.sweep;
    else pending.parts[msg.part ?? 0] = msg.sweep;
  }
  pending.remaining--;
  if (pending.remaining > 0) return;
  const sweep = pending.parts.length > 0 ? pending.parts.flatMap((part) => part ?? []) : pending.sweep ?? [];
  if (pending.kind === 'full') {
    setFullPending(false);
    useAntennaStore.getState()._setSimulationData(pending.result!, sweep, pending.feedpointImpedance ?? null);
  } else {
    useAntennaStore.getState()._setSweep(sweep);
  }
}

function buildWorkerRequests(
  requestedKind: 'full' | 'sweep',
  fullPending: boolean,
  state: ReturnType<typeof useAntennaStore.getState>,
  id: number,
  workerCount: number,
): { pending: PendingSolve; messages: { worker: number; msg: WorkerRequest }[] } {
  const input = {
    ...selectSimulationInput(state),
    patternResolution: PATTERN_RESOLUTION,
  };
  const window = selectSwrWindow(state);
  const displayRatio = displayTransformerRatio(state);
  const sweepPoints = LOD_CONFIG.sweepPoints;

  // When a transformer is fitted over a feedline, the main solve bakes the
  // transformer into the NEC model, so its rig-end impedance depends on the
  // applied ratio and can't be back-solved into a stable Match suggestion.
  // Solve the bare antenna feedpoint (feedline + transformer stripped) so the
  // suggestion has a transformer-independent reference to match to the line.
  const feedpointInput =
    state.transformerEnabled && isFeedlineActive(state)
      ? selectSimulationInput({ ...state, feedlineId: 'none', transformerEnabled: false })
      : undefined;

  // Only the view window changed → re-sweep alone, but upgrade to a full
  // solve if a pattern result is still pending (otherwise it would be
  // discarded as stale, leaving the radiation pattern out of date).
  const kind = requestedKind === 'sweep' && !fullPending ? 'sweep' : 'full';

  // With three or more workers the first computes only the pattern and the
  // rest share the sweep; with two, both share it after the pattern.
  const sweepWorkers = kind === 'full' && workerCount >= 3
    ? Array.from({ length: workerCount - 1 }, (_, i) => i + 1)
    : Array.from({ length: workerCount }, (_, i) => i);
  const slices = workerCount > 1 ? planSweepSlices(window, sweepPoints, sweepWorkers.length) : [];
  const split = slices.length > 1;

  const messages: { worker: number; msg: WorkerRequest }[] = [];
  if (kind === 'full') {
    messages.push({ worker: 0, msg: {
      id, type: 'simulate', input, feedpointInput, displayRatio, sweepPoints, window,
      ...(split ? { skipSweep: true } : {}),
    } });
  }
  if (split) {
    slices.forEach((slice, part) => {
      messages.push({ worker: sweepWorkers[part]!, msg: {
        id, type: 'sweep', input, displayRatio, sweepPoints: slice.points,
        window: { startMHz: slice.startMHz, endMHz: slice.endMHz }, part,
      } });
    });
  } else if (kind === 'sweep') {
    messages.push({ worker: 0, msg: { id, type: 'sweep', input, displayRatio, sweepPoints, window } });
  }
  return {
    pending: {
      id, kind,
      parts: split ? new Array(slices.length).fill(undefined) : [],
      remaining: messages.length,
    },
    messages,
  };
}

function useWorkerLifecycle(
  workersRef: React.MutableRefObject<Worker[]>,
  pendingRef: React.MutableRefObject<PendingSolve | null>,
  fullPendingRef: React.MutableRefObject<boolean>,
  timerRef: React.MutableRefObject<number | null>,
  workerCount: number,
): void {
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const workers: Worker[] = [];
    for (let i = 0; i < workerCount; i++) {
      // Vite handles this URL pattern natively for workers.
      const worker = new Worker(new URL('../workers/physicsWorker.ts', import.meta.url));
      workers.push(worker);

      const handler = (ev: MessageEvent<WorkerResponse>) => {
        handleWorkerMessage(ev.data, pendingRef.current, fullPendingRef.current, (val) => {
          fullPendingRef.current = val;
        });
      };
      const errHandler = (ev: ErrorEvent) => {
        if (import.meta.env.DEV) {
          console.error('[usePhysicsEngine] worker error', ev.message, ev.error);
        }
        useAntennaStore.getState()._setError(`Worker error: ${ev.message}`);
      };
      const rejectHandler = (ev: MessageEvent) => {
        if (import.meta.env.DEV) {
          console.error('[usePhysicsEngine] worker messageerror', ev);
        }
      };
      worker.addEventListener('message', handler);
      worker.addEventListener('error', errHandler);
      worker.addEventListener('messageerror', rejectHandler);
      cleanups.push(() => {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errHandler);
        worker.removeEventListener('messageerror', rejectHandler);
        worker.terminate();
      });
    }
    workersRef.current = workers;

    return () => {
      for (const cleanup of cleanups) cleanup();
      workersRef.current = [];
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [pendingRef, fullPendingRef, workersRef, timerRef, workerCount]);
}

function usePhysicsScheduler(
  workersRef: React.MutableRefObject<Worker[]>,
  nextIdRef: React.MutableRefObject<number>,
  pendingRef: React.MutableRefObject<PendingSolve | null>,
  fullPendingRef: React.MutableRefObject<boolean>,
  pendingKindRef: React.MutableRefObject<'full' | 'sweep' | null>,
  timerRef: React.MutableRefObject<number | null>,
  debounceMs: number
): void {
  // Subscribe to input-relevant slices of state so we only trigger on real changes.
  useEffect(() => {
    const flush = () => {
      const workers = workersRef.current;
      if (workers.length === 0) return;
      const requested = pendingKindRef.current ?? 'full';
      pendingKindRef.current = null;
      const state = useAntennaStore.getState();

      const id = ++nextIdRef.current;
      // Any reply to an older request is now stale.
      pendingRef.current = null;
      state._setLoading(true);

      try {
        const { pending, messages } = buildWorkerRequests(requested, fullPendingRef.current, state, id, workers.length);
        // The previous result stays on screen under the "Solving…" overlay
        // (loading is set above) until this one lands, so the display does
        // not blank on every slider tick.
        if (pending.kind === 'full') fullPendingRef.current = true;
        pendingRef.current = pending;
        for (const { worker, msg } of messages) workers[worker]!.postMessage(msg);
      } catch (error) {
        fullPendingRef.current = false;
        state._setError(error instanceof Error ? error.message : String(error));
      }
    };

    const schedule = (kind: 'full' | 'sweep') => {
      // 'full' always wins over a pending 'sweep' in the same debounce window.
      if (kind === 'full' || pendingKindRef.current === null) {
        pendingKindRef.current = kind;
      }
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, debounceMs);
    };

    // Initial run (full solve).
    schedule('full');

    const unsub = useAntennaStore.subscribe((state, prev) => {
      if (!changedOnlySolveOutputs(state, prev)) {
        try {
          const a = selectSimulationInput(state);
          const b = selectSimulationInput(prev);
          if (JSON.stringify(a) !== JSON.stringify(b) ||
              displayTransformerRatio(state) !== displayTransformerRatio(prev)) {
            schedule('full');
            return;
          }
        } catch {
          schedule('full');
          return;
        }
      }
      // Only the SWR view window changed (zoom/pan) → cheap sweep-only recompute.
      const w = selectSwrWindow(state);
      const pw = selectSwrWindow(prev);
      if (w.startMHz !== pw.startMHz || w.endMHz !== pw.endMHz) {
        schedule('sweep');
      }
    });

    return () => {
      unsub();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs, fullPendingRef, pendingRef, nextIdRef, pendingKindRef, timerRef, workersRef]);
}

export function usePhysicsEngine(opts: UsePhysicsEngineOptions = {}): void {
  const { debounceMs = 120 } = opts;
  const workerCount = Math.max(1, Math.floor(opts.workerCount ?? defaultWorkerCount()));
  const workersRef = useRef<Worker[]>([]);
  const nextIdRef = useRef(0);
  // Replies still owed for the newest request; null once it has landed or failed.
  const pendingRef = useRef<PendingSolve | null>(null);
  // True while a full simulate is in flight. Used to upgrade a sweep-only
  // (zoom/pan) request to a full one when a pattern solve hasn't landed yet,
  // so the in-flight pattern result isn't discarded as stale.
  const fullPendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  // Highest-priority work requested during the current debounce window:
  // 'full' (geometry/frequency changed) wins over 'sweep' (view window only).
  const pendingKindRef = useRef<'full' | 'sweep' | null>(null);

  useWorkerLifecycle(workersRef, pendingRef, fullPendingRef, timerRef, workerCount);
  usePhysicsScheduler(
    workersRef,
    nextIdRef,
    pendingRef,
    fullPendingRef,
    pendingKindRef,
    timerRef,
    debounceMs
  );
}
