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
import { useMemo, memo, type ComponentProps } from 'react';
import { displayedFeedMetrics } from '../../physics/impedance';
import type { SimulationResult } from '../../physics/types';
import {
  cutAzimuth,
  cutElevation,
  getAzimuthLabels,
  getElevationLabels,
  normaliseForPolar,
  computeWireBearings,
  usePolarChartOptions,
} from './polarPlotUtils';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

const RADAR_COLOR = 'rgba(79, 179, 255, 0.55)';

interface PolarPlotPanelProps {
  title: string;
  labels: string[];
  data: number[];
  options: ComponentProps<typeof Radar>['options'];
}

const PolarPlotPanel = memo(function PolarPlotPanel({ title, labels, data, options }: PolarPlotPanelProps) {
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

function usePolarPlotsState() {
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

  const { broadsideBearing, endOnBearing } = useMemo(
    () => computeWireBearings(orientation),
    [orientation]
  );

  const options = usePolarChartOptions(theme, dbRange, result, peakDbi);

  return {
    showPolarCuts,
    result,
    dbRange,
    broadsideBearing,
    endOnBearing,
    options,
  };
}

export function PolarPlots() {
  const { showPolarCuts, result, dbRange, broadsideBearing, endOnBearing, options } = usePolarPlotsState();

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
