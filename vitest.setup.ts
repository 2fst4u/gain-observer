// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserver;

// Mock build ID
Object.defineProperty(globalThis, '__BUILD_ID__', {
  value: 'test-build-id',
  writable: true,
  configurable: true,
});

// Tests never reach the network. The propagation panel fetches solar flux
// from NOAA SWPC; a test that needs data stubs fetch itself.
globalThis.fetch = async (input: RequestInfo | URL) => {
  throw new Error(`Network access is disabled in tests: ${String(input)}`);
};
