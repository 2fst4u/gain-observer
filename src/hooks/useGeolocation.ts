// Opt-in geolocation helper.
//
// IMPORTANT: this hook NEVER calls navigator.geolocation on its own. The
// browser's geolocation prompt only appears when the consumer invokes
// requestLocation(). This is by design — gain.observer should not ask
// for location at page load.
//
// The hook stores its lifecycle status in the antenna store
// (geolocationStatus) so other components (e.g. the propagation panel)
// can react to it without mounting this hook.

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../store/antennaStore';

export interface GeolocationResult {
  ok: boolean;
  latitudeDeg?: number;
  longitudeDeg?: number;
  /** A short reason ('denied', 'unsupported', 'timeout', 'error') when ok=false. */
  reason?: string;
}

export function useGeolocation(): {
  status: ReturnType<typeof useAntennaStore.getState>['geolocationStatus'];
  requestLocation: () => Promise<GeolocationResult>;
} {
  // ⚡ Bolt: Group multiple store selections into a single useShallow block
  const { status, setStatus, setLatitude, setLongitude } = useAntennaStore(useShallow((s) => ({
    status: s.geolocationStatus,
    setStatus: s.setGeolocationStatus,
    setLatitude: s.setLatitude,
    setLongitude: s.setLongitude,
  })));

  const requestLocation = useCallback(async (): Promise<GeolocationResult> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported');
      return { ok: false, reason: 'unsupported' };
    }
    setStatus('requesting');
    return new Promise<GeolocationResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setLatitude(latitude);
          setLongitude(longitude);
          setStatus('granted');
          resolve({ ok: true, latitudeDeg: latitude, longitudeDeg: longitude });
        },
        (err) => {
          // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
          if (err.code === 1) {
            setStatus('denied');
            resolve({ ok: false, reason: 'denied' });
          } else if (err.code === 3) {
            setStatus('error');
            resolve({ ok: false, reason: 'timeout' });
          } else {
            setStatus('error');
            resolve({ ok: false, reason: 'error' });
          }
        },
        {
          // We don't need GPS-grade precision for HF propagation maths.
          // Cached fixes up to 10 minutes old are fine.
          enableHighAccuracy: false,
          maximumAge: 10 * 60 * 1000,
          timeout: 10_000,
        },
      );
    });
  }, [setLatitude, setLongitude, setStatus]);

  return { status, requestLocation };
}
