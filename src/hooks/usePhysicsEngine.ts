// usePhysicsEngine — lifecycle-managed, debounced wrapper around the physics
// web worker. Pushes results into the Zustand store.

import { useEffect, useRef } from 'react';
import type { WorkerRequest, WorkerResponse } from '../workers/physicsWorker';
import { useAntennaStore, selectSimulationInput, type AntennaState } from '../store/antennaStore';
import type { SimulationResult } from '../physics/types';
import { detectLODLevel, LOD_TABLE } from './useAdaptiveLOD';

// Detected once per page load — navigator properties don't change at runtime.
const LOD_CONFIG = LOD_TABLE[detectLODLevel()];

export interface UsePhysicsEngineOptions {
  /** Debounce window in ms for rapid slider/input changes. */
  debounceMs?: number;
}

/**
 * The transformer ratio applied only in the display layer (not baked into the
 * NEC model). Mirrors SWRChart's `transformerInDisplay` rule so the adaptive
 * sweep frames its window around the SWR curve the user actually sees. Returns
 * 1 when the swept R/X already reflect what's displayed.
 */
function displayTransformerRatio(s: AntennaState): number {
  const feedlineActive = s.feedlineId !== 'none';
  const inDisplay = s.transformerEnabled && !feedlineActive && s.transformerRatio > 1;
  return inDisplay ? s.transformerRatio : 1;
}

export function usePhysicsEngine(opts: UsePhysicsEngineOptions = {}): void {
  const { debounceMs = 120 } = opts;
  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(0);
  const latestIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Vite handles this URL pattern natively for workers.
    const worker = new Worker(new URL('../workers/physicsWorker.ts', import.meta.url));
    workerRef.current = worker;

    const handler = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      if (msg.type === 'ready') {
        useAntennaStore.getState()._setEngineReady(true);
        return;
      }
      // Discard stale results: only the latest request's response is accepted.
      if (msg.type === 'result') {
        if (msg.id !== latestIdRef.current) return;
        useAntennaStore.getState()._setSimulationData(
          msg.result as SimulationResult,
          msg.sweep,
        );
      } else if (msg.type === 'error') {
        if (msg.id !== latestIdRef.current && msg.id !== -1) return;
        useAntennaStore.getState()._setError(msg.message);
      }
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
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Subscribe to input-relevant slices of state so we only trigger on real changes.
  useEffect(() => {
    const schedule = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const worker = workerRef.current;
        if (!worker) return;
        const state = useAntennaStore.getState();
        // Override the store's hardcoded pattern resolution with the
        // LOD-appropriate one: coarser on slow devices → fewer NEC-2 RP
        // evaluations → significantly faster solve on low-power hardware.
        const input = {
          ...selectSimulationInput(state),
          patternResolution: LOD_CONFIG.patternResolution,
        };
        const id = ++nextIdRef.current;
        latestIdRef.current = id;
        state._setLoading(true);
        const msg: WorkerRequest = {
          id,
          type: 'simulate',
          input,
          displayRatio: displayTransformerRatio(state),
          sweepPoints: LOD_CONFIG.sweepPoints,
          charPoints: LOD_CONFIG.charPoints,
          maxAdaptiveIter: LOD_CONFIG.maxAdaptiveIter,
          skipBroadScan: LOD_CONFIG.skipBroadScan,
        };
        worker.postMessage(msg);
      }, debounceMs);
    };

    // Initial run.
    schedule();

    const unsub = useAntennaStore.subscribe((state, prev) => {
      // Re-run only when something affecting the simulation changed.
      // JSON.stringify is intentional: selectSimulationInput returns freshly-allocated
      // arrays and object literals on every call, so shallow reference equality (Object.keys
      // + !==) would always fire. At ~3μs per call and ≤100 events/s this is negligible.
      const a = selectSimulationInput(state);
      const b = selectSimulationInput(prev);
      // Also re-sweep when the display-only balun ratio changes: it doesn't
      // alter the NEC input but it does change the SWR curve the adaptive
      // sweep frames its window around.
      if (
        JSON.stringify(a) !== JSON.stringify(b) ||
        displayTransformerRatio(state) !== displayTransformerRatio(prev)
      ) {
        schedule();
      }
    });

    return () => {
      unsub();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs]);
}
