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
});
