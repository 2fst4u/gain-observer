import { useMemo, useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { predictPropagation } from '../../physics/propagation';
import { useLiveFeedMetrics } from '../../hooks/useFeedMetrics';
import { PropagationInputs } from './Propagation/PropagationInputs';
import { ConditionsReadout } from './Propagation/ConditionsReadout';

export function PropagationControl() {
  const state = useAntennaStore(useShallow((s) => ({
    frequency: s.frequency,
    latitudeDeg: s.latitudeDeg,
    longitudeDeg: s.longitudeDeg,
    monthOverride: s.monthOverride,
    utcHourOverride: s.utcHourOverride,
    result: s.result,
    units: s.units,
  })));
  const feedMetrics = useLiveFeedMetrics().metrics;
  const [shellHeightKm, setShellHeightKm] = useState(300);
  const now = new Date();
  const month = state.monthOverride ?? now.getUTCMonth() + 1;
  const utcHour = state.utcHourOverride ?? now.getUTCHours() + now.getUTCMinutes() / 60;
  const { result } = state;
  const realizedGainOffsetDb = result && feedMetrics?.displayedRealizedGainDbi !== undefined
    ? feedMetrics.displayedRealizedGainDbi - result.maxGainDbi
    : undefined;

  const prediction = useMemo(() => predictPropagation({
    takeoffElevationDeg: result?.takeoffElevationDeg ?? 30,
    shellHeightKm,
    month,
    utcHour,
    latitudeDeg: state.latitudeDeg ?? 0,
    longitudeDeg: state.longitudeDeg ?? 0,
    pattern: result?.pattern,
    realizedGainOffsetDb,
  }), [result?.takeoffElevationDeg, result?.pattern, shellHeightKm, month, utcHour,
    state.latitudeDeg, state.longitudeDeg, realizedGainOffsetDb]);

  return (
    <section className="panel-section">
      <h2>Propagation geometry <span className="badge">Illustrative</span></h2>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Ideal shell ray distances. These are not coverage predictions; path availability, received signal and LUF require a propagation model and link budget.
      </p>
      <PropagationInputs shellHeightKm={shellHeightKm} onShellHeightChange={setShellHeightKm} />
      <ConditionsReadout prediction={prediction} haveTakeoff={result !== null} units={state.units} />
    </section>
  );
}
