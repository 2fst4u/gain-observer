import { AntennaScene } from './components/Scene/AntennaScene';
import { ControlPanel } from './components/Panel/ControlPanel';
import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { useTheme } from './hooks/useTheme';
import { useUnitsPersistence } from './hooks/useUnits';
import { usePhysicsEngine } from './hooks/usePhysicsEngine';
import { useAntennaStore } from './store/antennaStore';
import { type ReactNode, useEffect } from 'react';

export function App() {
  useTheme();
  useUnitsPersistence();
  usePhysicsEngine({ debounceMs: 150 });
  useKeyboardShortcuts();

  const mode = useAntennaStore((s) => s.mode);
  const error = useAntennaStore((s) => s.error);
  const loading = useAntennaStore((s) => s.loading);
  const engineReady = useAntennaStore((s) => s.engineReady);
  const comparisonReference = useAntennaStore((s) => s.comparisonReference);

  const showComparison = mode === 'comparison' && comparisonReference;

  return (
    <div className="app-shell">
      <div className="app-viewport">
        {showComparison ? (
          <div className="scene-compare-grid">
            <ScenePane title="Reference" subtitle="Frozen snapshot">
              <ErrorBoundary fallback={sceneFallback}>
                <AntennaScene snapshot={comparisonReference} />
              </ErrorBoundary>
            </ScenePane>
            <ScenePane title="Current" subtitle="Live controls">
              <ErrorBoundary fallback={sceneFallback}>
                <AntennaScene />
              </ErrorBoundary>
              {!engineReady && (
                <div className="loading-overlay">
                  <div className="spinner" /> Loading NEC-2 WebAssembly…
                </div>
              )}
              {engineReady && loading && (
                <div className="loading-overlay">
                  <div className="spinner" /> Solving…
                </div>
              )}
              {error && (
                <div className="error-banner">
                  <strong>Solver error:</strong> {error}
                </div>
              )}
            </ScenePane>
          </div>
        ) : (
          <ScenePane title="Radiation Pattern" subtitle="Live view">
            <ErrorBoundary fallback={sceneFallback}>
              <AntennaScene />
            </ErrorBoundary>
            {!engineReady && (
              <div className="loading-overlay">
                <div className="spinner" /> Loading NEC-2 WebAssembly…
              </div>
            )}
            {engineReady && loading && (
              <div className="loading-overlay">
                <div className="spinner" /> Solving…
              </div>
            )}
            {error && (
              <div className="error-banner">
                <strong>Solver error:</strong> {error}
              </div>
            )}
          </ScenePane>
        )}
      </div>
      <ControlPanel />
    </div>
  );
}

function ScenePane({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="scene-pane">
      <div className="scene-pane-header">
        <div className="scene-pane-title">{title}</div>
        <div className="scene-pane-subtitle">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function sceneFallback(err: Error, reset: () => void) {
  return (
    <div style={{ padding: 20, color: '#ff6b6b', fontFamily: 'monospace' }}>
      <strong>3D scene crashed:</strong> {err.message}
      <button onClick={reset} style={{ marginLeft: 10 }}>Retry</button>
    </div>
  );
}

function useKeyboardShortcuts(): void {
  const toggleTheme = useAntennaStore((s) => s.toggleTheme);
  const toggleUnits = useAntennaStore((s) => s.toggleUnits);
  const setMode = useAntennaStore((s) => s.setMode);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 't' || e.key === 'T') toggleTheme();
      else if (e.key === 'u' || e.key === 'U') toggleUnits();
      else if (e.key === 'n' || e.key === 'N') setMode('nvis');
      else if (e.key === 'c' || e.key === 'C') setMode('comparison');
      else if (e.key === 'm' || e.key === 'M') setMode('normal');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTheme, toggleUnits, setMode]);
}
