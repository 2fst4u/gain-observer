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
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
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
      label: comparisonActive ? 'Current' : 'SWR (raw 50 Ω)',
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

  const stats = useMemo(() => {
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
  }, [sweep]);

  const yMax = useMemo(() => {
    const values = [
      ...sweep.map((point) => point.swr),
      ...(comparisonActive && reference ? reference.sweep.map((point) => point.swr) : []),
    ];
    if (values.length === 0) return 5;

    const maxVal = Math.max(...values);
    const anyBelow2 = values.some((v) => v <= 2);

    if (!anyBelow2) {
      // Entire graph is above 2:1. Show it relative to a reasonable cap,
      // but ensure we can actually see the line.
      return Math.max(10, Math.min(maxVal * 1.1, 999));
    }

    // If we have some points below 2:1, we want to see the 2:1 crossing context.
    return Math.min(999, Math.max(5, Math.ceil(maxVal * 1.1)));
  }, [comparisonActive, reference, sweep]);

  const options = useMemo<ChartOptions<'line'>>(() => {
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
          title: { display: true, text: 'SWR (raw 50 Ω)', color: chartText },
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
          annotations,
        },
      },
    };
  }, [accent, chartGrid, chartText, comparisonActive, frequency, xBounds.max, xBounds.min, yMax, stats]);

  if (!result || sweep.length === 0) {
    return (
      <section className="panel-section" style={{ minHeight: 220 }}>
        {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
        <h2>SWR sweep</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Computing frequency sweep…</div>
      </section>
    );
  }

  return (
    <section className="panel-section" style={{ minHeight: 220 }}>
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>SWR sweep</h2>
      <div style={{ height: 130 }}>
        <Line data={data} options={options} />
      </div>
      {stats && (
        <div style={{ marginTop: 12 }}>
          <div className="stat" style={{ marginBottom: 2 }}>
            <span className="stat-label" style={{ textTransform: 'none' }}>Min SWR</span>
            <span className="stat-value">{stats.minSWR.toFixed(2)}:1 at {stats.minFreq.toFixed(3)} MHz</span>
          </div>
          <div className="stat">
            <span className="stat-label" style={{ textTransform: 'none' }}>2:1 BW</span>
            {stats.fLow !== null && stats.fHigh !== null ? (
              <span className="stat-value">
                {(stats.lowClipped || stats.highClipped) && '>'}
                {((stats.fHigh - stats.fLow) * 1000).toFixed(0)} kHz
                <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontWeight: 'normal' }}>
                  ({stats.fLow.toFixed(3)} - {stats.fHigh.toFixed(3)} MHz)
                </span>
              </span>
            ) : (
              <span className="stat-value" style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>N/A</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
