import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { planSweepSlices, usePhysicsEngine } from '../src/hooks/usePhysicsEngine';
import { useAntennaStore } from '../src/store/antennaStore';
import { makeSimulationResult } from './helpers/factories';

describe('usePhysicsEngine', () => {
  let workerInstances: unknown[] = [];

  class MockWorker {
    postMessage = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    terminate = vi.fn();

    constructor() {
      workerInstances.push(this);
    }
  }

  beforeEach(() => {
    workerInstances = [];
    vi.stubGlobal('Worker', MockWorker);
    // These cases exercise the single-worker protocol; the pool has its own.
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(1);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports invalid meshes without throwing from a store listener or retrying forever', () => {
    const original = useAntennaStore.getState();
    const { unmount } = renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;
    act(() => { vi.advanceTimersByTime(100); });
    worker.postMessage.mockClear();
    act(() => {
      useAntennaStore.setState({ antennaType: 'folded-dipole', length: 1000,
        wireRadius: 0.001, foldedDipoleAperture: 0.3 });
      vi.advanceTimersByTime(100);
    });
    expect(useAntennaStore.getState().error).toMatch(/mesh/i);
    expect(useAntennaStore.getState().loading).toBe(false);
    expect(useAntennaStore.getState().result).toBeNull();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    unmount();
    useAntennaStore.setState(original, true);
  });

  function startWithResult() {
    const original = useAntennaStore.getState();
    const hook = renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;
    const onMessage = worker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message')![1];
    act(() => { vi.advanceTimersByTime(100); });
    const result = makeSimulationResult();
    const sweep = [{ frequencyMHz: 7.1, R: 50, X: 0, swr: 1 }];
    act(() => {
      onMessage({ data: { id: worker.postMessage.mock.calls[0][0].id, type: 'result', result, sweep } });
    });
    worker.postMessage.mockClear();
    const finish = () => { hook.unmount(); useAntennaStore.setState(original, true); };
    return { worker, onMessage, result, finish };
  }

  it('keeps the previous result on screen while a new full solve runs', () => {
    const { worker, result, finish } = startWithResult();
    act(() => {
      useAntennaStore.getState().setHeight(useAntennaStore.getState().height + 1);
      vi.advanceTimersByTime(100);
    });
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'simulate' }));
    expect(useAntennaStore.getState().loading).toBe(true);
    expect(useAntennaStore.getState().result).toBe(result);
    finish();
  });

  it('keeps a valid pattern result when only a zoom/pan re-sweep fails', () => {
    const { worker, onMessage, result, finish } = startWithResult();
    act(() => {
      useAntennaStore.setState({ swrViewCenterMHz: useAntennaStore.getState().swrViewCenterMHz + 0.5 });
      vi.advanceTimersByTime(100);
    });
    const request = worker.postMessage.mock.calls[0][0];
    expect(request.type).toBe('sweep');
    act(() => { onMessage({ data: { id: request.id, type: 'error', message: 'Sweep failed' } }); });
    expect(useAntennaStore.getState().error).toBe('Sweep failed');
    expect(useAntennaStore.getState().result).toBe(result);
    finish();
  });

  it('clears the result when a full solve fails', () => {
    const { worker, onMessage, finish } = startWithResult();
    act(() => {
      useAntennaStore.getState().setHeight(useAntennaStore.getState().height + 1);
      vi.advanceTimersByTime(100);
    });
    const request = worker.postMessage.mock.calls[0][0];
    expect(request.type).toBe('simulate');
    act(() => { onMessage({ data: { id: request.id, type: 'error', message: 'Solve failed' } }); });
    expect(useAntennaStore.getState().result).toBeNull();
    expect(useAntennaStore.getState().sweep).toEqual([]);
    finish();
  });

  it('initializes worker and schedules initial simulation', () => {
    const { unmount } = renderHook(() => usePhysicsEngine({ debounceMs: 100 }));

    expect(workerInstances).toHaveLength(1);

    const worker = workerInstances[0] as MockWorker;
    expect(worker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(worker.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(worker.addEventListener).toHaveBeenCalledWith('messageerror', expect.any(Function));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'simulate',
      input: expect.objectContaining({ patternResolution: { thetaSteps: 91, phiSteps: 180 } }),
    }));

    unmount();
    expect(worker.terminate).toHaveBeenCalled();
    expect(worker.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(worker.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(worker.removeEventListener).toHaveBeenCalledWith('messageerror', expect.any(Function));
  });

  it('handles state changes via store subscription', () => {
    renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Initial postMessage
    expect(worker.postMessage).toHaveBeenCalledTimes(1);

    // Trigger state change
    act(() => {
      useAntennaStore.getState().setFrequency(14.0);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should post message again
    expect(worker.postMessage).toHaveBeenCalledTimes(2);

    // Test discarding identical state changes
    worker.postMessage.mockClear();
    act(() => {
      // Trigger update but state doesn't actually change the simulation input
      useAntennaStore.setState((state) => ({ ...state }));
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(worker.postMessage).not.toHaveBeenCalled();
  });

  it('handles worker messages properly', () => {
    renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;

    // Get the message handler
    const messageHandler = worker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message'
    )![1];

    // Mock ready
    act(() => {
      messageHandler({ data: { type: 'ready' } });
    });
    expect(useAntennaStore.getState().engineReady).toBe(true);

    // Initial postMessage schedules a task and sets loading to true
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const initialPostMessage = worker.postMessage.mock.calls[0][0];
    const initialId = initialPostMessage.id;

    // Mock result for current simulation
    act(() => {
      messageHandler({
        data: {
          id: initialId,
          type: 'result',
          result: { test: true },
          sweep: []
        }
      });
    });

    expect(useAntennaStore.getState().loading).toBe(false);

    // Mock error for current simulation
    act(() => {
      messageHandler({
        data: {
          id: initialId,
          type: 'error',
          message: 'Test Error'
        }
      });
    });

    expect(useAntennaStore.getState().error).toBe('Test Error');

    // Discard stale results
    useAntennaStore.getState()._setLoading(true);
    act(() => {
      messageHandler({
        data: {
          id: initialId - 1, // Stale ID
          type: 'result',
          result: { test: true },
          sweep: []
        }
      });
    });
    // Loading state shouldn't change
    expect(useAntennaStore.getState().loading).toBe(true);

    // Discard stale errors (unless id is -1)
    useAntennaStore.getState()._setError(null);
    act(() => {
      messageHandler({
        data: {
          id: initialId - 1, // Stale ID
          type: 'error',
          message: 'Stale Error'
        }
      });
    });
    expect(useAntennaStore.getState().error).toBe(null);

    // Accept -1 errors
    act(() => {
      messageHandler({
        data: {
          id: -1,
          type: 'error',
          message: 'Init Error'
        }
      });
    });
    expect(useAntennaStore.getState().error).toBe('Init Error');
  });

  it('sends a sweep-only message when only the SWR view window changes', () => {
    renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;
    const messageHandler = worker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'message'
    )![1];

    // Initial full solve.
    act(() => { vi.advanceTimersByTime(100); });
    const initial = worker.postMessage.mock.calls[0][0];
    expect(initial.type).toBe('simulate');
    expect(initial.window).toEqual(expect.objectContaining({
      startMHz: expect.any(Number),
      endMHz: expect.any(Number),
    }));

    // Resolve it so no full solve is in flight.
    act(() => {
      messageHandler({ data: { id: initial.id, type: 'result', result: { test: true }, sweep: [] } });
    });

    // Pure zoom/pan → cheap sweep-only recompute (no pattern re-solve).
    worker.postMessage.mockClear();
    act(() => { useAntennaStore.getState().panSwrView(0.25); });
    act(() => { vi.advanceTimersByTime(100); });

    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    const msg = worker.postMessage.mock.calls[0][0];
    expect(msg.type).toBe('sweep');
    expect(msg.window).toEqual(expect.objectContaining({
      startMHz: expect.any(Number),
      endMHz: expect.any(Number),
    }));

    // A sweep result updates the sweep without touching the pattern result.
    act(() => {
      messageHandler({ data: { id: msg.id, type: 'sweep', sweep: [{ frequencyMHz: 7, R: 50, X: 0, swr: 1.1 }] } });
    });
    expect(useAntennaStore.getState().sweep).toHaveLength(1);
    expect(useAntennaStore.getState().result).toEqual({ test: true });
  });

  it('upgrades a zoom to a full solve while a pattern solve is still in flight', () => {
    renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;

    // Initial full solve dispatched but NOT yet resolved (pattern still pending).
    act(() => { vi.advanceTimersByTime(100); });
    expect(worker.postMessage.mock.calls[0][0].type).toBe('simulate');

    // Zoom before the pattern lands → must re-solve fully, else the in-flight
    // pattern result would be discarded as stale.
    worker.postMessage.mockClear();
    act(() => { useAntennaStore.getState().zoomSwrView(0.5); });
    act(() => { vi.advanceTimersByTime(100); });

    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    expect(worker.postMessage.mock.calls[0][0].type).toBe('simulate');
  });

  it('handles worker errors properly', () => {
    renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;

    // Get the error handler
    const errorHandler = worker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'error'
    )![1];

    // Get the messageerror handler
    const messageErrorHandler = worker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'messageerror'
    )![1];

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => {
      errorHandler({ message: 'worker crashed', error: new Error('worker crashed') });
    });

    expect(useAntennaStore.getState().error).toBe('Worker error: worker crashed');
    expect(consoleErrorSpy).toHaveBeenCalled();

    act(() => {
      messageErrorHandler({ data: 'failed to deserialize' });
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  describe('parallel sweep across a worker pool', () => {
    type Posted = { id: number; type: string; part?: number; skipSweep?: boolean;
      window?: { startMHz: number; endMHz: number }; sweepPoints?: number };
    const posted = (w: MockWorker): Posted[] => w.postMessage.mock.calls.map((c: unknown[]) => c[0] as Posted);
    const onMessage = (w: MockWorker) =>
      w.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'message')![1] as (ev: unknown) => void;
    const point = (f: number) => ({ frequencyMHz: f, R: 50, X: 0, swr: 1 });

    it('slices a sweep into contiguous pieces of the same frequency grid', () => {
      const window = { startMHz: 6.4, endMHz: 7.8 };
      const slices = planSweepSlices(window, 15, 4);
      expect(slices.map((s) => s.points)).toEqual([4, 4, 4, 3]);
      const step = 1.4 / 14;
      const freqs = slices.flatMap((s) => Array.from({ length: s.points }, (_, i) =>
        s.startMHz + i * (s.endMHz - s.startMHz) / (s.points - 1)));
      freqs.forEach((f, i) => expect(f).toBeCloseTo(6.4 + i * step, 10));
      expect(slices.at(-1)!.endMHz).toBe(7.8);
      // Never slices thinner than three points.
      expect(planSweepSlices(window, 15, 10)).toHaveLength(5);
      expect(planSweepSlices(window, 5, 3)).toEqual([{ ...window, points: 5 }]);
    });

    it('solves the pattern on one worker, the sweep on the rest, and joins them in order', () => {
      const original = useAntennaStore.getState();
      const hook = renderHook(() => usePhysicsEngine({ debounceMs: 100, workerCount: 3 }));
      expect(workerInstances).toHaveLength(3);
      const [w0, w1, w2] = workerInstances as MockWorker[];
      act(() => { vi.advanceTimersByTime(100); });

      const [simulate] = posted(w0!);
      expect(simulate).toEqual(expect.objectContaining({ type: 'simulate', skipSweep: true }));
      const [a] = posted(w1!);
      const [b] = posted(w2!);
      expect([a!.type, a!.part, b!.type, b!.part]).toEqual(['sweep', 0, 'sweep', 1]);
      expect(a!.id).toBe(simulate!.id);
      expect(a!.sweepPoints! + b!.sweepPoints!).toBeGreaterThan(0);

      const result = makeSimulationResult();
      // Replies arrive out of order; nothing is published until all are in.
      act(() => { onMessage(w2!)({ data: { id: b!.id, type: 'sweep', part: 1, sweep: [point(7.2)] } }); });
      act(() => { onMessage(w0!)({ data: { id: simulate!.id, type: 'result', result, sweep: [] } }); });
      expect(useAntennaStore.getState().loading).toBe(true);
      act(() => { onMessage(w1!)({ data: { id: a!.id, type: 'sweep', part: 0, sweep: [point(7.0)] } }); });

      const state = useAntennaStore.getState();
      expect(state.loading).toBe(false);
      expect(state.result).toBe(result);
      expect(state.sweep.map((p) => p.frequencyMHz)).toEqual([7.0, 7.2]);
      hook.unmount();
      useAntennaStore.setState(original, true);
    });

    it('ignores stale slices and stops collecting after any slice fails', () => {
      const original = useAntennaStore.getState();
      const hook = renderHook(() => usePhysicsEngine({ debounceMs: 100, workerCount: 3 }));
      const [w0, w1, w2] = workerInstances as MockWorker[];
      act(() => { vi.advanceTimersByTime(100); });
      const first = posted(w1!)[0]!;
      act(() => {
        useAntennaStore.getState().setHeight(useAntennaStore.getState().height + 1);
        vi.advanceTimersByTime(100);
      });
      const simulate = posted(w0!).at(-1)!;
      const a = posted(w1!).at(-1)!;
      const b = posted(w2!).at(-1)!;
      expect(simulate.id).toBeGreaterThan(first.id);

      act(() => {
        onMessage(w1!)({ data: { id: first.id, type: 'sweep', part: 0, sweep: [point(1)] } });
        onMessage(w1!)({ data: { id: a.id, type: 'error', message: 'slice failed' } });
        onMessage(w0!)({ data: { id: simulate.id, type: 'result', result: makeSimulationResult(), sweep: [] } });
        onMessage(w2!)({ data: { id: b.id, type: 'sweep', part: 1, sweep: [point(2)] } });
      });
      const state = useAntennaStore.getState();
      expect(state.error).toBe('slice failed');
      expect(state.result).toBeNull();
      expect(state.loading).toBe(false);
      hook.unmount();
      useAntennaStore.setState(original, true);
    });

    it('splits a zoom/pan re-sweep across every worker', () => {
      const original = useAntennaStore.getState();
      const hook = renderHook(() => usePhysicsEngine({ debounceMs: 100, workerCount: 2 }));
      const [w0, w1] = workerInstances as MockWorker[];
      act(() => { vi.advanceTimersByTime(100); });
      // Two workers: the pattern worker also takes a sweep slice.
      const initial = [...posted(w0!), ...posted(w1!)];
      expect(initial.map((m) => m.type).sort()).toEqual(['simulate', 'sweep', 'sweep']);
      act(() => {
        for (const w of [w0!, w1!]) for (const m of posted(w)) {
          onMessage(w)({ data: m.type === 'simulate'
            ? { id: m.id, type: 'result', result: makeSimulationResult(), sweep: [] }
            : { id: m.id, type: 'sweep', part: m.part, sweep: [point(m.part!)] } });
        }
      });
      expect(useAntennaStore.getState().sweep).toHaveLength(2);
      w0!.postMessage.mockClear();
      w1!.postMessage.mockClear();

      act(() => { useAntennaStore.getState().panSwrView(0.25); vi.advanceTimersByTime(100); });
      const zoom = [...posted(w0!), ...posted(w1!)];
      expect(zoom.map((m) => [m.type, m.part])).toEqual([['sweep', 0], ['sweep', 1]]);
      hook.unmount();
      useAntennaStore.setState(original, true);
    });
  });
});
