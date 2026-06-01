import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We mock Nec2Engine and export a mock instance so we can change its behavior per test
const mockEngineInstance = {
  init: vi.fn(),
  simulate: vi.fn(),
  sweepImpedance: vi.fn()
};

vi.mock('../src/physics/nec2Engine', () => {
  return {
    Nec2Engine: class MockNec2Engine {
      init = mockEngineInstance.init;
      simulate = mockEngineInstance.simulate;
      sweepImpedance = mockEngineInstance.sweepImpedance;
    }
  };
});

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

describe('physicsWorker tests', () => {
  let postMessageSpy: ReturnType<typeof vi.fn>;
  let addEventListenerSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    postMessageSpy = vi.fn();
    addEventListenerSpy = vi.fn();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock global scope for DedicatedWorkerGlobalScope
    vi.stubGlobal('postMessage', postMessageSpy);
    vi.stubGlobal('addEventListener', addEventListenerSpy);

    // Reset mock implementation for each test
    mockEngineInstance.init.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    consoleErrorSpy.mockRestore();
  });

  describe('Initialization error paths', () => {
    it('posts error message when initialization fails with an Error', async () => {
      // Set up the mock rejection before importing the worker
      mockEngineInstance.init.mockRejectedValue(new Error('Mock initialization failure'));

      // Dynamically import to ensure mock globals and mock Nec2Engine are picked up
      await import('../src/workers/physicsWorker');

      // Wait for the promise chain in physicsWorker.ts to resolve/reject
      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith({
        id: -1,
        type: 'error',
        message: 'Engine init failed: Mock initialization failure',
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[worker] engine init failed',
        expect.any(Error)
      );
    });

    it('posts error message when initialization fails with a non-Error', async () => {
      mockEngineInstance.init.mockRejectedValue('String error');

      await import('../src/workers/physicsWorker');

      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith({
        id: -1,
        type: 'error',
        message: 'Engine init failed: String error',
      });
    });
  });

  describe('Standard operation paths', () => {
    it('posts ready message when initialization succeeds', async () => {
      mockEngineInstance.init.mockResolvedValue(undefined);
      await import('../src/workers/physicsWorker');
      await flushPromises();
      expect(postMessageSpy).toHaveBeenCalledWith({ type: 'ready' });
    });

    it('logs worker error to console', async () => {
      mockEngineInstance.init.mockResolvedValue(undefined);
      await import('../src/workers/physicsWorker');
      await flushPromises();

      const errorCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'error');
      expect(errorCall).toBeDefined();

      const errorHandler = errorCall[1];
      errorHandler({ message: 'test error', error: new Error('test') });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[worker error]', 'test error', expect.any(Error));
    });

    it('logs worker unhandledrejection to console', async () => {
      mockEngineInstance.init.mockResolvedValue(undefined);
      await import('../src/workers/physicsWorker');
      await flushPromises();

      const rejectionCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'unhandledrejection');
      expect(rejectionCall).toBeDefined();

      const rejectionHandler = rejectionCall[1];
      rejectionHandler({ reason: 'test rejection' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[worker unhandledrejection]', 'test rejection');
    });

    it('handles simulate message and posts result on success', async () => {
      mockEngineInstance.init.mockResolvedValue(undefined);
      mockEngineInstance.simulate.mockResolvedValue({ some: 'result' });
      mockEngineInstance.sweepImpedance.mockResolvedValue([{ some: 'sweep' }]);

      await import('../src/workers/physicsWorker');
      await flushPromises();

      const messageCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'message');
      expect(messageCall).toBeDefined();

      const messageHandler = messageCall[1];
      messageHandler({ data: { id: 123, type: 'simulate', input: { frequency: 14 } } });

      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith({
        id: 123,
        type: 'result',
        result: { some: 'result' },
        sweep: [{ some: 'sweep' }]
      });
    });

    it('handles simulate message and posts error on failure', async () => {
      mockEngineInstance.init.mockResolvedValue(undefined);
      mockEngineInstance.simulate.mockRejectedValue(new Error('Simulate error'));

      await import('../src/workers/physicsWorker');
      await flushPromises();

      const messageCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'message');
      const messageHandler = messageCall[1];
      messageHandler({ data: { id: 456, type: 'simulate', input: { frequency: 14 } } });

      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith({
        id: 456,
        type: 'error',
        message: 'Simulate error'
      });
    });

    it('handles simulate message and posts string error on failure', async () => {
      mockEngineInstance.init.mockResolvedValue(undefined);
      mockEngineInstance.simulate.mockRejectedValue('String Simulate error');

      await import('../src/workers/physicsWorker');
      await flushPromises();

      const messageCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'message');
      const messageHandler = messageCall[1];
      messageHandler({ data: { id: 456, type: 'simulate', input: { frequency: 14 } } });

      await flushPromises();

      expect(postMessageSpy).toHaveBeenCalledWith({
        id: 456,
        type: 'error',
        message: 'String Simulate error'
      });
    });
  });
});
