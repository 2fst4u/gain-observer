import type { ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import type { SweepPoint } from '../../physics/types';
import { isFeedlineActive, selectAtuConfig, type ComparisonSnapshot } from '../../store/antennaStore';
import { atuLossDb, swr as computeSwr } from '../../physics/impedance';
import { ATU_COMPONENT_Q } from '../../physics/constants';
import { findSwrBands, type SwrBand } from '../../physics/bandwidth';

/**
 * Format a bandwidth (MHz wide) for display, scaling the unit by magnitude:
 * sub-MHz spans read in kHz, wider spans in MHz.
 */
export function formatBandwidth(widthMHz: number): string {
  const kHz = widthMHz * 1000;
  if (kHz < 1000) return `${Math.round(kHz)} kHz`;
  return `${widthMHz.toFixed(2)} MHz`;
}

interface SweepDisplayConfig {
  transformerInDisplay?: boolean;
  transformerRatio?: number;
  /** Each point is retuned independently; this is not a fixed tuner sweep. */
  atuEnabled?: boolean;
}

function referenceConfig(reference: ComparisonSnapshot): SweepDisplayConfig {
  return {
    transformerInDisplay: reference.transformerEnabled && !isFeedlineActive(reference) && reference.transformerRatio > 1,
    transformerRatio: reference.transformerRatio,
    atuEnabled: Boolean(selectAtuConfig(reference)),
  };
}

function effectiveSwr(point: SweepPoint, config: SweepDisplayConfig): number {
  const impedance = config.transformerInDisplay
    ? { R: point.R / config.transformerRatio!, X: point.X / config.transformerRatio! }
    : { R: point.R, X: point.X };
  if (config.atuEnabled) {
    return Number.isFinite(atuLossDb(impedance, ATU_COMPONENT_Q)) ? 1 : computeSwr(impedance);
  }
  return config.transformerInDisplay
    ? computeSwr(impedance)
    : point.swr;
}

interface ComputeChartDataArgs extends SweepDisplayConfig {
  comparisonActive: boolean;
  reference: ComparisonSnapshot | null;
  referenceFill: string;
  sweep: readonly SweepPoint[];
  accent: string;
  currentFill: string;
}

export function computeChartData(args: ComputeChartDataArgs) {
  const { comparisonActive, reference, referenceFill, sweep, accent, currentFill } = args;
  function dataset(points: readonly SweepPoint[], config: SweepDisplayConfig, label: string, color: string, fill: string, referenceLine = false) {
    return {
      label: config.atuEnabled ? `${label} (ATU retuned at each frequency)`
        : config.transformerInDisplay && comparisonActive ? `${label} (after ${config.transformerRatio}:1)` : label,
      data: points.map((point) => ({ x: point.frequencyMHz, y: effectiveSwr(point, config) })),
      borderColor: color,
      backgroundColor: fill,
      fill: false,
      // Use the sampled straight segments: smoothing can invent SWR extrema
      // and threshold crossings that NEC never calculated.
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: color,
      ...(referenceLine ? { borderDash: [8, 4] } : {}),
    };
  }
  const datasets = [];
  if (comparisonActive && reference) {
    datasets.push(dataset(reference.sweep, referenceConfig(reference), 'Reference', 'rgba(255, 179, 71, 0.9)', referenceFill, true));
  }
  datasets.push(dataset(sweep, args, comparisonActive ? 'Current' : 'SWR (vs 50 Ω)', accent, currentFill));
  return { datasets };
}

interface SWRStats {
  minSWR: number;
  minFreq: number;
  /** Every contiguous ≤2:1 band in the sweep, ascending by frequency. */
  bands: SwrBand[];
}

interface ComputeStatsArgs extends SweepDisplayConfig {
  sweep: readonly SweepPoint[];
}

export function computeStats({
  sweep,
  transformerInDisplay = false,
  transformerRatio = 1,
  atuEnabled = false,
}: ComputeStatsArgs): SWRStats | null {
  // Independently retuned points say nothing about antenna/fixed-tuner BW.
  if (sweep.length === 0 || atuEnabled) return null;
  const config = { transformerInDisplay, transformerRatio };

  const len = sweep.length;

  let minSWR = Infinity;
  let minFreq = 0;

  for (let i = 0; i < len; i++) {
    const pt = sweep[i]!;
    const f = pt.frequencyMHz;
    const s = effectiveSwr(pt, config);

    if (s < minSWR) {
      minSWR = s;
      minFreq = f;
    }
  }

  return {
    minSWR,
    minFreq,
    bands: findSwrBands(
      sweep,
      (pt) => pt.frequencyMHz,
      (pt) => effectiveSwr(pt, config),
      2,
    ),
  };
}

interface ComputeYMaxArgs extends SweepDisplayConfig {
  sweep: readonly SweepPoint[];
  comparisonActive: boolean;
  reference: ComparisonSnapshot | null;
}

export function computeYMax(args: ComputeYMaxArgs) {
  const { sweep, comparisonActive, reference } = args;
  if (sweep.length === 0 && (!comparisonActive || !reference || reference.sweep.length === 0)) return 5;
  let maxVal = -Infinity;
  for (const point of sweep) {
    const value = effectiveSwr(point, args);
    if (value > maxVal) maxVal = value;
  }
  if (comparisonActive && reference) {
    const config = referenceConfig(reference);
    for (const point of reference.sweep) {
      const value = effectiveSwr(point, config);
      if (value > maxVal) maxVal = value;
    }
  }
  if (maxVal === -Infinity) return 5;

  // The y-axis is a FIXED reference frame — it never zooms vertically. Only the
  // lateral (frequency) axis is user-controllable, so the y-scale must stay
  // stable as the user pans/zooms across the sweep. Very high SWR is clipped at
  // SWR_CAP: its exact magnitude is irrelevant, all that matters is where the
  // curve sits at the low (well-matched) values.
  //
  //  • 1.5× multiplier leaves headroom above the highest in-frame SWR point.
  //  • Floor of 3 keeps the 2:1 reference line visible (≥ 33 % of chart height)
  //    even when the antenna is extremely well-matched.
  //  • Cap of 10 prevents tall spikes (20–50:1, or an all-mismatched window)
  //    from compressing the low-SWR region to an invisible sliver; values
  //    above the cap are clipped at the top — a clear "very high SWR" signal.
  const SWR_CAP = 10;
  const scaled = Math.max(3, Math.ceil(maxVal * 1.5));
  return Math.min(scaled, SWR_CAP);
}

interface ComputeOptionsArgs {
  frequency: number;
  accent: string;
  stats: SWRStats | null;
  yMax: number;
  xBounds: { min: number; max: number };
  chartText: string;
  chartGrid: string;
  comparisonActive: boolean;
}

export function buildAnnotations(
  frequency: number,
  accent: string,
  stats: SWRStats | null
): Record<string, AnnotationOptions> {
  const annotations: Record<string, AnnotationOptions> = {
    swr2: {
      type: 'line',
      yMin: 2,
      yMax: 2,
      borderColor: '#ff6b6b',
      borderWidth: 1,
      borderDash: [6, 4],
    },
    currentFrequency: {
      type: 'line',
      xMin: frequency,
      xMax: frequency,
      borderColor: accent,
      borderWidth: 1,
      borderDash: [4, 4],
    },
  };

  if (stats) {
    annotations.minFreq = {
      type: 'line',
      xMin: stats.minFreq,
      xMax: stats.minFreq,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderWidth: 1,
      borderDash: [2, 2],
    };
    // Edge markers for every ≤2:1 band. Clipped edges (band runs off the
    // swept range) are not marked — there's no real crossing to show.
    for (let i = 0; i < stats.bands.length; i++) {
      const band = stats.bands[i];
      if (!band.lowClipped) {
        annotations[`band${i}Low`] = {
          type: 'line',
          xMin: band.fLow,
          xMax: band.fLow,
          borderColor: 'rgba(255, 107, 107, 0.4)',
          borderWidth: 1,
          borderDash: [4, 4],
        };
      }
      if (!band.highClipped) {
        annotations[`band${i}High`] = {
          type: 'line',
          xMin: band.fHigh,
          xMax: band.fHigh,
          borderColor: 'rgba(255, 107, 107, 0.4)',
          borderWidth: 1,
          borderDash: [4, 4],
        };
      }
    }
  }

  return annotations;
}

export function buildScales(
  yMax: number,
  xBounds: { min: number; max: number },
  chartText: string,
  chartGrid: string
): ChartOptions<'line'>['scales'] {
  return {
    y: {
      min: 1,
      max: yMax,
      ticks: { color: chartText },
      grid: { color: chartGrid },
      title: { display: true, text: 'SWR (vs 50 Ω)', color: chartText },
    },
    x: {
      type: 'linear',
      min: xBounds.min,
      max: xBounds.max,
      ticks: {
        color: chartText,
        callback: (value) => Number(value).toFixed(2),
      },
      grid: { color: chartGrid },
      title: { display: true, text: 'MHz', color: chartText },
    },
  };
}

function buildPlugins(
  comparisonActive: boolean,
  chartText: string,
  annotations: Record<string, AnnotationOptions>
): ChartOptions<'line'>['plugins'] {
  return {
    legend: {
      // Show the legend only when multiple curves coexist: comparison mode
      // has two curves (reference + current). When the transformer is active
      // outside comparison mode there is only one curve (post-balun), so the
      // legend would just repeat the axis title and is suppressed.
      display: comparisonActive,
      labels: { color: chartText },
    },
    annotation: {
      annotations,
    },
  };
}

export function computeOptions({
  frequency,
  accent,
  stats,
  yMax,
  xBounds,
  chartText,
  chartGrid,
  comparisonActive,
}: ComputeOptionsArgs): ChartOptions<'line'> {
  const annotations = buildAnnotations(frequency, accent, stats);
  const scales = buildScales(yMax, xBounds, chartText, chartGrid);
  const plugins = buildPlugins(comparisonActive, chartText, annotations);

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    parsing: false,
    scales,
    plugins,
  };
}
