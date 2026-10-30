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
import { useEffect, useRef, useState } from 'react';
import {
  computeStats,
  formatBandwidth,
} from './swrChartUtils';
import { StatRow } from '../UI/StatRow';
import { useSWRChartConfig } from './useSWRChartConfig';

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
  const error = useAntennaStore((s) => s.error);
  const { result, sweep, data, options, stats, atuEnabled } = useSWRChartConfig();
  const { wrapperRef, chartRef, onPointerDown, dragging } = useSwrViewGestures();

  if (!result || sweep.length === 0) {
    return (
      <section className="panel-section" style={{ minHeight: 220 }}>
        {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
        <h2>SWR sweep</h2>
        <div role="status" aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {error ? 'Frequency sweep unavailable for this configuration.' : <><div className="spinner" aria-hidden="true" /> Computing frequency sweep…</>}
        </div>
      </section>
    );
  }

  return (
    <section className="panel-section" style={{ minHeight: 220 }}>
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>SWR sweep</h2>
      <div
        ref={wrapperRef}
        onPointerDown={onPointerDown}
        style={{ height: 130, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <Line ref={chartRef} data={data} options={options} />
      </div>
      <SWRZoomControls />
      {stats && <SWRChartStats stats={stats} />}
      {atuEnabled && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>ATU retuned at each frequency. A matched source curve does not establish antenna bandwidth or radiation efficiency.</p>}
    </section>
  );
}

/**
 * Wheel-to-zoom (centred on the cursor frequency) and drag-to-pan for the SWR
 * chart. Both update the store's view window, which re-samples the sweep over
 * the new range — so zooming in reveals finer detail rather than upscaling a
 * fixed dataset.
 */
function useSwrViewGestures() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const dragRef = useRef<{ startX: number; mhzPerPixel: number; startCenter: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // ⚡ Bolt: Group multiple store selections into a single useShallow block
  const { zoomSwrView, panSwrViewByMHz } = useAntennaStore(useShallow((s) => ({
    zoomSwrView: s.zoomSwrView,
    panSwrViewByMHz: s.panSwrViewByMHz,
  })));

  // Non-passive wheel listener so we can preventDefault and stop the panel
  // scrolling while zooming the chart.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const chart = chartRef.current;
      if (!chart) return;
      e.preventDefault();
      const rect = chart.canvas.getBoundingClientRect();
      const xScale = chart.scales.x;
      const pivot = xScale ? Number(xScale.getValueForPixel(e.clientX - rect.left)) : undefined;
      // Wheel up (deltaY < 0) zooms in (narrower span).
      const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85;
      zoomSwrView(factor, Number.isFinite(pivot) ? pivot : undefined);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomSwrView]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // primary button only
    const chart = chartRef.current;
    if (!chart || !chart.chartArea) return;
    const span = useAntennaStore.getState().swrViewSpanMHz;
    const width = chart.chartArea.right - chart.chartArea.left;
    if (width <= 0) return;
    // Capture a fixed reference frame at grab time so panning maps pixel travel
    // to MHz against the pre-drag scale (avoids feedback as the axis shifts).
    dragRef.current = {
      startX: e.clientX,
      mhzPerPixel: span / width,
      startCenter: useAntennaStore.getState().swrViewCenterMHz,
    };
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaMHz = -(ev.clientX - drag.startX) * drag.mhzPerPixel;
      const targetCenter = drag.startCenter + deltaMHz;
      panSwrViewByMHz(targetCenter - useAntennaStore.getState().swrViewCenterMHz);
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { wrapperRef, chartRef, onPointerDown, dragging };
}

function SWRZoomControls() {
  const { zoomSwrView, panSwrView, resetSwrView } = useAntennaStore(useShallow((s) => ({
    zoomSwrView: s.zoomSwrView,
    panSwrView: s.panSwrView,
    resetSwrView: s.resetSwrView,
  })));

  return (
    <div
      className="button-group"
      role="group"
      aria-label="SWR chart zoom and pan"
      style={{ marginTop: 8, justifyContent: 'center' }}
    >
      <button type="button" onClick={() => panSwrView(-0.3)} title="Pan left (lower frequency)" aria-label="Pan to lower frequency">◀</button>
      <button type="button" onClick={() => zoomSwrView(1 / 0.6)} title="Zoom out (wider span)" aria-label="Zoom out">−</button>
      <button type="button" onClick={resetSwrView} title="Reset zoom to default around the operating frequency" aria-label="Reset zoom">⟳</button>
      <button type="button" onClick={() => zoomSwrView(0.6)} title="Zoom in (narrower span)" aria-label="Zoom in">+</button>
      <button type="button" onClick={() => panSwrView(0.3)} title="Pan right (higher frequency)" aria-label="Pan to higher frequency">▶</button>
    </div>
  );
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
