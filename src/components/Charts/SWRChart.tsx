// Current-frequency SWR chart. For now we plot a single point marking the
// operating frequency against the current SWR; a full frequency sweep requires
// running the solver at N points which is an optimisation we'll add once
// caching is in. The chart still provides a live indicator plus the SWR<2
// threshold for context.

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { useAntennaStore } from '../../store/antennaStore';
import { useMemo } from 'react';

ChartJS.register(
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
);

export function SWRChart() {
  const result = useAntennaStore((s) => s.result);
  const sweep = useAntennaStore((s) => s.sweep);
  const frequency = useAntennaStore((s) => s.frequency);
  const theme = useAntennaStore((s) => s.theme);
  const mode = useAntennaStore((s) => s.mode);
  const reference = useAntennaStore((s) => s.comparisonReference);

  const chartText = getCssVar('--chart-text') || '#aaa';
  const chartGrid = getCssVar('--chart-grid') || 'rgba(255,255,255,0.1)';
  const accent = getCssVar('--accent') || '#4fb3ff';
  const comparisonActive = mode === 'comparison' && Boolean(reference);
  const currentFill = theme === 'dark' ? 'rgba(79, 179, 255, 0.14)' : 'rgba(31, 123, 214, 0.12)';
  const referenceFill = theme === 'dark' ? 'rgba(255, 179, 71, 0.12)' : 'rgba(230, 126, 34, 0.12)';

  const data = useMemo(() => {
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

    datasets.push({
      label: comparisonActive ? 'Current' : 'SWR (50 Ω)',
      data: sweep.map((point) => ({ x: point.frequencyMHz, y: point.swr })),
      borderColor: accent,
      backgroundColor: currentFill,
      fill: false,
      tension: 0.18,
      pointRadius: 0,
      pointHoverRadius: 3,
      pointBackgroundColor: accent,
    });

    return { datasets };
  }, [accent, comparisonActive, currentFill, reference, referenceFill, sweep]);

  const xBounds = useMemo(() => {
    const allFrequencies = [
      ...sweep.map((point) => point.frequencyMHz),
      ...(comparisonActive && reference ? reference.sweep.map((point) => point.frequencyMHz) : []),
    ];
    if (allFrequencies.length === 0) {
      return { min: frequency * 0.95, max: frequency * 1.05 };
    }
    return {
      min: Math.min(...allFrequencies),
      max: Math.max(...allFrequencies),
    };
  }, [comparisonActive, frequency, reference, sweep]);

  const yMax = useMemo(() => {
    const values = [
      ...sweep.map((point) => point.swr),
      ...(comparisonActive && reference ? reference.sweep.map((point) => point.swr) : []),
    ];
    if (values.length === 0) return 5;
    return Math.min(999, Math.max(5, Math.ceil(Math.max(...values) * 1.1)));
  }, [comparisonActive, reference, sweep]);

  const options = useMemo<ChartOptions<'line'>>(() => ({
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
        title: { display: true, text: 'SWR', color: chartText },
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
        display: comparisonActive,
        labels: { color: chartText },
      },
      annotation: {
        annotations: {
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
        },
      },
    },
  }), [accent, chartGrid, chartText, comparisonActive, frequency, xBounds.max, xBounds.min, yMax]);

  if (!result || sweep.length === 0) {
    return (
      <div className="panel-section" style={{ height: 180 }}>
        <h3>SWR sweep</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Computing frequency sweep…</div>
      </div>
    );
  }

  return (
    <div className="panel-section" style={{ height: 180 }}>
      <h3>SWR sweep</h3>
      <div style={{ height: 130 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
