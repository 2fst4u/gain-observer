import type { ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import type { SweepPoint } from '../../physics/types';
import type { ComparisonSnapshot } from '../../store/antennaStore';
import { swr as computeSwr } from '../../physics/impedance';

export interface ComputeChartDataArgs {
  comparisonActive: boolean;
  reference: ComparisonSnapshot | null;
  referenceFill: string;
  transformerInDisplay: boolean;
  transformerRatio: number;
  sweep: readonly SweepPoint[];
  accent: string;
  currentFill: string;
}

export function computeChartData({
  comparisonActive,
  reference,
  referenceFill,
  transformerInDisplay,
  transformerRatio,
  sweep,
  accent,
  currentFill,
}: ComputeChartDataArgs) {
  const datasets: Array<{
    label: string;
    data: Array<{ x: number; y: number }>;
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
    tension: number;
    pointRadius: number;
    pointHoverRadius: number;
    pointBackgroundColor: string;
    borderDash?: number[];
  }> = [];

  if (comparisonActive && reference) {
    datasets.push({
      label: 'Reference',
      data: reference.sweep.map((point) => ({ x: point.frequencyMHz, y: point.swr })),
      borderColor: 'rgba(255, 179, 71, 0.9)',
      backgroundColor: referenceFill,
      fill: false,
      tension: 0.18,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: '#ffb347',
      borderDash: [8, 4],
    });
  }

  const rawLabel = comparisonActive
    ? (transformerInDisplay ? 'Current (raw)' : 'Current')
    : (transformerInDisplay ? 'Raw (vs 50 Ω)' : 'SWR (vs 50 Ω)');

  datasets.push({
    label: rawLabel,
    data: sweep.map((point) => ({ x: point.frequencyMHz, y: point.swr })),
    borderColor: accent,
    backgroundColor: currentFill,
    fill: false,
    tension: 0.18,
    pointRadius: 0,
    pointHoverRadius: 3,
    pointBackgroundColor: accent,
  });

  if (transformerInDisplay) {
    datasets.push({
      label: `After ${transformerRatio}:1 xfmr`,
      data: sweep.map((point) => ({
        x: point.frequencyMHz,
        y: computeSwr({ R: point.R / transformerRatio, X: point.X / transformerRatio }),
      })),
      borderColor: 'rgba(80, 200, 120, 0.9)',
      backgroundColor: 'rgba(80, 200, 120, 0.1)',
      fill: false,
      tension: 0.18,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: '#50c878',
      borderDash: [6, 3],
    });
  }

  return { datasets };
}

export interface ComputeXBoundsArgs {
  sweep: readonly SweepPoint[];
  comparisonActive: boolean;
  reference: ComparisonSnapshot | null;
  frequency: number;
}

export function computeXBounds({ sweep, comparisonActive, reference, frequency }: ComputeXBoundsArgs) {
  if (sweep.length === 0 && (!comparisonActive || !reference || reference.sweep.length === 0)) {
    return { min: frequency * 0.95, max: frequency * 1.05 };
  }

  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < sweep.length; i++) {
    const freq = sweep[i].frequencyMHz;
    if (freq < min) min = freq;
    if (freq > max) max = freq;
  }

  if (comparisonActive && reference) {
    for (let i = 0; i < reference.sweep.length; i++) {
      const freq = reference.sweep[i].frequencyMHz;
      if (freq < min) min = freq;
      if (freq > max) max = freq;
    }
  }

  return { min, max };
}

export interface SWRStats {
  minSWR: number;
  minFreq: number;
  fLow: number | null;
  fHigh: number | null;
  lowClipped: boolean;
  highClipped: boolean;
}

export function computeStats(sweep: readonly SweepPoint[]): SWRStats | null {
  if (sweep.length === 0) return null;
  let minSWR = Infinity;
  let minFreq = 0;
  for (const pt of sweep) {
    if (pt.swr < minSWR) {
      minSWR = pt.swr;
      minFreq = pt.frequencyMHz;
    }
  }
  let fLow: number | null = null;
  let fHigh: number | null = null;
  for (let i = 0; i < sweep.length - 1; i++) {
    const p1 = sweep[i];
    const p2 = sweep[i + 1];
    if (p1.swr >= 2 && p2.swr <= 2) {
      const t = (2 - p1.swr) / (p2.swr - p1.swr);
      fLow = p1.frequencyMHz + t * (p2.frequencyMHz - p1.frequencyMHz);
    } else if (p1.swr <= 2 && p2.swr >= 2) {
      const t = (2 - p1.swr) / (p2.swr - p1.swr);
      fHigh = p1.frequencyMHz + t * (p2.frequencyMHz - p1.frequencyMHz);
    }
  }

  const lowClipped = fLow === null && sweep[0].swr <= 2;
  const highClipped = fHigh === null && sweep[sweep.length - 1].swr <= 2;

  if (lowClipped) fLow = sweep[0].frequencyMHz;
  if (highClipped) fHigh = sweep[sweep.length - 1].frequencyMHz;

  return { minSWR, minFreq, fLow, fHigh, lowClipped, highClipped };
}

export interface ComputeYMaxArgs {
  sweep: readonly SweepPoint[];
  comparisonActive: boolean;
  reference: ComparisonSnapshot | null;
  transformerInDisplay: boolean;
  transformerRatio: number;
}

export function computeYMax({
  sweep,
  comparisonActive,
  reference,
  transformerInDisplay,
  transformerRatio,
}: ComputeYMaxArgs) {
  if (sweep.length === 0 && (!comparisonActive || !reference || reference.sweep.length === 0)) {
    return 5;
  }

  let maxVal = -Infinity;
  let anyBelow2 = false;

  for (let i = 0; i < sweep.length; i++) {
    const v = sweep[i].swr;
    if (v > maxVal) maxVal = v;
    if (v <= 2) anyBelow2 = true;

    if (transformerInDisplay) {
      const v2 = computeSwr({ R: sweep[i].R / transformerRatio, X: sweep[i].X / transformerRatio });
      if (v2 > maxVal) maxVal = v2;
      if (v2 <= 2) anyBelow2 = true;
    }
  }

  if (comparisonActive && reference) {
    for (let i = 0; i < reference.sweep.length; i++) {
      const v = reference.sweep[i].swr;
      if (v > maxVal) maxVal = v;
      if (v <= 2) anyBelow2 = true;
    }
  }

  if (maxVal === -Infinity) return 5;

  if (!anyBelow2) {
    return Math.max(10, Math.min(maxVal * 1.1, 999));
  }

  return Math.min(999, Math.max(5, Math.ceil(maxVal * 1.1)));
}

export interface ComputeOptionsArgs {
  frequency: number;
  accent: string;
  stats: SWRStats | null;
  yMax: number;
  xBounds: { min: number; max: number };
  chartText: string;
  chartGrid: string;
  comparisonActive: boolean;
  transformerEnabled: boolean;
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
  transformerEnabled,
}: ComputeOptionsArgs): ChartOptions<'line'> {
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
    if (stats.fLow !== null) {
      annotations.fLow = {
        type: 'line',
        xMin: stats.fLow,
        xMax: stats.fLow,
        borderColor: 'rgba(255, 107, 107, 0.4)',
        borderWidth: 1,
        borderDash: [4, 4],
      };
    }
    if (stats.fHigh !== null) {
      annotations.fHigh = {
        type: 'line',
        xMin: stats.fHigh,
        xMax: stats.fHigh,
        borderColor: 'rgba(255, 107, 107, 0.4)',
        borderWidth: 1,
        borderDash: [4, 4],
      };
    }
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    parsing: false,
    scales: {
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
    },
    plugins: {
      legend: {
        display: comparisonActive || transformerEnabled,
        labels: { color: chartText },
      },
      annotation: {
        annotations,
      },
    },
  };
}
