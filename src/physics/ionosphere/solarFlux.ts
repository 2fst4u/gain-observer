// 12-month smoothed solar 10.7 cm flux for the monthly-median ionosphere,
// from NOAA SWPC's public solar-cycle products (US Government work, public
// domain). The smoothed observed value lags about six months, so newer
// months use SWPC's predicted smoothed flux.

export const SWPC_OBSERVED_URL = 'https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle-indices.json';
export const SWPC_PREDICTED_URL = 'https://services.swpc.noaa.gov/json/solar-cycle/predicted-solar-cycle.json';

/** Fallback when SWPC cannot be reached: roughly mid-cycle. */
export const FALLBACK_F107 = 100;

export type SolarFluxSource = 'observed' | 'predicted' | 'recent-monthly';

export interface SolarFluxSample {
  readonly f107: number;
  readonly source: SolarFluxSource;
  /** "YYYY-MM" of the value used. */
  readonly month: string;
}

/** Values outside this range are not plausible F10.7 and are rejected. */
function plausible(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 50 && value <= 400;
}

function rows(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> =>
    typeof row === 'object' && row !== null && typeof (row as Record<string, unknown>)['time-tag'] === 'string');
}

/**
 * Smoothed F10.7 for a month: SWPC's smoothed observed value if published,
 * else its predicted smoothed value, else the mean of the three latest
 * monthly observed values. Undefined when neither file has anything usable.
 */
export function selectSmoothedF107(observed: unknown, predicted: unknown, year: number, month: number): SolarFluxSample | undefined {
  const tag = `${year}-${String(month).padStart(2, '0')}`;
  const obs = rows(observed);
  const smoothed = obs.find((row) => row['time-tag'] === tag)?.['smoothed_f10.7'];
  if (plausible(smoothed)) return { f107: smoothed, source: 'observed', month: tag };
  const forecast = rows(predicted).find((row) => row['time-tag'] === tag)?.['predicted_f10.7'];
  if (plausible(forecast)) return { f107: forecast, source: 'predicted', month: tag };
  const recent = obs.filter((row) => plausible(row['f10.7']) && (row['time-tag'] as string) <= tag).slice(-3);
  if (recent.length === 0) return undefined;
  const mean = recent.reduce((sum, row) => sum + (row['f10.7'] as number), 0) / recent.length;
  return { f107: mean, source: 'recent-monthly', month: recent[recent.length - 1]!['time-tag'] as string };
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`SWPC responded ${response.status}`);
  return response.json();
}

/** Fetch and select the smoothed flux for a month. Rejects if SWPC is unreachable. */
export async function fetchSmoothedF107(year: number, month: number, fetchImpl: typeof fetch = fetch): Promise<SolarFluxSample> {
  const [observed, predicted] = await Promise.all([
    getJson(SWPC_OBSERVED_URL, fetchImpl),
    getJson(SWPC_PREDICTED_URL, fetchImpl).catch(() => []),
  ]);
  const sample = selectSmoothedF107(observed, predicted, year, month);
  if (!sample) throw new Error('No usable F10.7 in the SWPC data');
  return sample;
}
