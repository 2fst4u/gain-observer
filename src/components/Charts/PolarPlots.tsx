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
import { bearingToPhiDeg, normalizeDeg } from '../../physics/angles';
import type { GainPattern, SimulationResult } from '../../physics/types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

/** Grid column holding NEC azimuth φ, wrapped into the pattern's phi range. */
function phiIndex(p: GainPattern, phiDeg: number): number {
  const wrapped = ((phiDeg % 360) + 360) % 360;
  return Math.round(wrapped / p.dPhi) % p.phiSteps;
}

/**
 * Azimuth cut at a fixed theta, resampled onto compass bearings.
 *
 * The pattern is indexed by NEC azimuth φ (0° = +X = East, counter-clockwise),
 * but Chart.js lays a radar's points out clockwise from the top — i.e. exactly
 * a compass rose. Entry k therefore has to sample the grid at
 * φ = bearingToPhiDeg(k · dPhi), otherwise the plotted pattern is rotated 90°
 * and mirrored relative to the cardinal labels.
 */
function cutAzimuth(p: GainPattern, thetaDeg: number): number[] {
  const ti = Math.max(0, Math.min(p.thetaSteps - 1, Math.round(thetaDeg / p.dTheta)));
  const out = new Array<number>(p.phiSteps);
  const baseIdx = ti * p.phiSteps;
  for (let k = 0; k < p.phiSteps; k++) {
    const pi = phiIndex(p, bearingToPhiDeg(k * p.dPhi));
    out[k] = p.data[baseIdx + pi] ?? -60;
  }
  return out;
}

/** Cardinal labels for the azimuth ring, which is indexed by compass bearing. */
function getAzimuthLabels(p: GainPattern): string[] {
  const labels = new Array<string>(p.phiSteps).fill('');
  for (let k = 0; k < p.phiSteps; k++) {
    const bearingDeg = k * p.dPhi;
    // We only label primary cardinal points if they align with the step.
    if (bearingDeg === 0 || bearingDeg === 360) labels[k] = 'N';
    else if (bearingDeg === 45) labels[k] = 'NE';
    else if (bearingDeg === 90) labels[k] = 'E';
    else if (bearingDeg === 135) labels[k] = 'SE';
    else if (bearingDeg === 180) labels[k] = 'S';
    else if (bearingDeg === 225) labels[k] = 'SW';
    else if (bearingDeg === 270) labels[k] = 'W';
    else if (bearingDeg === 315) labels[k] = 'NW';
  }
  return labels;
}

/**
 * Elevation cut through a given compass bearing (0° = North, clockwise).
 * The bearing is converted to NEC azimuth φ before indexing the pattern.
 */
function cutElevation(p: GainPattern, bearingDeg: number): number[] {
  // To create a full 360 degree elevation slice:
  // Top (0 deg) is Zenith. Bottom (180 deg) is Nadir.
  // Right side (0 to 180) maps to the forward bearing.
  // Left side (360 down to 180) maps to the reciprocal bearing (+180°).
  const numPoints = Math.round(360 / p.dTheta);
  const out = new Array<number>(numPoints).fill(-60);

  const forwardPhiDeg = bearingToPhiDeg(bearingDeg);
  const forwardPi = phiIndex(p, forwardPhiDeg);
  const backwardPi = phiIndex(p, forwardPhiDeg + 180);

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
  }, [result.pattern, result.takeoffElevationDeg]);

  const data = useMemo(() => {
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [cut, result.maxGainDbi, dbRange]);
  const labels = useMemo(() => getAzimuthLabels(result.pattern), [result.pattern]);

  return (
    <PolarPlotPanel
      title={`Azimuth @ Peak (${result.takeoffElevationDeg.toFixed(0)}°)`}
      labels={labels}
      data={data}
      options={options}
    />
  );
}

function ElevationPlot({ title, result, dbRange, bearingDeg, options }: { title: string, result: SimulationResult, dbRange: number, bearingDeg: number, options: ComponentProps<typeof PolarPlotPanel>['options'] }) {
  const cut = useMemo(() => {
    return cutElevation(result.pattern, bearingDeg);
  }, [result.pattern, bearingDeg]);

  const data = useMemo(() => {
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [cut, result.maxGainDbi, dbRange]);
  const labels = useMemo(() => getElevationLabels(result.pattern), [result.pattern]);

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

  // `orientation` is a compass heading of the wire axis (NS = 0°, EW = 90°),
  // the same convention `orientationVector()` builds the geometry from. Both
  // cuts stay in compass bearings; `cutElevation` converts to NEC φ.
  const { broadsideBearing, endOnBearing } = useMemo(() => {
    let heading = 0;
    if (typeof orientation === 'number') {
      heading = orientation;
    } else {
      switch (orientation) {
        case 'NS': heading = 0; break;
        case 'EW': heading = 90; break;
        case 'NE-SW': heading = 45; break;
        case 'NW-SE': heading = 315; break;
      }
    }
    // "End-on" is along the wire axis; "broadside" is perpendicular to it.
    return {
      endOnBearing: normalizeDeg(heading),
      broadsideBearing: normalizeDeg(heading + 90),
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
          bearingDeg={broadsideBearing}
          options={options}
        />
        <ElevationPlot
          title="Elevation (End-on)"
          result={result}
          dbRange={dbRange}
          bearingDeg={endOnBearing}
          options={options}
        />
      </div>
    </section>
  );
}
