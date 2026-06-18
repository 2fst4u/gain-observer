

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { useMemo } from 'react';
import {
  computeChartData,
  computeXBounds,
  computeStats,
  computeYMax,
  computeOptions,
  formatBandwidth,
} from './swrChartUtils';
import { StatRow } from '../UI/StatRow';

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
  })));

  // Transformer location:
  //   • In the NEC model (feedline + ratio>1): swept Z already includes it.
  //   • In display only (no feedline + ratio>1): swept Z is the raw antenna,
  //     and we apply Z/ratio here.
  //   • Otherwise: one line, no transform.
  const feedlineActive = feedlineId !== 'none';
  const transformerInDisplay = transformerEnabled && !feedlineActive && transformerRatio > 1;

  const chartText = getCssVar('--chart-text') || '#aaa';
  const chartGrid = getCssVar('--chart-grid') || 'rgba(255,255,255,0.1)';
  const accent = getCssVar('--accent') || '#4fb3ff';
  const comparisonActive = mode === 'comparison' && Boolean(reference);
  const currentFill = theme === 'dark' ? 'rgba(79, 179, 255, 0.14)' : 'rgba(31, 123, 214, 0.12)';
  const referenceFill = theme === 'dark' ? 'rgba(255, 179, 71, 0.12)' : 'rgba(230, 126, 34, 0.12)';

  const data = useMemo(
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

  const xBounds = useMemo(
    () => computeXBounds({ sweep, comparisonActive, reference, frequency }),
    [comparisonActive, frequency, reference, sweep]
  );

  const stats = useMemo(
    () => computeStats({ sweep, transformerInDisplay, transformerRatio }),
    [sweep, transformerInDisplay, transformerRatio],
  );

  const yMax = useMemo(
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

  const options = useMemo(
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

  if (!result || sweep.length === 0) {
    return (
      <section className="panel-section" style={{ minHeight: 220 }}>
        {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
        <h2>SWR sweep</h2>
        <div role="status" aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="spinner" aria-hidden="true" /> Computing frequency sweep…
        </div>
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
      {stats && <SWRChartStats stats={stats} />}
    </section>
  );
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface SWRChartStatsProps {
  stats: ReturnType<typeof computeStats>;
}

function SWRChartStats({ stats }: SWRChartStatsProps) {
  if (!stats) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <StatRow
        style={{ marginBottom: 2 }}
        labelStyle={{ textTransform: 'none' }}
        label="Min SWR"
        value={`${stats.minSWR.toFixed(2)}:1 at ${stats.minFreq.toFixed(3)} MHz`}
      />
      <StatRow
        style={{ alignItems: 'flex-start' }}
        labelStyle={{ textTransform: 'none' }}
        label="2:1 BW"
        value={
          stats.bands.length > 0 ? (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              {stats.bands.map((band, i) => (
                <span key={i}>
                  {(band.lowClipped || band.highClipped) && '>'}
                  {formatBandwidth(band.fHigh - band.fLow)}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontWeight: 'normal' }}>
                    ({band.fLow.toFixed(3)} - {band.fHigh.toFixed(3)} MHz)
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>N/A</span>
          )
        }
      />
    </div>
  );
}
