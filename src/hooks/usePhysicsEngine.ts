// usePhysicsEngine — lifecycle-managed, debounced wrapper around the physics
// web worker. Pushes results into the Zustand store.

import { useEffect, useRef } from 'react';
import type { WorkerRequest, WorkerResponse } from '../workers/physicsWorker';
import { useAntennaStore, selectSimulationInput, selectSwrWindow } from '../store/antennaStore';
import type { SimulationResult } from '../physics/types';
import { detectLODLevel, LOD_TABLE } from './useAdaptiveLOD';

// Detected once per page load — navigator properties don't change at runtime.
const LOD_CONFIG = LOD_TABLE[detectLODLevel()];

export interface UsePhysicsEngineOptions {
  /** Debounce window in ms for rapid slider/input changes. */
  debounceMs?: number;
}

interface TransformerState {
  feedlineId: string;
  transformerEnabled: boolean;
  transformerRatio: number;
}

/**
 * The transformer ratio applied only in the display layer (not baked into the
 * NEC model). Mirrors SWRChart's `transformerInDisplay` rule so the adaptive
 * sweep frames its window around the SWR curve the user actually sees. Returns
 * 1 when the swept R/X already reflect what's displayed.
 */
function displayTransformerRatio(s: TransformerState): number {
  const feedlineActive = s.feedlineId !== 'none';
  const inDisplay = s.transformerEnabled && !feedlineActive && s.transformerRatio > 1;
  return inDisplay ? s.transformerRatio : 1;
}

function handleWorkerMessage(
  msg: WorkerResponse,
  latestId: number,
  setFullPending: (val: boolean) => void
): void {
  if (msg.type === 'ready') {
    useAntennaStore.getState()._setEngineReady(true);
    return;
  }
  // Discard stale results: only the latest request's response is accepted.
  if (msg.type === 'result') {
    if (msg.id !== latestId) return;
    setFullPending(false);
    useAntennaStore.getState()._setSimulationData(
      msg.result as SimulationResult,
      msg.sweep,
      msg.feedpointImpedance ?? null,
    );
  } else if (msg.type === 'sweep') {
    if (msg.id !== latestId) return;
    useAntennaStore.getState()._setSweep(msg.sweep);
  } else if (msg.type === 'error') {
    if (msg.id !== latestId && msg.id !== -1) return;
    setFullPending(false);
    useAntennaStore.getState()._setError(msg.message);
  }
}

function buildWorkerRequest(
  requestedKind: 'full' | 'sweep',
  fullPending: boolean,
  state: ReturnType<typeof useAntennaStore.getState>,
  id: number
): WorkerRequest {
  const input = {
    ...selectSimulationInput(state),
    patternResolution: LOD_CONFIG.patternResolution,
  };
  const window = selectSwrWindow(state);
  const displayRatio = displayTransformerRatio(state);

  // When a transformer is fitted over a feedline, the main solve bakes the
  // transformer into the NEC model, so its rig-end impedance depends on the
  // applied ratio and can't be back-solved into a stable Match suggestion.
  // Solve the bare antenna feedpoint (feedline + transformer stripped) so the
  // suggestion has a transformer-independent reference to match to the line.
  const feedpointInput =
    state.transformerEnabled && state.feedlineId !== 'none'
      ? selectSimulationInput({ ...state, feedlineId: 'none', transformerEnabled: false })
      : undefined;

  // Only the view window changed → re-sweep alone, but upgrade to a full
  // solve if a pattern result is still pending (otherwise it would be
  // discarded as stale, leaving the radiation pattern out of date).
  const kind = requestedKind === 'sweep' && !fullPending ? 'sweep' : 'full';

  if (kind === 'sweep') {
    return {
      id,
      type: 'sweep',
      input,
      displayRatio,
      sweepPoints: LOD_CONFIG.sweepPoints,
      window,
    };
  }

  return {
    id,
    type: 'simulate',
    input,
    feedpointInput,
    displayRatio,
    sweepPoints: LOD_CONFIG.sweepPoints,
    window,
  };
}

function useWorkerLifecycle(
  workerRef: React.MutableRefObject<Worker | null>,
  latestIdRef: React.MutableRefObject<number>,
  fullPendingRef: React.MutableRefObject<boolean>,
  timerRef: React.MutableRefObject<number | null>
): void {
  useEffect(() => {
    // Vite handles this URL pattern natively for workers.
    const worker = new Worker(new URL('../workers/physicsWorker.ts', import.meta.url));
    workerRef.current = worker;

    const handler = (ev: MessageEvent<WorkerResponse>) => {
      handleWorkerMessage(ev.data, latestIdRef.current, (val) => {
        fullPendingRef.current = val;
      });
    };
    worker.addEventListener('message', handler);

    const errHandler = (ev: ErrorEvent) => {
      console.error('[usePhysicsEngine] worker error', ev.message, ev.error);
      useAntennaStore.getState()._setError(`Worker error: ${ev.message}`);
    };
    const rejectHandler = (ev: MessageEvent) => {
      console.error('[usePhysicsEngine] worker messageerror', ev);
    };
    worker.addEventListener('error', errHandler);
    worker.addEventListener('messageerror', rejectHandler);

    return () => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errHandler);
      worker.removeEventListener('messageerror', rejectHandler);
      worker.terminate();
      workerRef.current = null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [latestIdRef, fullPendingRef, workerRef, timerRef]);
}

function usePhysicsScheduler(
  workerRef: React.MutableRefObject<Worker | null>,
  nextIdRef: React.MutableRefObject<number>,
  latestIdRef: React.MutableRefObject<number>,
  fullPendingRef: React.MutableRefObject<boolean>,
  pendingKindRef: React.MutableRefObject<'full' | 'sweep' | null>,
  timerRef: React.MutableRefObject<number | null>,
  debounceMs: number
): void {
  // Subscribe to input-relevant slices of state so we only trigger on real changes.
  useEffect(() => {
    const flush = () => {
      const worker = workerRef.current;
      if (!worker) return;
      const requested = pendingKindRef.current ?? 'full';
      pendingKindRef.current = null;
      const state = useAntennaStore.getState();

      const id = ++nextIdRef.current;
      latestIdRef.current = id;
      state._setLoading(true);

      const msg = buildWorkerRequest(requested, fullPendingRef.current, state, id);
      if (msg.type === 'simulate') {
        fullPendingRef.current = true;
      }
      worker.postMessage(msg);
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
      // Re-run a full solve when something affecting the NEC simulation changed.
      // JSON.stringify is intentional: selectSimulationInput returns freshly-allocated
      // arrays and object literals on every call, so shallow reference equality (Object.keys
      // + !==) would always fire. At ~3μs per call and ≤100 events/s this is negligible.
      const a = selectSimulationInput(state);
      const b = selectSimulationInput(prev);
      // Also re-solve when the display-only balun ratio changes: it doesn't
      // alter the NEC input but it does change the SWR curve the user sees.
      if (
        JSON.stringify(a) !== JSON.stringify(b) ||
        displayTransformerRatio(state) !== displayTransformerRatio(prev)
      ) {
        schedule('full');
        return;
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
  }, [debounceMs, fullPendingRef, latestIdRef, nextIdRef, pendingKindRef, timerRef, workerRef]);
}

export function usePhysicsEngine(opts: UsePhysicsEngineOptions = {}): void {
  const { debounceMs = 120 } = opts;
  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(0);
  const latestIdRef = useRef(0);
  // True while a full simulate is in flight. Used to upgrade a sweep-only
  // (zoom/pan) request to a full one when a pattern solve hasn't landed yet,
  // so the in-flight pattern result isn't discarded as stale.
  const fullPendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  // Highest-priority work requested during the current debounce window:
  // 'full' (geometry/frequency changed) wins over 'sweep' (view window only).
  const pendingKindRef = useRef<'full' | 'sweep' | null>(null);

  useWorkerLifecycle(workerRef, latestIdRef, fullPendingRef, timerRef);
  usePhysicsScheduler(
    workerRef,
    nextIdRef,
    latestIdRef,
    fullPendingRef,
    pendingKindRef,
    timerRef,
    debounceMs
  );
}
