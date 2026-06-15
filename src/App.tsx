import { AntennaScene } from './components/Scene/AntennaScene';
import { ControlPanel } from './components/Panel/ControlPanel';
import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { ColormapLegend } from './components/Scene/ColormapLegend';
import { useTheme } from './hooks/useTheme';
import { useUnitsPersistence } from './hooks/useUnits';
import { usePhysicsEngine } from './hooks/usePhysicsEngine';
import { useAntennaStore } from './store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { type ReactNode, useEffect } from 'react';

const ANTENNA_LABELS: Record<string, string> = {
  'dipole': 'Dipole',
  'inverted-v': 'Inverted V',
  'delta-loop': 'Delta Loop',
  'sloping-v': 'Sloping V',
  'terminated-delta': 'Terminated Delta',
  'vertical-whip': 'Vertical Whip',
  'inverted-l': 'Inverted L',
  'folded-dipole': 'Folded Dipole',
};

export function App() {
  useTheme();
  useUnitsPersistence();
  usePhysicsEngine({ debounceMs: 150 });
  useKeyboardShortcuts();

  const {
    mode,
    error,
    loading,
    engineReady,
    comparisonReference,
    result: liveResult,
    antennaType,
    frequency,
  } = useAntennaStore(useShallow((s) => ({
    mode: s.mode,
    error: s.error,
    loading: s.loading,
    engineReady: s.engineReady,
    comparisonReference: s.comparisonReference,
    result: s.result,
    antennaType: s.antennaType,
    frequency: s.frequency,
  })));

  const showComparison = mode === 'comparison' && comparisonReference;

  // SEO: Dynamically update the page title with the current configuration
  // to provide better context and discoverability for indexed states.
  useEffect(() => {
    const typeLabel = ANTENNA_LABELS[antennaType] || 'Antenna';
    document.title = `${typeLabel} at ${frequency.toFixed(3)} MHz - HF Gain Visualiser`;

    // SEO: Dynamically update the meta description for better snippet representation in search results
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', `Interactive 3D radiation pattern and SWR chart for a ${typeLabel} antenna at ${frequency.toFixed(3)} MHz, powered by NEC-2 WebAssembly.`);
    }
  }, [antennaType, frequency]);

  return (
    <>
      {/* SEO: Use <main> instead of generic <div> to denote primary content area for crawlers */}
      <main className="app-shell">
      {/* SEO: Upgrade <div> to <section> for better document outlining */}
      <section className="app-viewport">
        {showComparison ? (
          <div className="scene-compare-grid">
            <ScenePane title="Reference" subtitle="Frozen snapshot" result={comparisonReference?.result ?? null}>
              <ErrorBoundary fallback={sceneFallback}>
                <AntennaScene snapshot={comparisonReference} />
              </ErrorBoundary>
            </ScenePane>
            <ScenePane title="Current" subtitle="Live controls" result={liveResult}>
              <LiveAntennaScene engineReady={engineReady} loading={loading} error={error} />
            </ScenePane>
          </div>
        ) : (
          <ScenePane title="Radiation Pattern" subtitle="Live view" result={liveResult}>
            <LiveAntennaScene engineReady={engineReady} loading={loading} error={error} />
          </ScenePane>
        )}
      </section>
      <ControlPanel />
      </main>
    </>
  );
}

function ScenePane({
  title,
  subtitle,
  children,
  result,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  result: import('./physics/types').SimulationResult | null;
}) {
  return (
    /* SEO: Upgrade div to section for better structural outline */
    <section className="scene-pane" aria-labelledby={`scene-pane-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      {/* SEO: Use header for logical grouping of pane title */}
      <header className="scene-pane-header">
        {/* SEO: Use h2 to maintain proper heading hierarchy after h1 in ControlPanel */}
        <h2 id={`scene-pane-title-${title.replace(/\s+/g, '-').toLowerCase()}`} className="scene-pane-title" style={{ margin: 0 }}>{title}</h2>
        <div className="scene-pane-subtitle">{subtitle}</div>
      </header>
      <ColormapLegend result={result} />
      {children}
    </section>
  );
}

function LiveAntennaScene({ engineReady, loading, error }: { engineReady: boolean; loading: boolean; error: string | null }) {
  return (
    <>
      <ErrorBoundary fallback={sceneFallback}>
        <AntennaScene />
      </ErrorBoundary>
      {!engineReady && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" /> Loading NEC-2 WebAssembly…
        </div>
      )}
      {engineReady && loading && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" /> Solving…
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert" aria-live="assertive">
          <strong>Solver error:</strong> {error}
        </div>
      )}
    </>
  );
}

function sceneFallback(err: Error, reset: () => void) {
  return (
    <div style={{ padding: 20, color: '#ff6b6b', fontFamily: 'monospace' }} role="alert" aria-live="assertive">
      <strong>3D scene crashed:</strong> {err.message}
      <button onClick={reset} style={{ marginLeft: 10 }}>Retry</button>
    </div>
  );
}

function useKeyboardShortcuts(): void {
  const { toggleTheme, toggleUnits, setMode } = useAntennaStore(useShallow((s) => ({
    toggleTheme: s.toggleTheme,
    toggleUnits: s.toggleUnits,
    setMode: s.setMode,
  })));
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 't' || e.key === 'T') toggleTheme();
      else if (e.key === 'u' || e.key === 'U') toggleUnits();
      else if (e.key === 'm' || e.key === 'M') setMode('normal');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTheme, toggleUnits, setMode]);
}
