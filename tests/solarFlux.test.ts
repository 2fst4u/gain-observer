import { describe, expect, it, vi } from 'vitest';
import { fetchSmoothedF107, selectSmoothedF107, SWPC_OBSERVED_URL, SWPC_PREDICTED_URL } from '../src/physics/ionosphere/solarFlux';

const observed = [
  { 'time-tag': '2025-09', 'f10.7': 153.9, 'smoothed_f10.7': 146.1 },
  { 'time-tag': '2025-10', 'f10.7': 139.7, 'smoothed_f10.7': 142.9 },
  { 'time-tag': '2026-08', 'f10.7': 120, 'smoothed_f10.7': -1 },
  { 'time-tag': '2026-09', 'f10.7': 105.4, 'smoothed_f10.7': -1 },
  { 'time-tag': '2026-10', 'f10.7': 108.5, 'smoothed_f10.7': -1 },
];
const predicted = [{ 'time-tag': '2026-11', 'predicted_f10.7': 126.3 }];

describe('smoothed F10.7 selection', () => {
  it('prefers the smoothed observed value, then the prediction', () => {
    expect(selectSmoothedF107(observed, predicted, 2025, 10)).toEqual({ f107: 142.9, source: 'observed', month: '2025-10' });
    expect(selectSmoothedF107(observed, predicted, 2026, 11)).toEqual({ f107: 126.3, source: 'predicted', month: '2026-11' });
  });

  it('falls back to recent monthly values, ignoring the -1 placeholders', () => {
    const sample = selectSmoothedF107(observed, [], 2026, 10)!;
    expect(sample.source).toBe('recent-monthly');
    expect(sample.f107).toBeCloseTo((120 + 105.4 + 108.5) / 3, 10);
  });

  it('rejects malformed or implausible data', () => {
    expect(selectSmoothedF107({ not: 'an array' }, null, 2026, 11)).toBeUndefined();
    expect(selectSmoothedF107([{ 'time-tag': '2026-11', 'smoothed_f10.7': 1e9 }], [{ 'time-tag': '2026-11', 'predicted_f10.7': '120' }], 2026, 11)).toBeUndefined();
    expect(selectSmoothedF107([null, 5, { 'time-tag': 7 }], [], 2026, 11)).toBeUndefined();
  });

  it('fetches only the two SWPC files, without credentials or referrer', async () => {
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => (url === SWPC_PREDICTED_URL ? predicted : observed) }));
    const sample = await fetchSmoothedF107(2026, 11, fetchMock as unknown as typeof fetch);
    expect(sample.f107).toBe(126.3);
    expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([SWPC_OBSERVED_URL, SWPC_PREDICTED_URL].sort());
    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(init).toEqual({ credentials: 'omit', referrerPolicy: 'no-referrer' });
    }
  });

  it('rejects when SWPC is unreachable', async () => {
    const failing = vi.fn(async () => ({ ok: false, status: 503, json: async () => [] }));
    await expect(fetchSmoothedF107(2026, 11, failing as unknown as typeof fetch)).rejects.toThrow('503');
  });
});
