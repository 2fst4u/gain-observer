// HF propagation panel — manual T-index entry plus a top-down radar plot
// of estimated 1/2/3-hop range. Entirely client-side; no network calls.

import { useMemo, useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { predictPropagation } from '../../physics/propagation';
import { PropagationRadar } from '../Charts/PropagationRadar';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function PropagationControl() {
  const frequency = useAntennaStore((s) => s.frequency);
  const tIndex = useAntennaStore((s) => s.tIndex);
  const setTIndex = useAntennaStore((s) => s.setTIndex);
  const latitudeDeg = useAntennaStore((s) => s.latitudeDeg);
  const longitudeDeg = useAntennaStore((s) => s.longitudeDeg);
  const setLatitude = useAntennaStore((s) => s.setLatitude);
  const monthOverride = useAntennaStore((s) => s.monthOverride);
  const utcHourOverride = useAntennaStore((s) => s.utcHourOverride);
  const setMonthOverride = useAntennaStore((s) => s.setMonthOverride);
  const setUtcHourOverride = useAntennaStore((s) => s.setUtcHourOverride);
  const result = useAntennaStore((s) => s.result);
  const units = useAntennaStore((s) => s.units);

  const { status: geoStatus, requestLocation } = useGeolocation();

  const [showAssumptions, setShowAssumptions] = useState(false);

  // Local buffers for numeric inputs to allow natural typing.
  const [localTIndex, setLocalTIndex] = useState(tIndex.toString());
  const [isTIndexFocused, setIsTIndexFocused] = useState(false);

  const [prevTIndex, setPrevTIndex] = useState(tIndex);
  if (tIndex !== prevTIndex) {
    setPrevTIndex(tIndex);
    if (!isTIndexFocused) {
      setLocalTIndex(tIndex.toString());
    }
  }

  const [localLat, setLocalLat] = useState(latitudeDeg?.toString() ?? '');
  const [isLatFocused, setIsLatFocused] = useState(false);

  const [prevLat, setPrevLat] = useState(latitudeDeg);
  if (latitudeDeg !== prevLat) {
    setPrevLat(latitudeDeg);
    if (!isLatFocused) {
      setLocalLat(latitudeDeg?.toString() ?? '');
    }
  }

  // Resolve "now" once per render. We deliberately don't memoise on a
  // ticking clock — propagation conditions change on the order of minutes,
  // so the panel just refreshes on the next render trigger (e.g. user
  // input). Adding a 60s ticker is easy if needed later.
  const now = new Date();
  const autoMonth = now.getUTCMonth() + 1;
  const autoUtcHour = now.getUTCHours() + now.getUTCMinutes() / 60;

  const month = monthOverride ?? autoMonth;
  const utcHour = utcHourOverride ?? autoUtcHour;

  // Local buffer for UTC hour input so typing isn't fought by the auto clock.
  const [localUtcHour, setLocalUtcHour] = useState(utcHour.toFixed(1));
  const [isUtcHourFocused, setIsUtcHourFocused] = useState(false);

  const [prevUtcHour, setPrevUtcHour] = useState(utcHour);
  if (utcHour !== prevUtcHour) {
    setPrevUtcHour(utcHour);
    if (!isUtcHourFocused) {
      setLocalUtcHour(utcHour.toFixed(1));
    }
  }

  const takeoffElevationDeg = result?.takeoffElevationDeg ?? 30;

  const prediction = useMemo(() => {
    return predictPropagation({
      frequencyMHz: frequency,
      tIndex,
      takeoffElevationDeg,
      month,
      utcHour,
      latitudeDeg: latitudeDeg ?? 0,
      longitudeDeg: longitudeDeg ?? 0,
      pattern: result?.pattern,
      swr: result?.swr,
    });
  }, [frequency, tIndex, takeoffElevationDeg, month, utcHour, latitudeDeg, longitudeDeg, result?.pattern, result?.swr]);

  const haveTakeoff = result !== null;

  return (
    <div className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>
        Propagation
        <span className="badge">T = {tIndex.toFixed(0)}</span>
      </h2>

      {/* T-index input */}
      <label htmlFor="t-index-input">T-index</label>
      <div className="row">
        <input
          id="t-index-input"
          type="number"
          min={-100}
          max={250}
          step={1}
          value={localTIndex}
          aria-label="Ionospheric T-index"
          onFocus={() => setIsTIndexFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalTIndex(s);
            const v = parseFloat(s);
            if (!isNaN(v)) setTIndex(v);
          }}
          onBlur={() => {
            setIsTIndexFocused(false);
            setLocalTIndex(tIndex.toString());
          }}
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
        Australian IPS T-index. ~30 = quiet, ~100 = active. Look up today&apos;s
        value from your usual space-weather source.
      </p>

      {/* Latitude + geolocation */}
      <label htmlFor="lat-input">Latitude</label>
      <div className="row" style={{ alignItems: 'center' }}>
        <input
          id="lat-input"
          type="number"
          min={-90}
          max={90}
          step={0.1}
          value={localLat}
          placeholder="0.0"
          aria-label="Latitude in degrees"
          onFocus={() => setIsLatFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalLat(s);
            const v = parseFloat(s);
            setLatitude(isNaN(v) ? null : v);
          }}
          onBlur={() => {
            setIsLatFocused(false);
            setLocalLat(latitudeDeg?.toString() ?? '');
          }}
        />
        <button
          type="button"
          onClick={() => { void requestLocation(); }}
          disabled={geoStatus === 'requesting'}
          style={{ flex: '0 0 auto' }}
          title="Use the browser geolocation API to populate latitude. Asks for permission only when clicked."
        >
          {geoStatus === 'requesting' ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
        {geoStatusMessage(geoStatus, latitudeDeg)}
      </p>

      {/* Time & Month — always visible, auto-filled from browser clock unless overridden */}
      <label htmlFor="month-select" style={{ marginTop: 10 }}>Month</label>
      <div className="row">
        <select
          id="month-select"
          value={monthOverride ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setMonthOverride(v === '' ? null : parseInt(v, 10));
          }}
          aria-label="Month override"
        >
          <option value="">Auto ({MONTH_NAMES[autoMonth - 1]})</option>
          {MONTH_NAMES.map((n, i) => (
            <option key={n} value={i + 1}>{n}</option>
          ))}
        </select>
      </div>

      <label htmlFor="utc-hour-input" style={{ marginTop: 10 }}>
        UTC Hour — {formatUtcHour(utcHour)}
      </label>
      <div className="row">
        <input
          id="utc-hour-input"
          type="number"
          min={0}
          max={23.99}
          step={0.1}
          value={localUtcHour}
          onFocus={() => setIsUtcHourFocused(true)}
          aria-label="UTC hour override"
          onChange={(e) => {
            const s = e.target.value;
            setLocalUtcHour(s);
            const val = parseFloat(s);
            if (!isNaN(val)) {
              setUtcHourOverride(val);
            }
          }}
          onBlur={() => {
            setIsUtcHourFocused(false);
            setLocalUtcHour(utcHour.toFixed(1));
          }}
        />
        <button
          type="button"
          onClick={() => setUtcHourOverride(null)}
          disabled={utcHourOverride === null}
          style={{ flex: '0 0 auto' }}
          title="Reset to current UTC time"
        >
          Auto
        </button>
      </div>

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
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
          Computing antenna pattern…
        </div>
      )}

      {/* Per-hop status text (machine-readable for screen readers and a
          quick textual summary alongside the radar) */}
      <div style={{ marginTop: 10 }}>
        {prediction.hops.map((h) => (
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
        style={{
          marginTop: 10, background: 'transparent', border: 'none',
          color: 'var(--accent)', padding: 0, fontSize: 11, cursor: 'pointer',
        }}
      >
        {showAssumptions ? 'Hide model assumptions' : 'Model & assumptions'}
      </button>
      {showAssumptions && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
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
    </div>
  );
}

function formatRange(km: number, units: 'metric' | 'imperial'): string {
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

function formatUtcHour(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function geoStatusMessage(
  status: ReturnType<typeof useAntennaStore.getState>['geolocationStatus'],
  latitudeDeg: number | null,
): string {
  switch (status) {
    case 'idle':
      return latitudeDeg === null
        ? 'Defaults to 0° (equator) until set. Type a value or click "Use my location".'
        : `Manual entry. Click "Use my location" to replace from the browser.`;
    case 'requesting':
      return 'Asking the browser for your location…';
    case 'granted':
      return 'Location obtained from the browser. You can still edit it manually.';
    case 'denied':
      return 'Permission denied. Using the value above; edit it manually if you wish.';
    case 'unsupported':
      return 'Browser geolocation is unavailable. Enter latitude manually.';
    case 'error':
      return 'Could not obtain location. Enter latitude manually.';
  }
}
