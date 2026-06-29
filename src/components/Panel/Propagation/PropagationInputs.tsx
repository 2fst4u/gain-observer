/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { useGeolocation } from '../../../hooks/useGeolocation';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Converts fractional UTC hour to HH:mm string format. */
export function hourToHHmm(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Converts HH:mm or HHmm string format back to fractional UTC hour, or null if invalid. */
export function HHmmToHour(s: string): number | null {
  if (s.length > 20) return null; // Prevent long inputs

  let digits = '';
  for (let i = 0; i < s.length; i++) {
    const charCode = s.charCodeAt(i);
    if (charCode >= 48 && charCode <= 57) { // '0' is 48, '9' is 57
      digits += s[i];
    }
  }

  if (digits.length !== 4) return null;
  const h = parseInt(digits.substring(0, 2), 10);
  const m = parseInt(digits.substring(2, 4), 10);
  if (h >= 0 && h < 24 && m >= 0 && m < 60) {
    return h + m / 60;
  }
  return null;
}

type GeoStatus = ReturnType<typeof useAntennaStore.getState>['geolocationStatus'];

function geoStatusMessage(
  status: GeoStatus,
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

function TIndexInput() {
  const { tIndex, setTIndex } = useAntennaStore(
    useShallow((s) => ({
      tIndex: s.tIndex,
      setTIndex: s.setTIndex,
    }))
  );

  const [localTIndex, setLocalTIndex] = useState(tIndex.toString());
  const [isTIndexFocused, setIsTIndexFocused] = useState(false);

  const [prevTIndex, setPrevTIndex] = useState(tIndex);
  if (tIndex !== prevTIndex) {
    setPrevTIndex(tIndex);
    if (!isTIndexFocused) {
      setLocalTIndex(tIndex.toString());
    }
  }

  return (
    <>
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
          aria-describedby="t-index-hint"
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
      <p id="t-index-hint" style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
        Australian IPS T-index. ~30 = quiet, ~100 = active. Look up today&apos;s
        value from your usual space-weather source.
      </p>
    </>
  );
}

function LatitudeInput() {
  const { latitudeDeg, setLatitude } = useAntennaStore(
    useShallow((s) => ({
      latitudeDeg: s.latitudeDeg,
      setLatitude: s.setLatitude,
    }))
  );
  const { status: geoStatus, requestLocation } = useGeolocation();

  const [localLat, setLocalLat] = useState(latitudeDeg?.toString() ?? '');
  const [isLatFocused, setIsLatFocused] = useState(false);

  const [prevLat, setPrevLat] = useState(latitudeDeg);
  if (latitudeDeg !== prevLat) {
    setPrevLat(latitudeDeg);
    if (!isLatFocused) {
      setLocalLat(latitudeDeg?.toString() ?? '');
    }
  }

  return (
    <>
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
          aria-describedby="lat-hint"
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
          aria-busy={geoStatus === 'requesting'}
          style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Use the browser geolocation API to populate latitude. Asks for permission only when clicked."
        >
          {geoStatus === 'requesting' && <div className="spinner" aria-hidden="true" />}
          {geoStatus === 'requesting' ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      <p id="lat-hint" aria-live="polite" style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 10px' }}>
        {geoStatusMessage(geoStatus, latitudeDeg)}
      </p>
    </>
  );
}

function MonthInput() {
  const { monthOverride, setMonthOverride } = useAntennaStore(
    useShallow((s) => ({
      monthOverride: s.monthOverride,
      setMonthOverride: s.setMonthOverride,
    }))
  );

  const now = new Date();
  const autoMonth = now.getUTCMonth() + 1;

  return (
    <>
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
          aria-describedby="month-hint"
        >
          <option value="">Auto ({MONTH_NAMES[autoMonth - 1]})</option>
          {MONTH_NAMES.map((n, i) => (
            <option key={n} value={i + 1}>{n}</option>
          ))}
        </select>
      </div>
      <div id="month-hint" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        Month for ionospheric prediction. Leave as Auto to use current time.
      </div>
    </>
  );
}

function UtcHourInput() {
  const { utcHourOverride, setUtcHourOverride } = useAntennaStore(
    useShallow((s) => ({
      utcHourOverride: s.utcHourOverride,
      setUtcHourOverride: s.setUtcHourOverride,
    }))
  );

  const now = new Date();
  const autoUtcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const utcHour = utcHourOverride ?? autoUtcHour;

  const [localUtcHour, setLocalUtcHour] = useState(hourToHHmm(utcHour));
  const [isUtcHourFocused, setIsUtcHourFocused] = useState(false);

  const [prevUtcHour, setPrevUtcHour] = useState(utcHour);
  if (utcHour !== prevUtcHour) {
    setPrevUtcHour(utcHour);
    if (!isUtcHourFocused) {
      setLocalUtcHour(hourToHHmm(utcHour));
    }
  }

  return (
    <>
      <label htmlFor="utc-hour-input" style={{ marginTop: 10 }}>
        UTC Hour
      </label>
      <div className="row">
        <input
          id="utc-hour-input"
          type="text"
          maxLength={5}
          placeholder="HH:mm"
          value={localUtcHour}
          onFocus={() => setIsUtcHourFocused(true)}
          aria-label="UTC hour override"
          onChange={(e) => {
            const s = e.target.value;
            setLocalUtcHour(s);
            const val = HHmmToHour(s);
            if (val !== null) {
              setUtcHourOverride(val);
            }
          }}
          onBlur={() => {
            setIsUtcHourFocused(false);
            setLocalUtcHour(hourToHHmm(utcHour));
          }}
        />
        <button
          type="button"
          onClick={() => setUtcHourOverride(null)}
          disabled={utcHourOverride === null}
          style={{ flex: '0 0 auto' }}
          title={utcHourOverride === null ? 'Already using current UTC time' : 'Reset to current UTC time'}
        >
          Auto
        </button>
      </div>
    </>
  );
}

export function PropagationInputs() {
  return (
    <>
      <TIndexInput />
      <LatitudeInput />
      <MonthInput />
      <UtcHourInput />
    </>
  );
}
