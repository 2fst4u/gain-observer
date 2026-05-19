import { useAntennaStore, DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG } from '../../store/antennaStore';
import {
  mismatchLossFactor,
  swr,
  transformWithTransformerAtAntenna,
} from '../../physics/impedance';
import {
  findFeedlinePreset,
  TRANSFORMER_INSERTION_LOSS_DB,
  wavelengthMeters,
} from '../../physics/constants';
import type { ImpedanceResult, TerminationDiagnostics } from '../../physics/types';

export function StatsReadout() {
  const result = useAntennaStore((s) => s.result);
  const mode = useAntennaStore((s) => s.mode);
  const reference = useAntennaStore((s) => s.comparisonReference);
  const transformerEnabled = useAntennaStore((s) => s.transformerEnabled);
  const transformerRatio = useAntennaStore((s) => s.transformerRatio);
  const feedlineId = useAntennaStore((s) => s.feedlineId);
  const feedlineLength = useAntennaStore((s) => s.feedlineLength);
  const frequency = useAntennaStore((s) => s.frequency);
  const feedlineActive = feedlineId !== 'none';
  if (!result) {
    return (
      <section className="panel-section">
        {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
        <h2>Results</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Computing…</div>
      </section>
    );
  }

  // Cable parameters needed for transformer-at-antenna math when feedline is active.
  let cableZ0 = 50;
  let cableLengthLambdas = 0;
  if (feedlineActive) {
    const preset = findFeedlinePreset(feedlineId);
    cableZ0 = preset.z0;
    const lambdaCable = preset.velocityFactor * wavelengthMeters(frequency);
    cableLengthLambdas = feedlineLength / lambdaCable;
  }

  // Apply the transformer at the antenna terminals: divide the antenna's
  // feedpoint impedance by the ratio (the cable then sees that as its load).
  // With no feedline this is just Z/ratio; with a feedline we de-embed →
  // divide → re-embed. The accompanying choke (engaged by setting transformer
  // = enabled) suppresses shield common-mode current, so the de-embed math is
  // accurate.
  const displayedZ: ImpedanceResult = transformerEnabled
    ? transformWithTransformerAtAntenna(result.impedance, transformerRatio, cableZ0, cableLengthLambdas)
    : result.impedance;
  const displayedSwr = transformerEnabled ? swr(displayedZ) : result.swr;

  let displayedRealizedGainDbi: number | undefined;
  if (transformerEnabled) {
    const mlf = mismatchLossFactor(displayedZ);
    if (mlf > 0) {
      displayedRealizedGainDbi =
        result.maxGainDbi + 10 * Math.log10(mlf) - TRANSFORMER_INSERTION_LOSS_DB;
    }
  } else {
    displayedRealizedGainDbi = result.maxRealizedGainDbi ?? undefined;
  }

  const impedanceLabel = feedlineActive ? 'Source impedance (R + jX)' : 'Feedpoint (R + jX)';
  const impedanceTitle = feedlineActive
    ? `Impedance at the source end of the feedline (what the radio sees)${transformerEnabled ? `, with the ${transformerRatio}:1 transformer fitted at the antenna terminals` : ''}. To see the antenna terminals directly, set Feedline = none.`
    : transformerEnabled
      ? `Impedance after the ${transformerRatio}:1 transformer fitted at the antenna terminals.`
      : 'Impedance at the antenna feedpoint. NEC places the excitation directly at the antenna terminals.';
  const swrTitle = feedlineActive
    ? `Voltage SWR at the source end of the feedline against 50 Ω${transformerEnabled ? ` (with the transformer fitted at the antenna)` : ''}. This is what your radio's SWR meter would see.`
    : transformerEnabled
      ? `Voltage SWR at the radio side of the antenna's ${transformerRatio}:1 transformer against 50 Ω.`
      : 'Voltage SWR at the antenna feedpoint against 50 Ω.';

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
            title={
              transformerEnabled
                ? `Realized gain (dBi): antenna gain after mismatch loss against 50 Ω with the ${transformerRatio}:1 transformer fitted at the antenna terminals, minus ${TRANSFORMER_INSERTION_LOSS_DB.toFixed(1)} dB transformer insertion loss.`
                : 'Realized gain (dBi): antenna gain after mismatch loss against 50 Ω. = Gain × (1 − |Γ|²).'
            }
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
      {mode === 'nvis' && (
        <NvisStats />
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
    <>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <h3 style={{ fontSize: 11, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
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
    </>
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
    <>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <h3 style={{ fontSize: 11, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
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
    </>
  );
}

function NvisStats() {
  const result = useAntennaStore((s) => s.result);
  if (!result) return null;
  // Compute NVIS metric: gain at theta=0 (i.e. zenith).
  // At zenith, far-field gain is independent of phi, so we can just sample data[0]
  // instead of averaging across all phi steps.
  const p = result.pattern;
  const zenithGain = p.phiSteps > 0 ? (p.data[0] ?? 0) : 0;
  const ratio = zenithGain - result.maxGainDbi;

  return (
    <>
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '8px 0' }} />
      <div className="stat">
        <span className="stat-label">Zenith gain (NVIS)</span>
        <span className="stat-value">{zenithGain.toFixed(2)} dBi</span>
      </div>
      <div className="stat">
        <span className="stat-label">NVIS vs peak</span>
        <span className="stat-value">{ratio.toFixed(2)} dB</span>
      </div>
    </>
  );
}
