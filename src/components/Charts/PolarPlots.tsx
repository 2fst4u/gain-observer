// 2D polar plots: azimuth cut at take-off elevation, elevation cut at peak azimuth.

import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { useAntennaStore, selectAtuConfig } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import React, { useMemo, type ComponentProps } from 'react';
import { displayedFeedMetrics } from '../../physics/impedance';
import type { GainPattern, SimulationResult } from '../../physics/types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

function cutAzimuth(p: GainPattern, thetaDeg: number): number[] {
  const ti = Math.max(0, Math.min(p.thetaSteps - 1, Math.round(thetaDeg / p.dTheta)));
  const out = new Array<number>(p.phiSteps);
  const baseIdx = ti * p.phiSteps;
  for (let pi = 0; pi < p.phiSteps; pi++) {
    out[pi] = p.data[baseIdx + pi] ?? -60;
  }
  return out;
}

function getAzimuthLabels(p: GainPattern): string[] {
  const labels = new Array<string>(p.phiSteps).fill('');
  for (let pi = 0; pi < p.phiSteps; pi++) {
    const phiDeg = pi * p.dPhi;
    // We only label primary cardinal points if they align with the phi step.
    if (phiDeg === 0 || phiDeg === 360) labels[pi] = 'N';
    else if (phiDeg === 45) labels[pi] = 'NE';
    else if (phiDeg === 90) labels[pi] = 'E';
    else if (phiDeg === 135) labels[pi] = 'SE';
    else if (phiDeg === 180) labels[pi] = 'S';
    else if (phiDeg === 225) labels[pi] = 'SW';
    else if (phiDeg === 270) labels[pi] = 'W';
    else if (phiDeg === 315) labels[pi] = 'NW';
  }
  return labels;
}

function cutElevation(p: GainPattern, phiDeg: number): number[] {
  // To create a full 360 degree elevation slice:
  // Top (0 deg) is Zenith. Bottom (180 deg) is Nadir.
  // Right side (0 to 180) maps to forward azimuth (phiDeg).
  // Left side (360 down to 180) maps to backward azimuth (phiDeg + 180).
  const numPoints = Math.round(360 / p.dTheta);
  const out = new Array<number>(numPoints).fill(-60);

  const forwardPi = Math.max(0, Math.min(p.phiSteps - 1, Math.round(phiDeg / p.dPhi)));
  const backwardPhiDeg = (phiDeg + 180) % 360;
  const backwardPi = Math.max(0, Math.min(p.phiSteps - 1, Math.round(backwardPhiDeg / p.dPhi)));

  for (let ti = 0; ti < p.thetaSteps; ti++) {
    out[ti] = p.data[ti * p.phiSteps + forwardPi] ?? -60;
  }

  for (let ti = 1; ti < p.thetaSteps - 1; ti++) {
    const radarIdx = numPoints - ti;
    out[radarIdx] = p.data[ti * p.phiSteps + backwardPi] ?? -60;
  }

  return out;
}

function getElevationLabels(p: GainPattern): string[] {
  const numPoints = Math.round(360 / p.dTheta);
  const labels = new Array<string>(numPoints).fill('');
  for (let i = 0; i < numPoints; i++) {
    const deg = i * p.dTheta;
    if (deg === 0) labels[i] = 'Zen';
    else if (deg === 90 || deg === 270) labels[i] = 'Hor';
    else if (deg === 180) labels[i] = 'Dwn';
  }
  return labels;
}

/** Shift dBi into a 0..range display scale so PolarArea has positive radii. */
function normaliseForPolar(values: number[], maxDb: number, rangeDb: number): number[] {
  const min = maxDb - rangeDb;
  const len = values.length;
  // ⚡ Bolt: Performance Optimization
  // Pre-allocate the result array and use a standard for-loop instead of Array.prototype.map.
  // This avoids intermediate array resizing and callback allocation overhead, reducing garbage collection
  // pressure during high-frequency chart re-renders.
  const out = new Array<number>(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.max(0, values[i] - min);
  }
  return out;
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const RADAR_COLOR = 'rgba(79, 179, 255, 0.55)';

interface PolarPlotPanelProps {
  title: string;
  labels: string[];
  data: number[];
  options: ComponentProps<typeof Radar>['options'];
}

const PolarPlotPanel = React.memo(function PolarPlotPanel({ title, labels, data, options }: PolarPlotPanelProps) {
  return (
    <div style={{ minWidth: 0 }}>
      <h3 style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', margin: 0, fontWeight: 'normal' }}>
        {title}
      </h3>
      <div style={{ height: 160 }}>
        <Radar
          data={{
            labels,
            datasets: [{
              data,
              backgroundColor: RADAR_COLOR,
              borderColor: RADAR_COLOR,
              borderWidth: 1,
              pointRadius: 0,
              pointHoverRadius: 4,
              fill: true,
            }],
          }}
          options={options}
        />
      </div>
    </div>
  );
});

function usePolarChartOptions(theme: string, dbRange: number, result: { maxGainDbi: number } | null, peakDbi: number) {
  const chartText = theme === 'dark' ? getCssVar('--chart-text') || '#c6cdd6' : getCssVar('--chart-text') || '#3a4250';
  const chartGrid = theme === 'dark' ? getCssVar('--chart-grid') || 'rgba(255, 255, 255, 0.08)' : getCssVar('--chart-grid') || 'rgba(0, 0, 0, 0.08)';

  return useMemo<ComponentProps<typeof Radar>['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      r: {
        startAngle: 0, // 0 degrees at top
        suggestedMin: 0,
        suggestedMax: dbRange,
        ticks: {
          display: true,
          color: chartText,
          backdropColor: 'transparent',
          font: { size: 9 },
          z: 10,
          count: 5,
          callback: (val) => {
            if (!result) return '';
            return `${(Number(val) + (peakDbi - dbRange)).toFixed(0)} dBi`;
          },
        },
        grid: { color: chartGrid, circular: true },
        angleLines: { color: chartGrid },
        pointLabels: { color: chartText, font: { size: 10 }, padding: 0 },
      },
    },
  }), [dbRange, chartText, chartGrid, result, peakDbi]);
}


function AzimuthPlot({ result, dbRange, options }: { result: SimulationResult, dbRange: number, options: ComponentProps<typeof PolarPlotPanel>['options'] }) {
  const cut = useMemo(() => {
    // NEC theta = 90 - elevation. 0 elevation (horizon) is 90 theta (from zenith).
    const thetaDeg = 90 - result.takeoffElevationDeg;
    return cutAzimuth(result.pattern, thetaDeg);
  }, [result]);

  const data = useMemo(() => {
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [cut, result.maxGainDbi, dbRange]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => getAzimuthLabels(result.pattern), [result.pattern.phiSteps, result.pattern.dPhi]);

  return (
    <PolarPlotPanel
      title={`Azimuth @ Peak (${result.takeoffElevationDeg.toFixed(0)}°)`}
      labels={labels}
      data={data}
      options={options}
    />
  );
}

function ElevationPlot({ title, result, dbRange, azimuth, options }: { title: string, result: SimulationResult, dbRange: number, azimuth: number, options: ComponentProps<typeof PolarPlotPanel>['options'] }) {
  const cut = useMemo(() => {
    return cutElevation(result.pattern, azimuth);
  }, [result, azimuth]);

  const data = useMemo(() => {
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [cut, result.maxGainDbi, dbRange]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => getElevationLabels(result.pattern), [result.pattern.dTheta]);

  return (
    <PolarPlotPanel
      title={title}
      labels={labels}
      data={data}
      options={options}
    />
  );
}

export function PolarPlots() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    result,
    dbRange,
    showPolarCuts,
    orientation,
    theme,
    transformerEnabled,
    transformerRatio,
    feedlineId,
    frequency,
    feedlineLength,
    atuEnabled,
    atuMainFeedlineLength,
  } = useAntennaStore(useShallow((s) => ({
    result: s.result,
    dbRange: s.dbRange,
    showPolarCuts: s.showPolarCuts,
    orientation: s.orientation,
    theme: s.theme,
    transformerEnabled: s.transformerEnabled,
    transformerRatio: s.transformerRatio,
    feedlineId: s.feedlineId,
    frequency: s.frequency,
    feedlineLength: s.feedlineLength,
    atuEnabled: s.atuEnabled,
    atuMainFeedlineLength: s.atuMainFeedlineLength,
  })));

  // The cuts are normalised to the pattern peak (shape only), but the ring
  // labels report absolute dBi. Reference them to the realized-gain peak —
  // gain minus feedpoint mismatch/insertion loss — so the rings agree with the
  // 3D bubble and the stats readout instead of advertising the intrinsic gain.
  // The offset is direction-independent, so relabelling every ring by it is
  // exact for every point on the cut.
  const peakDbi = useMemo(() => {
    if (!result) return 0;
    const { displayedRealizedGainDbi } = displayedFeedMetrics(result, {
      transformerEnabled,
      transformerRatio,
      feedlineActive: feedlineId !== 'none',
      atu: selectAtuConfig({ atuEnabled, frequency, feedlineId, feedlineLength, atuMainFeedlineLength }),
    });
    return displayedRealizedGainDbi ?? result.maxGainDbi;
  }, [result, transformerEnabled, transformerRatio, feedlineId, atuEnabled, frequency, feedlineLength, atuMainFeedlineLength]);

  const { broadsideAz, endOnAz } = useMemo(() => {
    let azimuth = 0;
    if (typeof orientation === 'number') {
      azimuth = orientation;
    } else {
      switch (orientation) {
        case 'NS': azimuth = 0; break;
        case 'EW': azimuth = 90; break;
        case 'NE-SW': azimuth = 45; break;
        case 'NW-SE': azimuth = 315; break;
      }
    }
    // "End-on" is along the wire axis (phi = azimuth).
    // "Broadside" is perpendicular to the wire axis (azimuth + 90).
    return {
      endOnAz: azimuth % 360,
      broadsideAz: (azimuth + 90) % 360,
    };
  }, [orientation]);

  const options = usePolarChartOptions(theme, dbRange, result, peakDbi);

  if (!showPolarCuts || !result) return null;

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Polar cuts</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        <AzimuthPlot
          result={result}
          dbRange={dbRange}
          options={options}
        />
        <ElevationPlot
          title="Elevation (Broadside)"
          result={result}
          dbRange={dbRange}
          azimuth={broadsideAz}
          options={options}
        />
        <ElevationPlot
          title="Elevation (End-on)"
          result={result}
          dbRange={dbRange}
          azimuth={endOnAz}
          options={options}
        />
      </div>
    </section>
  );
}
