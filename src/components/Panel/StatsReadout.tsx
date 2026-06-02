import { useAntennaStore, selectAtuConfig, DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { displayedFeedMetrics } from '../../physics/impedance';
import { TRANSFORMER_INSERTION_LOSS_DB } from '../../physics/constants';
import type { TerminationDiagnostics } from '../../physics/types';

export function StatsReadout() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    result,
    mode,
    comparisonReference: reference,
    transformerEnabled,
    transformerRatio,
    feedlineId,
    frequency,
    feedlineLength,
    atuEnabled,
    atuMainFeedlineLength,
  } = useAntennaStore(useShallow((s) => ({
    result: s.result,
    mode: s.mode,
    comparisonReference: s.comparisonReference,
    transformerEnabled: s.transformerEnabled,
    transformerRatio: s.transformerRatio,
    feedlineId: s.feedlineId,
    frequency: s.frequency,
    feedlineLength: s.feedlineLength,
    atuEnabled: s.atuEnabled,
    atuMainFeedlineLength: s.atuMainFeedlineLength,
  })));
  const feedlineActive = feedlineId !== 'none';
  const atu = selectAtuConfig({ atuEnabled, frequency, feedlineId, feedlineLength, atuMainFeedlineLength });
  if (!result) {
    return (
      <section className="panel-section">
        {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
        <h2>Results</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Computing…</div>
      </section>
    );
  }

  // The displayed feedpoint metrics (impedance, SWR, realized gain) fold in any
  // impedance transformer — either modelled in NEC (feedline present) or applied
  // as an idealised display-side transform (no feedline). The same helper drives
  // the 3D pattern's realized-gain scaling, so the readout and the bubble agree.
  const { displayedZ, displayedSwr, displayedRealizedGainDbi, atuLoss } = displayedFeedMetrics(result, {
    transformerEnabled,
    transformerRatio,
    feedlineActive,
    atu,
  });

  const impedanceLabel = atu || feedlineActive ? 'Source impedance (R + jX)' : 'Feedpoint (R + jX)';
  const impedanceTitle = atu
    ? 'Impedance the radio sees with the ATU at the mast base matched: an idealised tuner presents 50 Ω. To see the antenna terminals directly, disable the ATU and set Feedline = none.'
    : feedlineActive
      ? `Impedance at the source end of the feedline (what the radio sees)${transformerEnabled ? `, with the ${transformerRatio}:1 transformer fitted at the antenna terminals` : ''}. To see the antenna terminals directly, set Feedline = none.`
      : transformerEnabled
        ? `Impedance after the ${transformerRatio}:1 transformer fitted at the antenna terminals.`
        : 'Impedance at the antenna feedpoint. NEC places the excitation directly at the antenna terminals.';
  const swrTitle = atu
    ? 'Voltage SWR your radio sees with the mast-base ATU matched. The tuner flattens the main run to ~1:1; the antenna\'s native mismatch still stands on the short up-mast feedline.'
    : feedlineActive
      ? `Voltage SWR at the source end of the feedline against 50 Ω${transformerEnabled ? ` (with the transformer fitted at the antenna)` : ''}. This is what your radio's SWR meter would see.`
      : transformerEnabled
        ? `Voltage SWR at the radio side of the antenna's ${transformerRatio}:1 transformer against 50 Ω.`
        : 'Voltage SWR at the antenna feedpoint against 50 Ω.';

  const realizedGainTitle = atu
    ? `Realized gain (dBi): antenna gain delivered through the mast-base ATU. The tuner cancels the feedpoint mismatch (no mismatch loss), leaving${atuLoss ? ` up-mast feedline loss ${atuLoss.upmastDb.toFixed(2)} dB + main feedline loss ${atuLoss.mainDb.toFixed(2)} dB + tuner loss ${atuLoss.tunerDb.toFixed(2)} dB` : ' feedline and tuner losses'}. A tuner cannot recover ohmic/termination (efficiency) loss.`
    : transformerEnabled
      ? `Realized gain (dBi): antenna gain after mismatch loss against 50 Ω with the ${transformerRatio}:1 transformer fitted at the antenna terminals, minus ${TRANSFORMER_INSERTION_LOSS_DB.toFixed(1)} dB transformer insertion loss.`
      : 'Realized gain (dBi): antenna gain after mismatch loss against 50 Ω. = Gain × (1 − |Γ|²).';

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Results <span className="badge">{result.computeTimeMs.toFixed(0)} ms</span></h2>
      <div className="stat">
        <span
          className="stat-label"
          title="Antenna gain (dBi): NEC total power gain relative to isotropic, normalised to accepted input power. Includes all ohmic and termination losses."
        >Gain</span>
        <span className="stat-value accent">{result.maxGainDbi.toFixed(2)} dBi</span>
      </div>
      {result.maxDirectivityDbi != null && (
        <div className="stat">
          <span
            className="stat-label"
            title="Directivity (dBi): normalised to radiated power only, excluding all losses. = Gain / efficiency."
          >Directivity</span>
          <span className="stat-value">{result.maxDirectivityDbi.toFixed(2)} dBi</span>
        </div>
      )}
      {displayedRealizedGainDbi != null && (
        <div className="stat">
          <span
            className="stat-label"
            title={realizedGainTitle}
          >Realized gain</span>
          <span className="stat-value">{displayedRealizedGainDbi.toFixed(2)} dBi</span>
        </div>
      )}
      {result.efficiency != null && (
        <div className="stat">
          <span
            className="stat-label"
            title="Radiation efficiency: radiated power / accepted input power. Losses include wire conductors and any termination resistors."
          >Efficiency</span>
          <span className="stat-value">{(result.efficiency * 100).toFixed(1)}%</span>
        </div>
      )}
      <div className="stat">
        <span className="stat-label">Take-off elevation</span>
        <span className="stat-value">{result.takeoffElevationDeg.toFixed(1)}°</span>
      </div>
      <div className="stat">
        <span className="stat-label">Azimuth of peak</span>
        <span className="stat-value">{result.takeoffAzimuthDeg.toFixed(0)}°</span>
      </div>
      <div className="stat">
        <span className="stat-label" title={impedanceTitle}>{impedanceLabel}</span>
        <span className="stat-value">
          {displayedZ.R.toFixed(1)} {displayedZ.X >= 0 ? '+' : '−'}j{Math.abs(displayedZ.X).toFixed(1)} Ω
        </span>
      </div>
      <div className="stat">
        <span className="stat-label" title={swrTitle}>SWR (vs 50 Ω)</span>
        <span className="stat-value" style={{
          color: displayedSwr > 2 ? 'var(--danger)' : displayedSwr > 1.5 ? 'var(--warning)' : 'var(--success)',
        }}>{displayedSwr.toFixed(2)}:1</span>
      </div>
      {mode === 'comparison' && reference && (
        <ComparisonStats current={result} reference={reference.result} />
      )}
      <TerminationSection diagnostics={result.terminationDiagnostics} />
    </section>
  );
}

function ComparisonStats({
  current,
  reference,
}: {
  current: NonNullable<ReturnType<typeof useAntennaStore.getState>['result']>;
  reference: NonNullable<ReturnType<typeof useAntennaStore.getState>['comparisonReference']>['result'];
}) {
  return (
    /* SEO: Upgrade fragment to semantic section tag for document outline */
    <section aria-labelledby="comparison-stats-heading">
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <h3 id="comparison-stats-heading" style={{ fontSize: 11, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Versus reference
      </h3>
      <div className="stat">
        <span className="stat-label">Gain delta</span>
        <span className="stat-value">{formatSigned(current.maxGainDbi - reference.maxGainDbi, 2)} dB</span>
      </div>
      <div className="stat">
        <span className="stat-label">Take-off delta</span>
        <span className="stat-value">{formatSigned(current.takeoffElevationDeg - reference.takeoffElevationDeg, 1)}°</span>
      </div>
      <div className="stat">
        <span className="stat-label">SWR delta (vs 50 Ω)</span>
        <span className="stat-value">{formatSigned(current.swr - reference.swr, 2)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">R delta</span>
        <span className="stat-value">{formatSigned(current.impedance.R - reference.impedance.R, 1)} Ω</span>
      </div>
      <div className="stat">
        <span className="stat-label">X delta</span>
        <span className="stat-value">{formatSigned(current.impedance.X - reference.impedance.X, 1)} Ω</span>
      </div>
    </section>
  );
}

function formatSigned(value: number, digits: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function rippleColor(rippleDb: number): string {
  if (!Number.isFinite(rippleDb)) return 'var(--danger)';
  if (rippleDb < 3) return 'var(--success)';
  if (rippleDb < 10) return 'var(--warning)';
  return 'var(--danger)';
}

function legLabel(tagNo: number): string {
  if (tagNo === DIPOLE_LEFT_TAG) return 'Left leg ripple';
  if (tagNo === DIPOLE_RIGHT_TAG) return 'Right leg ripple';
  return `Tag ${tagNo} ripple`;
}

/**
 * Shows termination-effectiveness metrics for sloping-V antennas.
 * These are NOT feedpoint-match metrics — they measure whether the far-end
 * termination is absorbing the travelling wave.
 */
function TerminationSection({ diagnostics }: { diagnostics: TerminationDiagnostics }) {
  const antennaType = useAntennaStore((s) => s.antennaType);

  if (antennaType !== 'sloping-v') return null;

  const { currentRippleByTag, powerBudget, frontBackDb } = diagnostics;
  const legRipples = currentRippleByTag.filter(
    (r) => r.tagNo === DIPOLE_LEFT_TAG || r.tagNo === DIPOLE_RIGHT_TAG,
  );

  const hasContent =
    legRipples.length > 0 || powerBudget !== null || frontBackDb !== null;
  if (!hasContent) return null;

  return (
    /* SEO: Upgrade fragment to semantic section tag for document outline */
    <section aria-labelledby="termination-effectiveness-heading">
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <h3 id="termination-effectiveness-heading" style={{ fontSize: 11, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Termination effectiveness
      </h3>
      {legRipples.map((r) => (
        <div className="stat" key={r.tagNo}>
          <span className="stat-label">{legLabel(r.tagNo)}</span>
          <span className="stat-value" style={{ color: rippleColor(r.rippleDb) }}>
            {Number.isFinite(r.rippleDb) ? `${r.rippleDb.toFixed(1)} dB` : '∞ dB'}
          </span>
        </div>
      ))}
      {frontBackDb !== null && (
        <div className="stat">
          <span className="stat-label">Front/back ratio</span>
          <span className="stat-value">{frontBackDb.toFixed(1)} dB</span>
        </div>
      )}
      {powerBudget !== null && (
        <>
          <div className="stat">
            <span className="stat-label">Termination load</span>
            <span className="stat-value">
              {(powerBudget.networkLossW * 1000).toFixed(2)} mW
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Radiated power</span>
            <span className="stat-value">
              {(powerBudget.radiatedW * 1000).toFixed(2)} mW
            </span>
          </div>
        </>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        <strong>Note:</strong> Termination reduces reflections along the antenna wire.
        It does not guarantee a 50 Ω feedpoint impedance.
      </div>
    </section>
  );
}

