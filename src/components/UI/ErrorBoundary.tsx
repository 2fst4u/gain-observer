// Error boundary — catches render-time exceptions anywhere in the tree so
// the whole tab doesn't go blank when something throws. We also log the
// error to the console so it's visible during development.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the stack so it shows up clearly in the console.
    console.error('[ErrorBoundary] caught', error, info);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div style={{
          padding: 20,
          color: 'var(--danger, #ff6b6b)',
          background: 'var(--bg, #111)',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          height: '100%',
          overflow: 'auto',
        }}>
          <h2 style={{ marginTop: 0 }}>Render error</h2>
          <div style={{ marginBottom: 12 }}>{this.state.error.message}</div>
          <button onClick={this.reset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
