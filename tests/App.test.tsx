import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { App } from '../src/App';
import { useAntennaStore } from '../src/store/antennaStore';

// Stub Worker since jsdom doesn't implement it with module support.
class StubWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}
// @ts-expect-error — replace global
globalThis.Worker = StubWorker;

// Stub WebGL so R3F's Canvas doesn't throw on getContext.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;

describe('App', () => {
  beforeEach(() => {
    useAntennaStore.setState({
      mode: 'normal',
      error: null,
      loading: false,
      engineReady: true,
      comparisonReference: null,
      theme: 'dark',
      units: 'metric'
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders standard layout without throwing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
    expect(screen.getByText('Radiation Pattern')).toBeTruthy();
  });

  describe('Keyboard shortcuts', () => {
    it('toggles theme on "t" or "T"', () => {
      render(<App />);
      expect(useAntennaStore.getState().theme).toBe('dark');

      fireEvent.keyDown(window, { key: 't' });
      expect(useAntennaStore.getState().theme).toBe('light');

      fireEvent.keyDown(window, { key: 'T' });
      expect(useAntennaStore.getState().theme).toBe('dark');
    });

    it('toggles units on "u" or "U"', () => {
      render(<App />);
      expect(useAntennaStore.getState().units).toBe('metric');

      fireEvent.keyDown(window, { key: 'u' });
      expect(useAntennaStore.getState().units).toBe('imperial');

      fireEvent.keyDown(window, { key: 'U' });
      expect(useAntennaStore.getState().units).toBe('metric');
    });

    it('changes mode to normal on "m" or "M"', () => {
      useAntennaStore.setState({ mode: 'comparison' });
      render(<App />);

      fireEvent.keyDown(window, { key: 'm' });
      expect(useAntennaStore.getState().mode).toBe('normal');

      useAntennaStore.setState({ mode: 'comparison' });
      fireEvent.keyDown(window, { key: 'M' });
      expect(useAntennaStore.getState().mode).toBe('normal');
    });

    it('ignores shortcuts when focused on an input', () => {
      render(
        <div>
          <App />
          <input data-testid="test-input" />
        </div>
      );

      const input = screen.getByTestId('test-input');
      expect(useAntennaStore.getState().theme).toBe('dark');

      // Fire event with input as target
      fireEvent.keyDown(input, { key: 't' });

      // Theme should not change
      expect(useAntennaStore.getState().theme).toBe('dark');
    });
  });

  describe('UI States', () => {
    it('shows loading overlay when engine is not ready', () => {
      useAntennaStore.setState({ engineReady: false });
      render(<App />);
      expect(screen.getByText('Loading NEC-2 WebAssembly…')).toBeTruthy();
    });

    it('shows solving overlay when engine is ready and loading', () => {
      useAntennaStore.setState({ engineReady: true, loading: true });
      render(<App />);
      expect(screen.getByText('Solving…')).toBeTruthy();
    });

    it('shows error banner when there is an error', () => {
      useAntennaStore.setState({ error: 'Test solver error' });
      render(<App />);
      expect(screen.getByText('Test solver error')).toBeTruthy();
      expect(screen.getByText('Solver error:')).toBeTruthy();
    });

    it('renders comparison view when mode is comparison and reference exists', () => {
      useAntennaStore.setState({
        mode: 'comparison',
        comparisonReference: {
            capturedAt: 1680000000000,
            frequency: 14.1,
            length: 10,
            height: 5,
            orientation: 'NS',
            groundId: 'pastoral',
            result: { maxGainDbi: 2.15, swr: 1.5, impedance: { r: 50, x: 0 }, efficiency: 100 },
            sweep: []
        } as unknown as import('../src/physics/types').SimulationSnapshot
      });
      render(<App />);

      expect(screen.getByText('Reference')).toBeTruthy();
      expect(screen.getByText('Frozen snapshot')).toBeTruthy();
      expect(screen.getByText('Current')).toBeTruthy();
      expect(screen.getByText('Live controls')).toBeTruthy();
    });
  });
});
