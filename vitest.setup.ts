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
