// 2D polar plots: azimuth cut at take-off elevation, elevation cut at peak azimuth.

import { PolarArea } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  Tooltip,
} from 'chart.js';
import { useAntennaStore } from '../../store/antennaStore';
import { useMemo } from 'react';
import type { GainPattern } from '../../physics/types';

ChartJS.register(RadialLinearScale, ArcElement, Tooltip);

function cutAzimuth(p: GainPattern, thetaDeg: number): number[] {
  const ti = Math.max(0, Math.min(p.thetaSteps - 1, Math.round(thetaDeg / p.dTheta)));
  const out = new Array<number>(p.phiSteps);
  const baseIdx = ti * p.phiSteps;
  for (let pi = 0; pi < p.phiSteps; pi++) {
    out[pi] = p.data[baseIdx + pi] ?? -60;
  }
  return out;
}

function cutElevation(p: GainPattern, phiDeg: number): number[] {
  const pi = Math.max(0, Math.min(p.phiSteps - 1, Math.round(phiDeg / p.dPhi)));
  const out = new Array<number>(p.thetaSteps);
  for (let ti = 0; ti < p.thetaSteps; ti++) {
    out[ti] = p.data[ti * p.phiSteps + pi] ?? -60;
  }
  return out;
}

/** Shift dBi into a 0..range display scale so PolarArea has positive radii. */
function normaliseForPolar(values: number[], maxDb: number, rangeDb: number): number[] {
  const min = maxDb - rangeDb;
  return values.map((v) => Math.max(0, v - min));
}

export function PolarPlots() {
  const result = useAntennaStore((s) => s.result);
  const dbRange = useAntennaStore((s) => s.dbRange);
  const showPolarCuts = useAntennaStore((s) => s.showPolarCuts);

  const azData = useMemo(() => {
    if (!result) return null;
    const cut = cutAzimuth(result.pattern, 90 - result.takeoffElevationDeg);
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [result, dbRange]);

  const elData = useMemo(() => {
    if (!result) return null;
    const cut = cutElevation(result.pattern, result.takeoffAzimuthDeg);
    return normaliseForPolar(cut, result.maxGainDbi, dbRange);
  }, [result, dbRange]);

  if (!showPolarCuts || !result || !azData || !elData) return null;

  const commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      r: {
        suggestedMin: 0,
        suggestedMax: dbRange,
        ticks: { display: false },
        grid: { color: 'rgba(128,128,128,0.2)' },
        angleLines: { color: 'rgba(128,128,128,0.2)' },
      },
    },
  } as const;

  const color = 'rgba(79, 179, 255, 0.55)';

  return (
    <div className="panel-section">
      <h3>Polar cuts</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Azimuth @ {result.takeoffElevationDeg.toFixed(0)}° elev.
          </div>
          <div style={{ height: 160 }}>
            <PolarArea
              data={{
                labels: azData.map((_, i) => `${i * result.pattern.dPhi}°`),
                datasets: [{
                  data: azData,
                  backgroundColor: color,
                  borderColor: color,
                  borderWidth: 1,
                }],
              }}
              options={commonOpts}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Elevation @ {result.takeoffAzimuthDeg.toFixed(0)}° az.
          </div>
          <div style={{ height: 160 }}>
            <PolarArea
              data={{
                labels: elData.map((_, i) => `${i * result.pattern.dTheta}°`),
                datasets: [{
                  data: elData,
                  backgroundColor: color,
                  borderColor: color,
                  borderWidth: 1,
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
