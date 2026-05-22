import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { displayLengthUnit, formatLength } from '../../physics/units';
import { findGroundPreset } from '../../physics/constants';

export function ComparisonControl() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    mode,
    units,
    result,
    sweep,
    comparisonReference: reference,
    captureComparisonReference: captureReference,
    clearComparisonReference: clearReference,
  } = useAntennaStore(useShallow((s) => ({
    mode: s.mode,
    units: s.units,
    result: s.result,
    sweep: s.sweep,
    comparisonReference: s.comparisonReference,
    captureComparisonReference: s.captureComparisonReference,
    clearComparisonReference: s.clearComparisonReference,
  })));

  if (mode !== 'comparison') return null;

  const canCapture = Boolean(result && sweep.length > 0);
  const unit = displayLengthUnit(units);

  return (
    /* SEO: Upgrade generic div wrapper to semantic section tag to improve document outlining for search engines */
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Comparison</h2>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Freeze the current antenna as the left-hand reference, then change the live controls to compare against it.
      </div>
      <div className="button-group" role="group" aria-label="Comparison Actions" style={{ marginTop: 10 }}>
        <button
          className="primary"
          onClick={captureReference}
          disabled={!canCapture}
          title={!canCapture ? 'Wait for antenna calculation to complete' : 'Capture current settings as reference'}
        >
          Use current as reference
        </button>
        <button
          onClick={clearReference}
          disabled={!reference}
          title={!reference ? 'No reference captured' : 'Clear the captured reference'}
        >
          Clear reference
        </button>
      </div>
      {reference ? (
        <div className="compare-summary">
          <div className="stat">
            <span className="stat-label">Captured</span>
            <span className="stat-value">{formatCapturedAt(reference.capturedAt)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Frequency</span>
            <span className="stat-value">{reference.frequency.toFixed(3)} MHz</span>
          </div>
          <div className="stat">
            <span className="stat-label">Length ({unit})</span>
            <span className="stat-value">{formatLength(reference.length, units, 2)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Height ({unit})</span>
            <span className="stat-value">{formatLength(reference.height, units, 1)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Orientation</span>
            <span className="stat-value">
              {typeof reference.orientation === 'number'
                ? `${reference.orientation.toFixed(0)}°`
                : reference.orientation}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Ground</span>
            <span className="stat-value">{formatGround(reference.groundId)}</span>
          </div>
          <div className="stat">
            <span
              className="stat-label"
              title="Antenna gain (dBi): NEC total power gain, normalised to accepted input power. Includes all ohmic and termination losses."
            >Gain</span>
            <span className="stat-value accent">{reference.result.maxGainDbi.toFixed(2)} dBi</span>
          </div>
          <div className="stat">
            <span className="stat-label">SWR (50 Ω)</span>
            <span className="stat-value">{reference.result.swr.toFixed(2)}:1</span>
          </div>
        </div>
      ) : (
        <div className="compare-empty">Capture a solved configuration to enable side-by-side comparison.</div>
      )}
    </section>
  );
}

function formatCapturedAt(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatGround(groundId: string): string {
  if (groundId === 'custom') return 'Custom';
  return findGroundPreset(groundId).label;
}
