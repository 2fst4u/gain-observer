import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore, selectSwrWindow, type ComparisonSnapshot } from '../../store/antennaStore';
import { type SweepPoint } from '../../physics/types';
import {
  computeChartData,
  computeStats,
  computeYMax,
  computeOptions,
} from './swrChartUtils';

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useChartTheme(theme: string) {
  const chartText = getCssVar('--chart-text') || '#aaa';
  const chartGrid = getCssVar('--chart-grid') || 'rgba(255,255,255,0.1)';
  const accent = getCssVar('--accent') || '#4fb3ff';
  const currentFill = theme === 'dark' ? 'rgba(79, 179, 255, 0.14)' : 'rgba(31, 123, 214, 0.12)';
  const referenceFill = theme === 'dark' ? 'rgba(255, 179, 71, 0.12)' : 'rgba(230, 126, 34, 0.12)';
  return { chartText, chartGrid, accent, currentFill, referenceFill };
}

function useChartBounds(swrViewCenterMHz: number, swrViewSpanMHz: number) {
  return useMemo(
    () => {
      const { startMHz, endMHz } = selectSwrWindow({ swrViewCenterMHz, swrViewSpanMHz });
      return { min: startMHz, max: endMHz };
    },
    [swrViewCenterMHz, swrViewSpanMHz]
  );
}

function useChartData(
  comparisonActive: boolean,
  reference: ComparisonSnapshot | null,
  referenceFill: string,
  transformerInDisplay: boolean,
  transformerRatio: number,
  sweep: readonly SweepPoint[],
  accent: string,
  currentFill: string
) {
  return useMemo(
    () =>
      computeChartData({
        comparisonActive,
        reference,
        referenceFill,
        transformerInDisplay,
        transformerRatio,
        sweep,
        accent,
        currentFill,
      }),
    [accent, comparisonActive, currentFill, reference, referenceFill, sweep, transformerInDisplay, transformerRatio]
  );
}

function useChartStats(sweep: readonly SweepPoint[], transformerInDisplay: boolean, transformerRatio: number) {
  return useMemo(
    () => computeStats({ sweep, transformerInDisplay, transformerRatio }),
    [sweep, transformerInDisplay, transformerRatio]
  );
}

function useChartYMax(sweep: readonly SweepPoint[], comparisonActive: boolean, reference: ComparisonSnapshot | null, transformerInDisplay: boolean, transformerRatio: number) {
  return useMemo(
    () =>
      computeYMax({
        sweep,
        comparisonActive,
        reference,
        transformerInDisplay,
        transformerRatio,
      }),
    [comparisonActive, reference, sweep, transformerInDisplay, transformerRatio]
  );
}

function useChartOptions(
  frequency: number,
  accent: string,
  stats: ReturnType<typeof computeStats>,
  yMax: number,
  xBounds: { min: number; max: number },
  chartText: string,
  chartGrid: string,
  comparisonActive: boolean
) {
  return useMemo(
    () =>
      computeOptions({
        frequency,
        accent,
        stats,
        yMax,
        xBounds,
        chartText,
        chartGrid,
        comparisonActive,
      }),
    [accent, chartGrid, chartText, comparisonActive, frequency, xBounds, yMax, stats]
  );
}

export function useSWRChartConfig() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    result,
    sweep,
    frequency,
    theme,
    mode,
    comparisonReference: reference,
    transformerEnabled,
    transformerRatio,
    feedlineId,
    swrViewCenterMHz,
    swrViewSpanMHz,
  } = useAntennaStore(useShallow((s) => ({
    result: s.result,
    sweep: s.sweep,
    frequency: s.frequency,
    theme: s.theme,
    mode: s.mode,
    comparisonReference: s.comparisonReference,
    transformerEnabled: s.transformerEnabled,
    transformerRatio: s.transformerRatio,
    feedlineId: s.feedlineId,
    swrViewCenterMHz: s.swrViewCenterMHz,
    swrViewSpanMHz: s.swrViewSpanMHz,
  })));

  const feedlineActive = feedlineId !== 'none';
  const transformerInDisplay = transformerEnabled && !feedlineActive && transformerRatio > 1;
  const comparisonActive = mode === 'comparison' && Boolean(reference);

  const { chartText, chartGrid, accent, currentFill, referenceFill } = useChartTheme(theme);

  const data = useChartData(
    comparisonActive,
    reference,
    referenceFill,
    transformerInDisplay,
    transformerRatio,
    sweep,
    accent,
    currentFill
  );

  const xBounds = useChartBounds(swrViewCenterMHz, swrViewSpanMHz);
  const stats = useChartStats(sweep, transformerInDisplay, transformerRatio);
  const yMax = useChartYMax(sweep, comparisonActive, reference, transformerInDisplay, transformerRatio);
  const options = useChartOptions(frequency, accent, stats, yMax, xBounds, chartText, chartGrid, comparisonActive);

  return { result, sweep, data, options, stats };
}
