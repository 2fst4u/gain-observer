import { useAntennaStore } from '../../store/antennaStore';
import { swr, transformImpedance } from '../../physics/impedance';

export function TransformerControl() {
  const result = useAntennaStore((s) => s.result);
  const transformerEnabled = useAntennaStore((s) => s.transformerEnabled);
  const transformerRatio = useAntennaStore((s) => s.transformerRatio);
  const setTransformerEnabled = useAntennaStore((s) => s.setTransformerEnabled);
  const setTransformerRatio = useAntennaStore((s) => s.setTransformerRatio);

  const transformedZ = result && transformerEnabled
    ? transformImpedance(result.impedance, transformerRatio)
    : null;
  const transformedSwr = transformedZ !== null ? swr(transformedZ) : null;

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Ideal transformer</h2>
      <label
        htmlFor="transformer-enable"
        style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0, fontSize: 12 }}
      >
        <input
          id="transformer-enable"
          type="checkbox"
          checked={transformerEnabled}
          onChange={(e) => setTransformerEnabled(e.target.checked)}
        />
        Show post-processing view
      </label>

      {transformerEnabled && (
        <>
          <label htmlFor="transformer-ratio" style={{ marginTop: 10 }}>
            Impedance ratio (n²)
          </label>
          <input
            id="transformer-ratio"
            type="number"
            min={1}
            max={10000}
            step={1}
            value={transformerRatio}
            aria-describedby="transformer-hint"
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v >= 1) setTransformerRatio(v);
            }}
            style={{ width: '100%', marginTop: 4 }}
          />
          <div id="transformer-hint" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Z_transformed = Z_feedpoint / ratio (ideal, lossless)
          </div>

          {result && transformedZ !== null && transformedSwr !== null && (
            <>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                After {transformerRatio}:1 transformer
              </div>
              <div className="stat">
                <span
                  className="stat-label"
                  title="Raw feedpoint impedance from NEC — unchanged by transformer setting."
                >Feedpoint (raw R + jX)</span>
                <span className="stat-value">
                  {result.impedance.R.toFixed(1)} {result.impedance.X >= 0 ? '+' : '−'}j{Math.abs(result.impedance.X).toFixed(1)} Ω
                </span>
              </div>
              <div className="stat">
                <span
                  className="stat-label"
                  title="Raw SWR vs 50 Ω at the feedpoint — unchanged by transformer setting."
                >Raw SWR (vs 50 Ω)</span>
                <span
                  className="stat-value"
                  style={{
                    color: result.swr > 2 ? 'var(--danger)' : result.swr > 1.5 ? 'var(--warning)' : 'var(--success)',
                  }}
                >
                  {result.swr.toFixed(2)}:1
                </span>
              </div>
              <div className="stat">
                <span
                  className="stat-label"
                  title="Transformed impedance = feedpoint impedance ÷ ratio. Post-processing only."
                >Transformed (R + jX)</span>
                <span className="stat-value">
                  {transformedZ.R.toFixed(1)} {transformedZ.X >= 0 ? '+' : '−'}j{Math.abs(transformedZ.X).toFixed(1)} Ω
                </span>
              </div>
              <div className="stat">
                <span
                  className="stat-label"
                  title="SWR vs 50 Ω after ideal transformer. Post-processing only."
                >Transformed SWR (vs 50 Ω)</span>
                <span
                  className="stat-value"
                  style={{
                    color: transformedSwr > 2 ? 'var(--danger)' : transformedSwr > 1.5 ? 'var(--warning)' : 'var(--success)',
                  }}
                >
                  {transformedSwr.toFixed(2)}:1
                </span>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <strong>Note:</strong> Transformer values are ideal post-processing calculations.
                Actual transformer losses, bandwidth limits, and physical effects are not modelled
                unless explicitly added to the NEC geometry.
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
