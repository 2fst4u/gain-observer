import { useMemo } from 'react';
import { useAntennaStore, selectAtuConfig, isFeedlineActive } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { displayedFeedMetrics, type AtuMatchConfig, type DisplayedFeedMetrics } from '../../physics/impedance';
import { phiToBearingDeg } from '../../physics/angles';
import { TRANSFORMER_INSERTION_LOSS_DB } from '../../physics/constants';
import type { TerminationDiagnostics } from '../../physics/types';
import { StatRow } from '../UI/StatRow';
import { LEFT_LEG_TAG, RIGHT_LEG_TAG } from '../../physics/tags';

export function StatsReadout() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    result,
    error,
    mode,
    comparisonReference: reference,
    transformerEnabled,
    transformerRatio,
    feedlineId,
    antennaType,
    length,
    height,
    feedlineOffset,
    groundId,
    frequency,
    feedlineLength,
    atuEnabled,
    atuMainFeedlineLength,
  } = useAntennaStore(useShallow((s) => ({
    result: s.result,
    error: s.error,
    mode: s.mode,
    comparisonReference: s.comparisonReference,
    transformerEnabled: s.transformerEnabled,
    transformerRatio: s.transformerRatio,
    feedlineId: s.feedlineId,
    antennaType: s.antennaType,
    length: s.length,
    height: s.height,
    feedlineOffset: s.feedlineOffset,
    groundId: s.groundId,
    frequency: s.frequency,
    feedlineLength: s.feedlineLength,
    atuEnabled: s.atuEnabled,
    atuMainFeedlineLength: s.atuMainFeedlineLength,
  })));
  const feedlineActive = isFeedlineActive({ antennaType, length, height, feedlineId, feedlineLength, feedlineOffset, groundId });
  const atu = selectAtuConfig({ atuEnabled, frequency, feedlineId, feedlineLength, atuMainFeedlineLength });
  if (!result) {
    return (
      <section className="panel-section">
        {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
        <h2>Results</h2>
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: 12 }}>
          {error ? 'No valid result for this configuration.' : <><div className="spinner" aria-hidden="true" /> Computing…</>}
        </div>
      </section>
    );
  }

  // The displayed feedpoint metrics (impedance, SWR, realized gain) fold in any
  // impedance transformer — either modelled in NEC (feedline present) or applied
  // as an idealised display-side transform (no feedline). The same helper drives
  // the 3D pattern's realized-gain scaling, so the readout and the bubble agree.
  const currentMetrics = displayedFeedMetrics(result, {
    transformerEnabled,
    transformerRatio,
    feedlineActive,
    atu,
  });
  const { displayedZ, displayedSwr, displayedRealizedGainDbi, atuLoss } = currentMetrics;
  const referenceMetrics = reference ? displayedFeedMetrics(reference.result, {
    transformerEnabled: reference.transformerEnabled,
    transformerRatio: reference.transformerRatio,
    feedlineActive: isFeedlineActive(reference),
    atu: selectAtuConfig(reference),
  }) : undefined;

  const impedanceLabel = atu || feedlineActive ? 'Source impedance (R + jX)' : 'Feedpoint (R + jX)';
  const impedanceTitle = getImpedanceTitle(atu, feedlineActive, transformerEnabled, transformerRatio);
  const swrTitle = getSwrTitle(atu, feedlineActive, transformerEnabled, transformerRatio);

  const realizedGainTitle = getRealizedGainTitle(atu, atuLoss, transformerEnabled, transformerRatio);

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Results <span className="badge">{result.computeTimeMs.toFixed(0)} ms</span></h2>
      <StatRow label="Gain" title="Antenna gain (dBi): NEC total power gain relative to isotropic, normalised to accepted input power. Includes modelled conductor, termination, ground and feedline losses." value={`${result.maxGainDbi.toFixed(2)} dBi`} valueClassName="accent" />
      {result.maxDirectivityDbi != null && (
        <StatRow label="Directivity" title="Directivity (dBi): peak gain normalised to the power that actually radiates, D = 4π·U_max / P_rad, obtained by integrating the pattern over the sphere. Over real ground it exceeds the gain by the conductor, termination and soil-absorption losses combined." value={`${result.maxDirectivityDbi.toFixed(2)} dBi`} />
      )}
      {displayedRealizedGainDbi != null && (
        <StatRow label="Realized gain" title={realizedGainTitle} value={`${displayedRealizedGainDbi.toFixed(2)} dBi`} />
      )}
      {result.escapingEfficiency != null && (
        <StatRow label="Far-field efficiency" title="Numerically integrated far-field radiation / accepted source power. Includes conductor, termination, network and ground absorption losses. Does not include source mismatch or display-side matching hardware losses." value={`${(result.escapingEfficiency * 100).toFixed(1)}%`} />
      )}
      {result.efficiency != null && (
        <StatRow label="Conductor/network efficiency" title="NEC power-budget fraction remaining after conductor and network dissipation. Ground absorption is not subtracted from this budget; use Far-field efficiency for radiation escaping to the far field." value={`${(result.efficiency * 100).toFixed(1)}%`} />
      )}
      <StatRow label="Take-off elevation" title="Elevation angle of the peak-gain direction: 0° = horizon, 90° = zenith." value={`${result.takeoffElevationDeg.toFixed(1)}°`} />
      <StatRow label="Azimuth of peak" title="Compass bearing of the peak-gain direction: 0° = North, 90° = East. (NEC solves in its own azimuth φ, measured from +X/East; this row reports the bearing.)" value={`${phiToBearingDeg(result.takeoffAzimuthDeg).toFixed(0)}°`} />
      <StatRow label={impedanceLabel} title={impedanceTitle} value={`${displayedZ.R.toFixed(1)} ${displayedZ.X >= 0 ? '+' : '−'}j${Math.abs(displayedZ.X).toFixed(1)} Ω`} />
      <StatRow label="SWR (vs 50 Ω)" title={swrTitle} value={`${displayedSwr.toFixed(2)}:1`} valueStyle={{ color: displayedSwr > 2 ? 'var(--danger)' : displayedSwr > 1.5 ? 'var(--warning)' : 'var(--success)' }} />
      {mode === 'comparison' && reference && referenceMetrics && (
        <ComparisonStats current={result} reference={reference.result} currentMetrics={currentMetrics} referenceMetrics={referenceMetrics} />
      )}
      <TerminationSection diagnostics={result.terminationDiagnostics} />
    </section>
  );
}

function ComparisonStats({
  current,
  reference,
  currentMetrics,
  referenceMetrics,
}: {
  current: NonNullable<ReturnType<typeof useAntennaStore.getState>['result']>;
  reference: NonNullable<ReturnType<typeof useAntennaStore.getState>['comparisonReference']>['result'];
  currentMetrics: DisplayedFeedMetrics;
  referenceMetrics: DisplayedFeedMetrics;
}) {
  return (
    /* SEO: Upgrade fragment to semantic section tag for document outline */
    <section aria-labelledby="comparison-stats-heading">
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <h3 id="comparison-stats-heading" style={{ fontSize: 11, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Versus reference
      </h3>
      <StatRow label="Gain delta" value={`${formatSigned(current.maxGainDbi - reference.maxGainDbi, 2)} dB`} />
      {currentMetrics.displayedRealizedGainDbi !== undefined && referenceMetrics.displayedRealizedGainDbi !== undefined && (
        <StatRow label="Realized gain delta" value={`${formatSigned(currentMetrics.displayedRealizedGainDbi - referenceMetrics.displayedRealizedGainDbi, 2)} dB`} />
      )}
      <StatRow label="Take-off delta" value={`${formatSigned(current.takeoffElevationDeg - reference.takeoffElevationDeg, 1)}°`} />
      <StatRow label="SWR delta (vs 50 Ω)" value={formatSigned(currentMetrics.displayedSwr - referenceMetrics.displayedSwr, 2)} />
      <StatRow label="R delta" value={`${formatSigned(currentMetrics.displayedZ.R - referenceMetrics.displayedZ.R, 1)} Ω`} />
      <StatRow label="X delta" value={`${formatSigned(currentMetrics.displayedZ.X - referenceMetrics.displayedZ.X, 1)} Ω`} />
    </section>
  );
}

function formatSigned(value: number, digits: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function legLabel(tagNo: number): string {
  if (tagNo === LEFT_LEG_TAG) return 'Left leg current envelope range';
  if (tagNo === RIGHT_LEG_TAG) return 'Right leg current envelope range';
  return `Tag ${tagNo} current envelope range`;
}

/**
 * Current envelopes and individually calculated termination dissipation.
 * Radiation and attenuation can vary current even without a reflected wave;
 * envelope range is not a travelling-wave reflection coefficient.
 */
function TerminationSection({ diagnostics }: { diagnostics: TerminationDiagnostics }) {
  const antennaType = useAntennaStore((s) => s.antennaType);

  const legRipples = useMemo(() => {
    if (!diagnostics || !diagnostics.currentRippleByTag) return [];
    return diagnostics.currentRippleByTag.filter(
      (r) => r.tagNo === LEFT_LEG_TAG || r.tagNo === RIGHT_LEG_TAG,
    );
  }, [diagnostics]);

  if (antennaType !== 'sloping-v' || !diagnostics) return null;

  const { powerBudget, frontBackDb } = diagnostics;

  const hasContent =
    legRipples.length > 0 || powerBudget !== null || frontBackDb !== null || diagnostics.terminationPowerW !== undefined;
  if (!hasContent) return null;

  return (
    /* SEO: Upgrade fragment to semantic section tag for document outline */
    <section aria-labelledby="termination-effectiveness-heading">
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <h3 id="termination-effectiveness-heading" style={{ fontSize: 11, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Current and power diagnostics
      </h3>
      {legRipples.map((r) => (
        <StatRow key={r.tagNo} label={legLabel(r.tagNo)} value={Number.isFinite(r.rippleDb) ? `${r.rippleDb.toFixed(1)} dB` : '∞ dB'} title="20 log10(max |I| / min |I|) across this wire. Radiation, attenuation and geometry also change this envelope; it does not measure reflected-wave power." />
      ))}
      {frontBackDb !== null && (
        <StatRow label="Front/back ratio" value={`${frontBackDb.toFixed(1)} dB`} />
      )}
      {diagnostics.terminationPowerW !== undefined && (
        <StatRow label="Termination dissipation" title="Sum of ½|I|²R using NEC peak-current phasors in loads explicitly identified as termination resistors. Copper, choke and cable losses are accounted separately." value={`${(diagnostics.terminationPowerW * 1000).toFixed(2)} mW`} />
      )}
      {powerBudget !== null && (
        <>
          <StatRow label="Conductor and load dissipation" title="NEC structure loss includes copper conductors and all LD loads; it is not termination dissipation alone." value={`${(powerBudget.structureLossW * 1000).toFixed(2)} mW`} />
          <StatRow label="Network dissipation" title="Power dissipated in modelled two-port networks, including distributed feedline loss." value={`${(powerBudget.networkLossW * 1000).toFixed(2)} mW`} />
          <StatRow label="Power after conductor/networks" title="NEC budget remainder; includes power subsequently absorbed by lossy ground." value={`${(powerBudget.radiatedW * 1000).toFixed(2)} mW`} />
        </>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Current envelope range alone cannot separate forward and reflected waves.
        Termination dissipation and feedpoint matching describe different quantities.
      </div>
    </section>
  );
}

function getImpedanceTitle(
  atu: AtuMatchConfig | undefined,
  feedlineActive: boolean,
  transformerEnabled: boolean,
  transformerRatio: number
) {
  if (atu) {
    return 'Impedance the radio sees with the ATU at the mast base matched: an idealised tuner presents 50 Ω. To see the antenna terminals directly, disable the ATU and set Feedline = none.';
  }
  if (feedlineActive) {
    return `Impedance at the source end of the feedline (what the radio sees)${transformerEnabled ? `, with the ${transformerRatio}:1 transformer fitted at the antenna terminals` : ''}. To see the antenna terminals directly, set Feedline = none.`;
  }
  if (transformerEnabled) {
    return `Impedance after the ${transformerRatio}:1 transformer fitted at the antenna terminals.`;
  }
  return 'Impedance at the antenna feedpoint. NEC places the excitation directly at the antenna terminals.';
}

function getSwrTitle(
  atu: AtuMatchConfig | undefined,
  feedlineActive: boolean,
  transformerEnabled: boolean,
  transformerRatio: number
) {
  if (atu) {
    return 'Voltage SWR your radio sees with the mast-base ATU matched. The tuner flattens the main run to ~1:1; the antenna\'s native mismatch still stands on the short up-mast feedline.';
  }
  if (feedlineActive) {
    return `Voltage SWR at the source end of the feedline against 50 Ω${transformerEnabled ? ` (with the transformer fitted at the antenna)` : ''}. This is what your radio's SWR meter would see.`;
  }
  if (transformerEnabled) {
    return `Voltage SWR at the radio side of the antenna's ${transformerRatio}:1 transformer against 50 Ω.`;
  }
  return 'Voltage SWR at the antenna feedpoint against 50 Ω.';
}

function getRealizedGainTitle(
  atu: AtuMatchConfig | undefined,
  atuLoss: { upmastDb: number; mainDb: number; tunerDb: number } | null | undefined,
  transformerEnabled: boolean,
  transformerRatio: number
) {
  if (atu) {
    return `Realized gain (dBi): antenna gain delivered through the mast-base ATU. The tuner cancels the feedpoint mismatch (no mismatch loss), leaving${atuLoss ? ` up-mast network loss already included in NEC gain (${atuLoss.upmastDb.toFixed(2)} dB), plus main feedline loss ${atuLoss.mainDb.toFixed(2)} dB + tuner loss ${atuLoss.tunerDb.toFixed(2)} dB` : ' feedline and tuner losses'}. A tuner cannot recover ohmic/termination (efficiency) loss.`;
  }
  if (transformerEnabled) {
    return `Realized gain (dBi): antenna gain after mismatch loss against 50 Ω with the ${transformerRatio}:1 transformer fitted at the antenna terminals, minus ${TRANSFORMER_INSERTION_LOSS_DB.toFixed(1)} dB transformer insertion loss.`;
  }
  return 'Realized gain (dBi): antenna gain after mismatch loss against 50 Ω. In linear power units: realized gain = gain × (1 − |Γ|²).';
}
