import { useAntennaStore } from '../../store/antennaStore';

export function StatsReadout() {
  const result = useAntennaStore((s) => s.result);
  const mode = useAntennaStore((s) => s.mode);
  const reference = useAntennaStore((s) => s.comparisonReference);
  if (!result) {
    return (
      <div className="panel-section">
        {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
        <h2>Results</h2>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Computing…</div>
      </div>
    );
  }
  return (
    <div className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Results <span className="badge">{result.computeTimeMs.toFixed(0)} ms</span></h2>
      <div className="stat">
        <span className="stat-label">Max gain</span>
        <span className="stat-value accent">{result.maxGainDbi.toFixed(2)} dBi</span>
      </div>
      <div className="stat">
        <span className="stat-label">Take-off elevation</span>
        <span className="stat-value">{result.takeoffElevationDeg.toFixed(1)}°</span>
      </div>
      <div className="stat">
        <span className="stat-label">Azimuth of peak</span>
        <span className="stat-value">{result.takeoffAzimuthDeg.toFixed(0)}°</span>
      </div>
      <div className="stat">
        <span className="stat-label">Feedpoint (R + jX)</span>
        <span className="stat-value">
          {result.impedance.R.toFixed(1)} {result.impedance.X >= 0 ? '+' : '−'}j{Math.abs(result.impedance.X).toFixed(1)} Ω
        </span>
      </div>
      <div className="stat">
        <span className="stat-label">SWR (raw 50 Ω)</span>
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
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        <strong>Note:</strong> Termination reduces reflections along the antenna wire.
        It does not guarantee a 50 Ω feedpoint impedance.
      </div>
    </div>
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
        <span className="stat-label">SWR delta (raw 50 Ω)</span>
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
