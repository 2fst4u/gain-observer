import { useEffect, useMemo, useState } from 'react';
import {
  bracketingMonths,
  ionosphereParameters,
  loadMonthCoefficients,
  type LayerParameters,
  type MonthCoefficients,
} from '../physics/ionosphere/iri';
import { fetchSmoothedF107, type SolarFluxSample } from '../physics/ionosphere/solarFlux';

export type SolarFluxState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly sample: SolarFluxSample }
  | { readonly status: 'unavailable' };

// One request per month per page load; SWPC updates these files monthly.
const fluxRequests = new Map<string, Promise<SolarFluxSample>>();

function requestFlux(year: number, month: number): Promise<SolarFluxSample> {
  const key = `${year}-${month}`;
  let request = fluxRequests.get(key);
  if (!request) {
    request = fetchSmoothedF107(year, month);
    request.catch(() => fluxRequests.delete(key)); // allow a retry on remount
    fluxRequests.set(key, request);
  }
  return request;
}

/** Smoothed F10.7 for a month from NOAA SWPC. */
export function useSolarFlux(year: number, month: number): SolarFluxState {
  const key = `${year}-${month}`;
  const [state, setState] = useState<{ key: string; value: SolarFluxState }>({ key, value: { status: 'loading' } });
  useEffect(() => {
    let live = true;
    requestFlux(year, month).then(
      (sample) => { if (live) setState({ key, value: { status: 'ready', sample } }); },
      () => { if (live) setState({ key, value: { status: 'unavailable' } }); },
    );
    return () => { live = false; };
  }, [key, year, month]);
  return state.key === key ? state.value : { status: 'loading' };
}

const coefficientCache = new Map<number, MonthCoefficients>();

export type IonosphereState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly layers: LayerParameters }
  | { readonly status: 'error' };

/**
 * Monthly-median layer parameters at a place and time, once the two
 * bracketing months' coefficients have loaded.
 */
export function useIonosphere(date: Date, latitudeDeg: number, longitudeDeg: number, f107: number): IonosphereState {
  const span = bracketingMonths(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  const months = [span.before.month, span.after.month];
  const monthsKey = months.join(',');
  // Months loaded by this component; the module cache serves later mounts.
  const [loaded, setLoaded] = useState<ReadonlyMap<number, MonthCoefficients>>(() => new Map(coefficientCache));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const missing = monthsKey.split(',').map(Number).filter((m) => !coefficientCache.has(m));
    if (missing.length === 0) return;
    let live = true;
    Promise.all(missing.map(async (m) => coefficientCache.set(m, await loadMonthCoefficients(m)))).then(
      () => { if (live) setLoaded(new Map(coefficientCache)); },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
  }, [monthsKey]);

  const time = date.getTime();
  return useMemo((): IonosphereState => {
    const coefficients = (m: number) => loaded.get(m) ?? coefficientCache.get(m);
    if (failed) return { status: 'error' };
    if (!monthsKey.split(',').every((m) => coefficients(Number(m)))) return { status: 'loading' };
    return {
      status: 'ready',
      layers: ionosphereParameters((m) => coefficients(m)!, {
        date: new Date(time), latitudeDeg, longitudeDeg, f107,
      }),
    };
  }, [loaded, monthsKey, failed, time, latitudeDeg, longitudeDeg, f107]);
}
