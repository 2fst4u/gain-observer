import { useAntennaStore, DIPOLE_LEFT_TAG, DIPOLE_RIGHT_TAG } from '../../store/antennaStore';
import { mismatchLossFactor, transformImpedance } from '../../physics/impedance';
import type { TerminationDiagnostics } from '../../physics/types';

export function StatsReadout() {
  const result = useAntennaStore((s) => s.result);
  const mode = useAntennaStore((s) => s.mode);
  const reference = useAntennaStore((s) => s.comparisonReference);
  const transformerEnabled = useAntennaStore((s) => s.transformerEnabled);
  const transformerRatio = useAntennaStore((s) => s.transformerRatio);
  const feedlineId = useAntennaStore((s) => s.feedlineId);
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

  let transformedRealizedGainDbi: number | undefined;
  if (transformerEnabled) {
    const transformedZ = transformImpedance(result.impedance, transformerRatio);
    const mlf = mismatchLossFactor(transformedZ);
    if (mlf > 0) transformedRealizedGainDbi = result.maxGainDbi + 10 * Math.log10(mlf);
  }

  const impedanceLabel = feedlineActive ? 'Source impedance (R + jX)' : 'Feedpoint (R + jX)';
  const impedanceTitle = feedlineActive
    ? 'Impedance at the source end of the feedline (what the radio sees). With a feedline configured, NEC places the excitation source at the radio end of the cable, so this is the cable-transformed impedance — not the antenna terminals. To see the antenna terminals directly, set Feedline = none.'
    : 'Impedance at the antenna feedpoint. With no feedline configured, NEC places the excitation directly at the antenna terminals.';
  const swrTitle = feedlineActive
    ? 'Voltage SWR at the source end of the feedline against 50 Ω. This is what your radio\'s SWR meter would see. A lossless cable cannot improve SWR — it can only rotate the impedance around the Smith chart. To improve SWR you need matching at the antenna or a tuner at the radio.'
    : 'Voltage SWR at the antenna feedpoint against 50 Ω. Measured directly at the antenna terminals with no feedline in the chain.';

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
      {result.maxRealizedGainDbi != null && (
        <div className="stat">
          <span
            className="stat-label"
            title={
              (feedlineActive
                ? 'Realized gain, raw 50 Ω (dBi): gain accounting for mismatch loss at the source end of the feedline against a 50 Ω source. With a feedline in the chain, mismatch loss is computed at the radio end of the cable. = Gain × (1 − |Γ|²).'
                : 'Realized gain, raw 50 Ω (dBi): gain accounting for mismatch loss between the antenna feedpoint impedance and a 50 Ω source. = Gain × (1 − |Γ|²).')
              + ' Does not include the Ideal transformer post-processing option.'
            }
          >Realized gain{transformerEnabled ? ' (raw)' : ''}</span>
          <span className="stat-value">{result.maxRealizedGainDbi.toFixed(2)} dBi</span>
        </div>
      )}
      {transformedRealizedGainDbi != null && (
        <div className="stat">
          <span
            className="stat-label"
            title="Realized gain after ideal transformer (dBi): antenna gain after mismatch loss using the transformed impedance. A transformer changes impedance ratio only — it does not cancel reactance. Transformer loss and bandwidth are not modelled."
          >Realized gain (transformed)</span>
          <span className="stat-value">{transformedRealizedGainDbi.toFixed(2)} dBi</span>
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
          {result.impedance.R.toFixed(1)} {result.impedance.X >= 0 ? '+' : '−'}j{Math.abs(result.impedance.X).toFixed(1)} Ω
        </span>
      </div>
      <div className="stat">
        <span className="stat-label" title={swrTitle}>SWR (vs 50 Ω)</span>
        <span className="stat-value" style={{
          color: result.swr > 2 ? 'var(--danger)' : result.swr > 1.5 ? 'var(--warning)' : 'var(--success)',
        }}>{result.swr.toFixed(2)}:1</span>
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Versus reference
      </div>
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Termination effectiveness
      </div>
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
