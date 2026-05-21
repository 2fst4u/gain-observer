import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePhysicsEngine } from '../src/hooks/usePhysicsEngine';
import { useAntennaStore } from '../src/store/antennaStore';

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
    )[1];

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

  it('handles worker errors properly', () => {
    renderHook(() => usePhysicsEngine({ debounceMs: 100 }));
    const worker = workerInstances[0] as MockWorker;

    // Get the error handler
    const errorHandler = worker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'error'
    )[1];

    // Get the messageerror handler
    const messageErrorHandler = worker.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'messageerror'
    )[1];

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
});
