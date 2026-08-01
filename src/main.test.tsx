import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
  })),
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}));

vi.mock('./App', () => ({
  App: () => null,
}));
vi.mock('./components/UI/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('main.tsx', () => {
  let rootElement: HTMLElement | null;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);
  });

  afterEach(() => {
    if (rootElement) {
      rootElement.remove();
      rootElement = null;
    }
    document.getElementById('root')?.remove();
  });

  it('renders without crashing and registers service worker', async () => {
    await import('./main.tsx');

    expect(registerSW).toHaveBeenCalledWith({ immediate: true });
    expect(createRoot).toHaveBeenCalledWith(rootElement);

    const mockRoot = vi.mocked(createRoot).mock.results[0].value;
    expect(mockRoot.render).toHaveBeenCalled();
  });

  it('throws an error if #root element is missing', async () => {
    document.getElementById('root')?.remove();
    rootElement = null;

    // Reset modules to ensure main.tsx is re-evaluated when imported
    vi.resetModules();

    // A plain re-import is enough here: resetModules() forces main.tsx to be
    // evaluated again, so no cache-busting query param is needed.
    await expect(import('./main.tsx')).rejects.toThrow('Missing #root element');
  });
});
