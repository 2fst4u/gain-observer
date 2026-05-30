import { useState } from 'react';
import { PropagationRadar } from '../../Charts/PropagationRadar';
import type { PropagationPrediction, HopPrediction } from '../../../physics/propagation';

// eslint-disable-next-line react-refresh/only-export-components
export function formatRange(km: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    return `${(km / 1.609344).toFixed(0)} mi`;
  }
  return `${km.toFixed(0)} km`;
}

function hopColor(status: 'open' | 'marginal' | 'closed'): string {
  if (status === 'open') return 'var(--success)';
  if (status === 'marginal') return 'var(--warning)';
  return 'var(--danger)';
}

function qualityLabel(quality: 'useful' | 'weak' | 'unusable'): string {
  if (quality === 'useful') return 'usable signal';
  if (quality === 'weak') return 'weak signal';
  return 'very weak signal';
}

interface ConditionsReadoutProps {
  prediction: PropagationPrediction;
  haveTakeoff: boolean;
  units: 'metric' | 'imperial';
}

export function ConditionsReadout({ prediction, haveTakeoff, units }: ConditionsReadoutProps) {
  const [showAssumptions, setShowAssumptions] = useState(false);

  return (
    <>
      {/* Conditions readout */}
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0 8px' }} />
      <div className="stat">
        <span className="stat-label">foF2</span>
        <span className="stat-value">{prediction.foF2MHz.toFixed(2)} MHz</span>
      </div>
      <div className="stat">
        <span className="stat-label">hmF2</span>
        <span className="stat-value">{prediction.hmF2Km.toFixed(0)} km</span>
      </div>
      <div className="stat">
        <span className="stat-label">MUF (selected ray)</span>
        <span className="stat-value">{prediction.mufMHz.toFixed(2)} MHz</span>
      </div>
      <div className="stat">
        <span className="stat-label">Selected elevation</span>
        <span className="stat-value">{prediction.selectedTakeoffElevationDeg.toFixed(0)}°</span>
      </div>
      {prediction.mismatchLossDb > 0.01 && (
        <div className="stat">
          <span className="stat-label">SWR mismatch loss</span>
          <span className="stat-value">{prediction.mismatchLossDb.toFixed(1)} dB</span>
        </div>
      )}
      <div className="stat" title="Lower usable frequency: D-layer absorption estimate. Least reliable part of the model — see assumptions.">
        <span className="stat-label">
          LUF <span style={{ color: 'var(--warning)', cursor: 'help' }} aria-label="LUF is the least reliable part of the model">ⓘ</span>
        </span>
        <span className="stat-value">{prediction.lufMHz.toFixed(2)} MHz</span>
      </div>

      {/* Radar plot */}
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0 8px' }} />
      {haveTakeoff ? (
        <PropagationRadar
          prediction={prediction}
          units={units}
        />
      ) : (
        <div role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 0' }}>
          <div className="spinner" aria-hidden="true" /> Computing antenna pattern…
        </div>
      )}

      {/* Per-hop status text (machine-readable for screen readers and a
          quick textual summary alongside the radar) */}
      <div style={{ marginTop: 10 }}>
        {prediction.hops.map((h: HopPrediction) => (
          <div key={h.n} className="stat">
            <span className="stat-label">{h.n}× hop</span>
            <span
              className="stat-value"
              style={{ color: hopColor(h.status) }}
              title={h.reason}
            >
              {formatRange(h.rangeKm, units)} · {h.status} · {qualityLabel(h.linkQuality)}
            </span>
          </div>
        ))}
      </div>

      {/* Assumptions disclosure */}
      <button
        type="button"
        onClick={() => setShowAssumptions((v) => !v)}
        aria-expanded={showAssumptions}
        aria-controls="assumptions-panel"
        style={{
          marginTop: 10, background: 'transparent', border: 'none',
          color: 'var(--accent)', padding: 0, fontSize: 11, cursor: 'pointer',
        }}
      >
        {showAssumptions ? 'Hide model assumptions' : 'Model & assumptions'}
      </button>
      {showAssumptions && (
        <div id="assumptions-panel" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>
            This is a closed-form approximation, not IRI / ASAPS / VOACAP.
            It captures the right monotonic behaviours (foF2 rises with
            T-index, MUF rises with shallower take-off) but is not a
            propagation-prediction product.
          </p>
          <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
            <li>foF2 from T-index, solar zenith angle, latitude (no URSI/CCIR maps).</li>
            <li>hmF2 from a simple day/night sinusoid centred on canonical values.</li>
            <li>MUF: secant law with curved-Earth correction.</li>
            <li>Range is ray geometry from elevation and hmF2. Gain and SWR affect signal quality, not skip distance.</li>
            <li>
              <strong>LUF: heuristic from D-layer absorption.</strong> Treat with caution
              — least reliable part of the model, especially near sunrise/sunset.
            </li>
            <li>User latitude is taken as the path-midpoint latitude (fine for short hops).</li>
            <li>No sporadic-E, auroral, or polar effects.</li>
          </ul>
        </div>
      )}
    </>
  );
}
