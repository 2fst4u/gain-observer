import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSWRChartConfig } from '../src/components/Charts/useSWRChartConfig';
import { useAntennaStore } from '../src/store/antennaStore';
import { makeSimulationResult } from './helpers/factories';

const original = useAntennaStore.getState();
afterEach(() => useAntennaStore.setState(original, true));

describe('effective tuner state in the SWR chart', () => {
  it('shows antenna SWR and bandwidth when a stored ATU flag has no cable', () => {
    useAntennaStore.setState({
      result: makeSimulationResult({ impedance: { R: 200, X: 0 }, swr: 4 }),
      sweep: [{ frequencyMHz: 7.1, R: 200, X: 0, swr: 4 }],
      feedlineId: 'none', atuEnabled: true, transformerEnabled: false,
    });
    const { result, unmount } = renderHook(() => useSWRChartConfig());
    expect(result.current.atuEnabled).toBe(false);
    expect(result.current.data.datasets[0]!.data[0]!.y).toBe(4);
    expect(result.current.stats?.minSWR).toBe(4);
    unmount();
  });
});
