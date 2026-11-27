import { useMemo, useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { predictPropagation } from '../../physics/propagation';
import { FALLBACK_F107 } from '../../physics/ionosphere/solarFlux';
import { useLiveFeedMetrics } from '../../hooks/useFeedMetrics';
import { useIonosphere, useSolarFlux } from '../../hooks/useIonosphere';
import { PropagationInputs, type SolarFluxDisplay } from './Propagation/PropagationInputs';
import { ConditionsReadout } from './Propagation/ConditionsReadout';

/** The instant the prediction is for: now, or the overridden month/UT. An
 * overridden month uses its 15th, where the monthly median is centred. */
function predictionTime(monthOverride: number | null, utcHourOverride: number | null): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = monthOverride ?? now.getUTCMonth() + 1;
  const day = monthOverride !== null ? 15 : now.getUTCDate();
  const hour = utcHourOverride ?? now.getUTCHours() + now.getUTCMinutes() / 60;
  const minutes = Math.round(hour * 60); // whole minutes: avoids re-tracing every render
  return Date.UTC(year, month - 1, day, 0, minutes);
}

export function PropagationControl() {
  const state = useAntennaStore(useShallow((s) => ({
    frequency: s.frequency,
    latitudeDeg: s.latitudeDeg,
    longitudeDeg: s.longitudeDeg,
    monthOverride: s.monthOverride,
    utcHourOverride: s.utcHourOverride,
    result: s.result,
    units: s.units,
    groundSigma: s.groundSigma,
    groundEpsilon: s.groundEpsilon,
  })));
  const feedMetrics = useLiveFeedMetrics().metrics;
  const [f107Override, setF107Override] = useState<number | null>(null);
  const [txPowerW, setTxPowerW] = useState(100);
  const time = predictionTime(state.monthOverride, state.utcHourOverride);
  const date = useMemo(() => new Date(time), [time]);
  const flux = useSolarFlux(date.getUTCFullYear(), date.getUTCMonth() + 1);
  const f107 = f107Override ?? (flux.status === 'ready' ? flux.sample.f107 : FALLBACK_F107);
  const fluxDisplay: SolarFluxDisplay = f107Override !== null
    ? { f107, origin: 'manual' }
    : flux.status === 'ready'
      ? { f107, origin: flux.sample.source, month: flux.sample.month }
      : { f107, origin: flux.status === 'loading' ? 'loading' : 'fallback' };
  const ionosphere = useIonosphere(date, state.latitudeDeg ?? 0, state.longitudeDeg ?? 0, f107);

  const { result } = state;
  const realizedGainOffsetDb = result && feedMetrics?.displayedRealizedGainDbi !== undefined
    ? feedMetrics.displayedRealizedGainDbi - result.maxGainDbi
    : undefined;

  const layers = ionosphere.status === 'ready' ? ionosphere.layers : undefined;
  const prediction = useMemo(() => layers && predictPropagation({
    frequencyMHz: state.frequency,
    layers,
    takeoffElevationDeg: result?.takeoffElevationDeg ?? 30,
    pattern: result?.pattern,
    realizedGainOffsetDb,
    ground: { sigma: state.groundSigma, epsilon: state.groundEpsilon },
    link: { txPowerW, date, latitudeDeg: state.latitudeDeg ?? 0, longitudeDeg: state.longitudeDeg ?? 0, f107 },
  }), [layers, state.frequency, result?.takeoffElevationDeg, result?.pattern, realizedGainOffsetDb,
    state.groundSigma, state.groundEpsilon, txPowerW, date, state.latitudeDeg, state.longitudeDeg, f107]);

  return (
    <section className="panel-section">
      <h2>Skywave propagation <span className="badge">Monthly median</span></h2>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Rays traced through the IRI monthly-median ionosphere above your location. Shows where rays land, not whether a contact will work: received signal and path availability need a link budget.
      </p>
      <PropagationInputs
        solarFlux={fluxDisplay}
        onSolarFluxChange={setF107Override}
        onSolarFluxReset={() => setF107Override(null)}
        txPowerW={txPowerW}
        onTxPowerChange={setTxPowerW}
      />
      <ConditionsReadout
        prediction={prediction}
        ionosphereStatus={ionosphere.status}
        haveTakeoff={result !== null}
        units={state.units}
      />
    </section>
  );
}
