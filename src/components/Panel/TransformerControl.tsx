import { useAntennaStore } from '../../store/antennaStore';
import { TRANSFORMER_INSERTION_LOSS_DB } from '../../physics/constants';

/**
 * Transformer / balun controls. Rendered as an in-line sub-block (no outer
 * panel-section) so it can be embedded inside the Antenna panel — the
 * transformer is part of the antenna's feedpoint hardware (it applies
 * before the simulation), so it belongs visually with the antenna geometry
 * controls rather than as a separate top-level section.
 */
export function TransformerControl() {
  const transformerEnabled = useAntennaStore((s) => s.transformerEnabled);
  const transformerRatio = useAntennaStore((s) => s.transformerRatio);
  const setTransformerEnabled = useAntennaStore((s) => s.setTransformerEnabled);
  const setTransformerRatio = useAntennaStore((s) => s.setTransformerRatio);

  return (
    <section aria-labelledby="transformer-heading" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <h3
        id="transformer-heading"
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-dim)',
          margin: '0 0 8px 0',
        }}
      >
        Transformer at feedpoint
      </h3>
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
        Fit transformer / balun at the antenna
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
          <div id="transformer-hint" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
            {transformerRatio === 1
              ? 'Ratio 1:1 — a current ("choke") balun. Suppresses common-mode current on the feedline shield, leaves antenna impedance unchanged.'
              : `Ratio ${transformerRatio}:1 — divides antenna feedpoint impedance by ${transformerRatio} and chokes common-mode current on the shield.`}
            {' '}Insertion loss: {TRANSFORMER_INSERTION_LOSS_DB.toFixed(1)} dB.
          </div>
        </>
      )}

      {!transformerEnabled && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          No transformer fitted — the feedline shield carries common-mode current
          and contributes to radiation (often skewing the pattern for off-centre or
          unbalanced feeds).
        </div>
      )}
    </section>
  );
}
