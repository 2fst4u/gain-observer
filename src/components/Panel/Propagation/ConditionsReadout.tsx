import { useState } from 'react';
import { PropagationRadar } from '../../Charts/PropagationRadar';
import type { PropagationPrediction } from '../../../physics/propagation';
import type { IonosphereState } from '../../../hooks/useIonosphere';

// eslint-disable-next-line react-refresh/only-export-components
export function formatRange(km: number, units: 'metric' | 'imperial'): string {
  return units === 'imperial' ? `${(km / 1.609344).toFixed(0)} mi` : `${km.toFixed(0)} km`;
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="stat" title={title}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function IonosphereStats({ prediction }: { prediction: PropagationPrediction }) {
  const { layers } = prediction;
  return (
    <>
      <Stat label="foF2 (F2 critical frequency)" value={`${layers.foF2.toFixed(2)} MHz`} title="IRI monthly median, URSI-88 maps." />
      <Stat label="hmF2 (F2 peak height)" value={`${layers.hmF2.toFixed(0)} km`} />
      {Number.isFinite(layers.foF1) && (
        <Stat label="foF1" value={`${layers.foF1.toFixed(2)} MHz`} />
      )}
      <Stat label="foE" value={`${layers.foE.toFixed(2)} MHz`} />
      <Stat label="Solar zenith (mid-month)" value={`${prediction.solarZenithDeg.toFixed(0)}°`} />
    </>
  );
}

function nvisVerdict(prediction: PropagationPrediction): string {
  const ceiling = prediction.verticalCriticalMHz;
  return prediction.frequencyMHz < ceiling
    ? `Return (below ${ceiling.toFixed(2)} MHz)`
    : `Pass through (above ${ceiling.toFixed(2)} MHz)`;
}

export function ConditionsReadout({ prediction, ionosphereStatus, haveTakeoff, units }: {
  prediction: PropagationPrediction | undefined;
  ionosphereStatus: IonosphereState['status'];
  haveTakeoff: boolean;
  units: 'metric' | 'imperial';
}) {
  const [showAssumptions, setShowAssumptions] = useState(false);
  const selected = prediction?.hops[0];
  const beam = (prediction?.azimuthalHops ?? []).flatMap((point) => point.halfPowerRangeKm ? [point.halfPowerRangeKm] : []);
  const anyBeam = (prediction?.azimuthalHops ?? []).some((point) => point.halfPowerElevationDeg);
  const beamNearKm = beam.length > 0 ? Math.min(...beam.map((span) => span.nearKm)) : undefined;
  const beamFarKm = beam.length > 0 ? Math.max(...beam.map((span) => span.farKm)) : undefined;

  return (
    <>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '12px 0 8px' }} />
      {ionosphereStatus === 'error' && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>Could not load the ionosphere model.</div>
      )}
      {!prediction && ionosphereStatus !== 'error' && (
        <div role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading ionosphere model…</div>
      )}
      {prediction && (
        <>
          <IonosphereStats prediction={prediction} />
          <Stat
            label="Near-vertical (NVIS) rays"
            value={nvisVerdict(prediction)}
            title="A vertical ray returns below the profile's highest plasma frequency (the larger of foF2 and foF1)."
          />
          <Stat label="Strongest lobe elevation" value={`${prediction.selectedTakeoffElevationDeg.toFixed(1)}°`} />
          <Stat
            label="Strongest lobe MUF"
            value={`${prediction.selectedMufMHz.toFixed(1)} MHz`}
            title="Highest frequency whose ray at the strongest lobe's elevation still returns."
          />
          {selected?.realizedGainDbi !== undefined && (
            <Stat label="Strongest lobe realized gain" value={`${selected.realizedGainDbi.toFixed(2)} dBi`} />
          )}
          {haveTakeoff ? <PropagationRadar prediction={prediction} units={units} /> : (
            <div role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Computing antenna pattern…</div>
          )}
          <div style={{ marginTop: 10 }}>
            {anyBeam && (
              <Stat
                label="Half-power beam, 1 hop"
                value={beamNearKm !== undefined && beamFarKm !== undefined
                  ? `${formatRange(beamNearKm, units)} – ${formatRange(beamFarKm, units)}`
                  : 'Passes through'}
                title="Where the returning rays within 3 dB of the pattern's peak gain land, over all bearings."
              />
            )}
            {prediction.hops.map((hop) => (
              <Stat
                key={hop.n}
                label={`Strongest lobe, ${hop.n} hop${hop.n === 1 ? '' : 's'}`}
                value={hop.rangeKm !== undefined ? formatRange(hop.rangeKm, units) : 'Passes through'}
              />
            ))}
          </div>
        </>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Received signal and path availability: not calculated.</p>
      <button type="button" onClick={() => setShowAssumptions((value) => !value)} aria-expanded={showAssumptions} aria-controls="assumptions-panel" style={{ marginTop: 10, background: 'transparent', border: 'none', color: 'var(--accent)', padding: 0, fontSize: 11, cursor: 'pointer' }}>
        {showAssumptions ? 'Hide model assumptions' : 'Model & assumptions'}
      </button>
      <div id="assumptions-panel" hidden={!showAssumptions} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
        <p>The ionosphere is the International Reference Ionosphere (IRI) monthly median above your location: F2 peak from the URSI-88 and CCIR maps, F1 and E layers from IRI's formulas, joined as Epstein layers (computed in your browser with a port of PyIRI). Solar activity is the 12-month smoothed F10.7 flux from NOAA SWPC.</p>
        <ul style={{ paddingLeft: 18 }}>
          <li>Rays are traced through that profile at the operating frequency, curved Earth included. A ray either turns and returns or passes through.</li>
          <li>The shading is relative signal strength on the ground: for every returning ray of the antenna pattern, the power radiated into it is spread over the ground where it lands (so it concentrates near the skip distance and thins with range), summed over 1–3 hops, and shown in dB below the strongest point. Each later hop loses power to reflection from the configured ground (Fresnel coefficients, averaged over polarisation).</li>
          <li>Lines mark where the half-power beam (within 3 dB of the pattern's peak) reaches after 1–3 hops; a dashed inner line marks a skip zone.</li>
          <li>D-layer absorption is not included, so on the lower bands in daytime, low-angle and multi-hop paths are shown stronger than they are. There is no absolute signal level: that needs transmitter power and the receiving side.</li>
          <li>Monthly median: on a given day foF2 commonly differs by 15–20%, more during storms. Sporadic E is not modelled.</li>
          <li>The ordinary wave without the geomagnetic field. The extraordinary wave reflects up to about half the gyrofrequency (roughly 0.5–0.8 MHz) higher.</li>
          <li>The ionosphere above the station is assumed along the whole path, and each later hop repeats the first.</li>
          <li>Antenna gain is relative to isotropic radiation. It cannot establish signal usability without transmitter power, path loss, receiving antenna and noise.</li>
        </ul>
      </div>
    </>
  );
}
