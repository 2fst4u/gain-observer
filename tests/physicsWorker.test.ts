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

describe('physicsWorker error path test', () => {
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
    mockEngineInstance.simulate.mockReset();
    mockEngineInstance.sweepImpedance.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    consoleErrorSpy.mockRestore();
  });

  it('posts error message when initialization fails with an Error', async () => {
    // Set up the mock rejection before importing the worker
    mockEngineInstance.init.mockRejectedValue(new Error('Mock initialization failure'));

    // Dynamically import to ensure mock globals and mock Nec2Engine are picked up
    await import('../src/workers/physicsWorker');

    // Wait for the promise chain in physicsWorker.ts to resolve/reject
    await new Promise(resolve => setTimeout(resolve, 0));

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

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(postMessageSpy).toHaveBeenCalledWith({
      id: -1,
      type: 'error',
      message: 'Engine init failed: String error',
    });
  });

  it('posts ready message when initialization succeeds', async () => {
    mockEngineInstance.init.mockResolvedValue(undefined);

    await import('../src/workers/physicsWorker');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'ready' });
  });

  it('posts result message when simulate succeeds', async () => {
    mockEngineInstance.init.mockResolvedValue(undefined);

    let messageHandler: any;
    addEventListenerSpy.mockImplementation((type, handler) => {
      if (type === 'message') messageHandler = handler;
    });

    await import('../src/workers/physicsWorker');
    await new Promise(resolve => setTimeout(resolve, 0));

    mockEngineInstance.simulate.mockResolvedValue({ some: 'result' });
    mockEngineInstance.sweepImpedance.mockResolvedValue([{ f: 1 }]);

    messageHandler({ data: { id: 123, type: 'simulate', input: { frequency: 14 } } });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(postMessageSpy).toHaveBeenCalledWith({
      id: 123,
      type: 'result',
      result: { some: 'result' },
      sweep: [{ f: 1 }]
    });
  });

  it('posts error message when simulate fails', async () => {
    mockEngineInstance.init.mockResolvedValue(undefined);

    let messageHandler: any;
    addEventListenerSpy.mockImplementation((type, handler) => {
      if (type === 'message') messageHandler = handler;
    });

    await import('../src/workers/physicsWorker');
    await new Promise(resolve => setTimeout(resolve, 0));

    mockEngineInstance.simulate.mockRejectedValue(new Error('Simulate failed'));
    mockEngineInstance.sweepImpedance.mockResolvedValue([]);

    messageHandler({ data: { id: 124, type: 'simulate', input: { frequency: 14 } } });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(postMessageSpy).toHaveBeenCalledWith({
      id: 124,
      type: 'error',
      message: 'Simulate failed'
    });
  });

  it('handles worker error events', async () => {
    mockEngineInstance.init.mockResolvedValue(undefined);
    let errorHandler: any;
    addEventListenerSpy.mockImplementation((type, handler) => {
      if (type === 'error') errorHandler = handler;
    });

    await import('../src/workers/physicsWorker');

    // Simulate an error event
    errorHandler({ message: 'worker error', error: new Error('test') });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[worker error]', 'worker error', expect.any(Error));
  });

  it('handles worker unhandledrejection events', async () => {
    mockEngineInstance.init.mockResolvedValue(undefined);
    let rejectionHandler: any;
    addEventListenerSpy.mockImplementation((type, handler) => {
      if (type === 'unhandledrejection') rejectionHandler = handler;
    });

    await import('../src/workers/physicsWorker');

    // Simulate an unhandledrejection event
    rejectionHandler({ reason: 'promise rejected' });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[worker unhandledrejection]', 'promise rejected');
  });

  it('ignores messages with unknown types', async () => {
    mockEngineInstance.init.mockResolvedValue(undefined);

    let messageHandler: any;
    addEventListenerSpy.mockImplementation((type, handler) => {
      if (type === 'message') messageHandler = handler;
    });

    await import('../src/workers/physicsWorker');
    await new Promise(resolve => setTimeout(resolve, 0));

    // Reset postMessageSpy to ensure we only catch calls from the message handler
    postMessageSpy.mockClear();

    // Send a message with an unknown type
    messageHandler({ data: { id: 125, type: 'unknown_type', input: { frequency: 14 } } });

    await new Promise(resolve => setTimeout(resolve, 0));

    // verify simulate was not called
    expect(mockEngineInstance.simulate).not.toHaveBeenCalled();
    // verify postMessage was not called
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('posts error message when simulate fails with a non-Error object', async () => {
    mockEngineInstance.init.mockResolvedValue(undefined);

    let messageHandler: any;
    addEventListenerSpy.mockImplementation((type, handler) => {
      if (type === 'message') messageHandler = handler;
    });

    await import('../src/workers/physicsWorker');
    await new Promise(resolve => setTimeout(resolve, 0));

    mockEngineInstance.simulate.mockRejectedValue('String Error');
    mockEngineInstance.sweepImpedance.mockResolvedValue([]);

    messageHandler({ data: { id: 124, type: 'simulate', input: { frequency: 14 } } });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(postMessageSpy).toHaveBeenCalledWith({
      id: 124,
      type: 'error',
      message: 'String Error'
    });
  });
});
