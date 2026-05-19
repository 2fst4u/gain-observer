// usePhysicsEngine — lifecycle-managed, debounced wrapper around the physics
// web worker. Pushes results into the Zustand store.

import { useEffect, useRef } from 'react';
import type { WorkerRequest, WorkerResponse } from '../workers/physicsWorker';
import { useAntennaStore, selectSimulationInput } from '../store/antennaStore';
import type { SimulationResult } from '../physics/types';

export interface UsePhysicsEngineOptions {
  /** Debounce window in ms for rapid slider/input changes. */
  debounceMs?: number;
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
        const input = selectSimulationInput(useAntennaStore.getState());
        const id = ++nextIdRef.current;
        latestIdRef.current = id;
        useAntennaStore.getState()._setLoading(true);
        const msg: WorkerRequest = { id, type: 'simulate', input };
        worker.postMessage(msg);
      }, debounceMs);
    };

    // Initial run.
    schedule();

    const unsub = useAntennaStore.subscribe((state, prev) => {
      // Re-run only when something affecting the simulation changed.
      const a = selectSimulationInput(state);
      const b = selectSimulationInput(prev);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        schedule();
      }
    });

    return () => {
      unsub();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs]);
}
