// Smoke test: render the App under jsdom. Catches the most obvious errors
// (infinite loops, throw-on-mount, missing exports). It cannot exercise the
// WebGL canvas or Web Worker — those need a real browser — but it still
// reveals a surprising number of bugs.

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { App } from '../src/App';

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

describe('App mount', () => {
  it('renders without throwing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });
});
