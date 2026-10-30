// useFeedMetrics — the feedpoint metrics shown to the user (impedance, SWR,
// realized gain), computed once per result and feed configuration.
//
// displayedFeedMetrics runs an iterative L-network solve when the ATU is on,
// and the readout, 3D pattern, polar plots and propagation panel all need the
// same answer. Each used to rebuild the feed setup by hand and recompute it on
// every render; this hook memoises it on exactly the fields it depends on.

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore, isFeedlineActive, selectAtuConfig, type AntennaState } from '../store/antennaStore';
import { displayedFeedMetrics, type AtuMatchConfig, type DisplayedFeedMetrics } from '../physics/impedance';
import type { SimulationResult } from '../physics/types';

/** Every model field the displayed feed metrics depend on. */
export type FeedSetupSource = Pick<AntennaState,
  'antennaType' | 'length' | 'height' | 'groundId' | 'frequency'
  | 'feedlineId' | 'feedlineLength' | 'feedlineOffset'
  | 'transformerEnabled' | 'transformerRatio' | 'atuEnabled' | 'atuMainFeedlineLength'>;

export interface FeedMetrics {
  readonly feedlineActive: boolean;
  readonly atu: AtuMatchConfig | undefined;
  /** Undefined while there is no result to evaluate. */
  readonly metrics: DisplayedFeedMetrics | undefined;
}

export function selectFeedSetupSource(s: FeedSetupSource): FeedSetupSource {
  return {
    antennaType: s.antennaType,
    length: s.length,
    height: s.height,
    groundId: s.groundId,
    frequency: s.frequency,
    feedlineId: s.feedlineId,
    feedlineLength: s.feedlineLength,
    feedlineOffset: s.feedlineOffset,
    transformerEnabled: s.transformerEnabled,
    transformerRatio: s.transformerRatio,
    atuEnabled: s.atuEnabled,
    atuMainFeedlineLength: s.atuMainFeedlineLength,
  };
}

export function computeFeedMetrics(source: FeedSetupSource, result: SimulationResult | null | undefined): FeedMetrics {
  const feedlineActive = isFeedlineActive(source);
  const atu = selectAtuConfig(source);
  const metrics = result ? displayedFeedMetrics(result, {
    transformerEnabled: source.transformerEnabled,
    transformerRatio: source.transformerRatio,
    feedlineActive,
    atu,
  }) : undefined;
  return { feedlineActive, atu, metrics };
}

/** Memoised feed metrics for an explicit source (live state or a snapshot). */
export function useFeedMetrics(source: FeedSetupSource | null, result: SimulationResult | null | undefined): FeedMetrics | undefined {
  const {
    antennaType, length, height, groundId, frequency, feedlineId, feedlineLength, feedlineOffset,
    transformerEnabled, transformerRatio, atuEnabled, atuMainFeedlineLength,
  } = source ?? ({} as Partial<FeedSetupSource>);
  const present = source !== null;
  return useMemo(() => present ? computeFeedMetrics({
    antennaType: antennaType!, length: length!, height: height!, groundId: groundId!, frequency: frequency!,
    feedlineId: feedlineId!, feedlineLength: feedlineLength!, feedlineOffset: feedlineOffset!,
    transformerEnabled: transformerEnabled!, transformerRatio: transformerRatio!,
    atuEnabled: atuEnabled!, atuMainFeedlineLength: atuMainFeedlineLength!,
  }, result) : undefined, [
    present, result, antennaType, length, height, groundId, frequency, feedlineId, feedlineLength,
    feedlineOffset, transformerEnabled, transformerRatio, atuEnabled, atuMainFeedlineLength,
  ]);
}

/** Memoised feed metrics for the live model and its latest result. */
export function useLiveFeedMetrics(): FeedMetrics {
  const source = useAntennaStore(useShallow(selectFeedSetupSource));
  const result = useAntennaStore((s) => s.result);
  return useFeedMetrics(source, result)!;
}
