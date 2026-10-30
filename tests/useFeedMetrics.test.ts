import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { computeFeedMetrics, selectFeedSetupSource, useFeedMetrics } from '../src/hooks/useFeedMetrics';
import { useAntennaStore } from '../src/store/antennaStore';
import { makeSimulationResult } from './helpers/factories';

describe('useFeedMetrics', () => {
  const source = selectFeedSetupSource({ ...useAntennaStore.getState(), atuEnabled: true, feedlineId: 'rg58', feedlineLength: 10 });
  const result = makeSimulationResult();

  it('matches the direct computation', () => {
    const { result: hook } = renderHook(() => useFeedMetrics(source, result));
    expect(hook.current).toEqual(computeFeedMetrics(source, result));
    expect(hook.current!.atu).toBeDefined();
  });

  it('reuses the previous answer while its inputs are unchanged', () => {
    const { result: hook, rerender } = renderHook(({ s }) => useFeedMetrics(s, result), { initialProps: { s: source } });
    const first = hook.current;
    rerender({ s: { ...source } });
    expect(hook.current).toBe(first);
    rerender({ s: { ...source, transformerRatio: source.transformerRatio + 3 } });
    expect(hook.current).not.toBe(first);
  });

  it('returns nothing without a source, and no metrics without a result', () => {
    expect(renderHook(() => useFeedMetrics(null, result)).result.current).toBeUndefined();
    expect(renderHook(() => useFeedMetrics(source, null)).result.current!.metrics).toBeUndefined();
  });
});
