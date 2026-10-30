import { useState } from 'react';
import { PropagationRadar } from '../../Charts/PropagationRadar';
import type { PropagationPrediction } from '../../../physics/propagation';

// eslint-disable-next-line react-refresh/only-export-components
export function formatRange(km: number, units: 'metric' | 'imperial'): string {
  return units === 'imperial' ? `${(km / 1.609344).toFixed(0)} mi` : `${km.toFixed(0)} km`;
}

export function ConditionsReadout({ prediction, haveTakeoff, units }: {
  prediction: PropagationPrediction;
  haveTakeoff: boolean;
  units: 'metric' | 'imperial';
}) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const selected = prediction.hops[0];
  return (
    <>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0 8px' }} />
      <div className="stat"><span className="stat-label">Ideal shell height</span><span className="stat-value">{prediction.shellHeightKm.toFixed(0)} km</span></div>
      <div className="stat"><span className="stat-label">Selected lobe elevation</span><span className="stat-value">{prediction.selectedTakeoffElevationDeg.toFixed(1)}°</span></div>
      <div className="stat" title="Observer solar zenith using mid-month declination and mean solar time; not the illumination along a radio path."><span className="stat-label">Approximate solar zenith</span><span className="stat-value">{prediction.solarZenithDeg.toFixed(0)}°</span></div>
      {selected?.realizedGainDbi !== undefined && (
        <div className="stat"><span className="stat-label">Selected lobe realized gain</span><span className="stat-value">{selected.realizedGainDbi.toFixed(2)} dBi</span></div>
      )}
      {haveTakeoff ? <PropagationRadar prediction={prediction} units={units} /> : (
        <div role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Computing antenna pattern…</div>
      )}
      <div style={{ marginTop: 10 }}>
        {prediction.hops.map((hop) => (
          <div key={hop.n} className="stat">
            <span className="stat-label">{hop.n}× ideal hop</span>
            <span className="stat-value">{formatRange(hop.rangeKm, units)}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Received signal and path availability: not calculated.</p>
      <button type="button" onClick={() => setShowAssumptions((value) => !value)} aria-expanded={showAssumptions} aria-controls="assumptions-panel" style={{ marginTop: 10, background: 'transparent', border: 'none', color: 'var(--accent)', padding: 0, fontSize: 11, cursor: 'pointer' }}>
        {showAssumptions ? 'Hide model assumptions' : 'Model & assumptions'}
      </button>
      <div id="assumptions-panel" hidden={!showAssumptions} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
        <p>This is an ideal spherical-shell geometry illustration. Rays reflect at the chosen height; a real ionosphere refracts rays through a changing electron-density profile.</p>
        <ul style={{ paddingLeft: 18 }}>
          <li>The chosen shell height is not hmF2 (true electron-density peak height) or a calculated virtual height.</li>
          <li>Each bearing uses its strongest upper-hemisphere antenna lobe. Feed-system losses change realized gain, not geometry.</li>
          <li>Subsequent arcs assume the same shell height and elevation at each ground reflection. Ground-reflection and ionospheric absorption losses are not calculated.</li>
          <li>No ionospheric critical frequency, MUF, LUF, noise, received SNR, or open/closed circuit forecast is inferred from solar angle or T-index.</li>
          <li>Antenna gain is relative to isotropic radiation. It cannot establish signal usability without transmitter power, path loss, receiving antenna and noise.</li>
        </ul>
      </div>
    </>
  );
}
