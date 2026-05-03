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
import { useAntennaStore } from '../../store/antennaStore';
import { useMemo } from 'react';
import type { GainPattern } from '../../physics/types';

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
    if (deg === 0) labels[i] = 'Zenith';
    else if (deg === 90 || deg === 270) labels[i] = 'Horizon';
    else if (deg === 180) labels[i] = 'Down';
  }
  return labels;
}

/** Shift dBi into a 0..range display scale so PolarArea has positive radii. */
function normaliseForPolar(values: number[], maxDb: number, rangeDb: number): number[] {
  const min = maxDb - rangeDb;
  return values.map((v) => Math.max(0, v - min));
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function PolarPlots() {
  const result = useAntennaStore((s) => s.result);
  const dbRange = useAntennaStore((s) => s.dbRange);
  const showPolarCuts = useAntennaStore((s) => s.showPolarCuts);
  const orientation = useAntennaStore((s) => s.orientation);
  const theme = useAntennaStore((s) => s.theme); // Subscribe to theme to re-evaluate colors on toggle

  const azData = useMemo(() => {
    if (!result) return null;
    // Horizon is at 0 degrees elevation, which corresponds to theta = 90 degrees (from zenith)
    const cut = cutAzimuth(result.pattern, 90);
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [result, dbRange]);

  const { broadsideAz, endOnAz } = useMemo(() => {
    switch (orientation) {
      case 'NS': return { broadsideAz: 90, endOnAz: 0 };
      case 'EW': return { broadsideAz: 0, endOnAz: 90 };
      case 'NE-SW': return { broadsideAz: 135, endOnAz: 45 };
      case 'NW-SE': return { broadsideAz: 45, endOnAz: 135 };
      default: return { broadsideAz: 0, endOnAz: 90 };
    }
  }, [orientation]);

  const elDataBroadside = useMemo(() => {
    if (!result) return null;
    const cut = cutElevation(result.pattern, broadsideAz);
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [result, dbRange, broadsideAz]);

  const elDataEndOn = useMemo(() => {
    if (!result) return null;
    const cut = cutElevation(result.pattern, endOnAz);
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [result, dbRange, endOnAz]);

  if (!showPolarCuts || !result || !azData || !elDataBroadside || !elDataEndOn) return null;

  const chartText = theme === 'dark' ? getCssVar('--chart-text') || '#c6cdd6' : getCssVar('--chart-text') || '#3a4250';
  const chartGrid = theme === 'dark' ? getCssVar('--chart-grid') || 'rgba(255, 255, 255, 0.08)' : getCssVar('--chart-grid') || 'rgba(0, 0, 0, 0.08)';

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      r: {
        startAngle: 0, // 0 degrees at top
        suggestedMin: 0,
        suggestedMax: dbRange,
        ticks: { display: false },
        grid: { color: chartGrid, circular: true },
        angleLines: { color: chartGrid },
        pointLabels: { color: chartText, font: { size: 10 } },
      },
    },
  } as const;

  const color = 'rgba(79, 179, 255, 0.55)';

  return (
    <div className="panel-section">
      <h3>Polar cuts</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
            Azimuth @ Horizon (0°)
          </div>
          <div style={{ height: 160 }}>
            <Radar
              data={{
                labels: getAzimuthLabels(result.pattern),
                datasets: [{
                  data: azData,
                  backgroundColor: color,
                  borderColor: color,
                  borderWidth: 1,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  fill: true,
                }],
              }}
              options={commonOpts}
            />
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
            Elevation (Broadside)
          </div>
          <div style={{ height: 160 }}>
            <Radar
              data={{
                labels: getElevationLabels(result.pattern),
                datasets: [{
                  data: elDataBroadside,
                  backgroundColor: color,
                  borderColor: color,
                  borderWidth: 1,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  fill: true,
                }],
              }}
              options={commonOpts}
            />
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
            Elevation (End-on)
          </div>
          <div style={{ height: 160 }}>
            <Radar
              data={{
                labels: getElevationLabels(result.pattern),
                datasets: [{
                  data: elDataEndOn,
                  backgroundColor: color,
                  borderColor: color,
                  borderWidth: 1,
                  pointRadius: 0,
                  pointHoverRadius: 4,
                  fill: true,
                }],
              }}
              options={commonOpts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
