import { describe, expect, it, vi } from 'vitest';
import { render, screen} from '@testing-library/react';
import { ErrorBoundary } from '../src/components/UI/ErrorBoundary';
import React from 'react';

const Bomb = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Boom!');
  }
  return <div>Safe</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('renders default fallback when an error occurs', () => {
    // Suppress expected console.error during test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Render error')).toBeTruthy();
    expect(screen.getByText('Boom!')).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={(error, reset) => (
        <div>
          <span>Custom Fallback: {error.message}</span>
          <button onClick={reset}>Reset Me</button>
        </div>
      )}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Fallback: Boom!')).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
