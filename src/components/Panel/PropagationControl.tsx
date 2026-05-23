// HF propagation panel — manual T-index entry plus a top-down radar plot
// of estimated 1/2/3-hop range. Entirely client-side; no network calls.

import { useMemo } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { predictPropagation } from '../../physics/propagation';
import { PropagationInputs } from './Propagation/PropagationInputs';
import { ConditionsReadout } from './Propagation/ConditionsReadout';

export function PropagationControl() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    frequency,
    tIndex,
    latitudeDeg,
    longitudeDeg,
    monthOverride,
    utcHourOverride,
    result,
    units,
  } = useAntennaStore(useShallow((s) => ({
    frequency: s.frequency,
    tIndex: s.tIndex,
    latitudeDeg: s.latitudeDeg,
    longitudeDeg: s.longitudeDeg,
    monthOverride: s.monthOverride,
    utcHourOverride: s.utcHourOverride,
    result: s.result,
    units: s.units,
  })));

  // Resolve "now" once per render. We deliberately don't memoise on a
  // ticking clock — propagation conditions change on the order of minutes,
  // so the panel just refreshes on the next render trigger (e.g. user
  // input). Adding a 60s ticker is easy if needed later.
  const now = new Date();
  const autoMonth = now.getUTCMonth() + 1;
  const autoUtcHour = now.getUTCHours() + now.getUTCMinutes() / 60;

  const month = monthOverride ?? autoMonth;
  const utcHour = utcHourOverride ?? autoUtcHour;

  const takeoffElevationDeg = result?.takeoffElevationDeg ?? 30;

  const prediction = useMemo(() => {
    return predictPropagation({
      frequencyMHz: frequency,
      tIndex,
      takeoffElevationDeg,
      month,
      utcHour,
      latitudeDeg: latitudeDeg ?? 0,
      longitudeDeg: longitudeDeg ?? 0,
      pattern: result?.pattern,
      swr: result?.swr,
    });
  }, [frequency, tIndex, takeoffElevationDeg, month, utcHour, latitudeDeg, longitudeDeg, result?.pattern, result?.swr]);

  const haveTakeoff = result !== null;

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>
        Propagation
        <span className="badge">T = {tIndex.toFixed(0)}</span>
      </h2>

      <PropagationInputs />

      <ConditionsReadout
        prediction={prediction}
        haveTakeoff={haveTakeoff}
        units={units}
      />
    </section>
  );
}
