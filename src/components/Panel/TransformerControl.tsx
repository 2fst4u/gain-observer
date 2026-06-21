import { useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { TRANSFORMER_INSERTION_LOSS_DB, Z0_SYSTEM, findFeedlinePreset } from '../../physics/constants';
import { matchRatioForFeedpoint, suggestedTransformerRatio } from '../../physics/impedance';
import type { ImpedanceResult, SimulationResult } from '../../physics/types';

interface TransformerRatioInputProps {
  transformerRatio: number;
  optimalRatio: number | null;
  feedlineActive: boolean;
  setTransformerRatio: (ratio: number) => void;
}

function TransformerRatioInput({
  transformerRatio,
  optimalRatio,
  feedlineActive,
  setTransformerRatio,
}: TransformerRatioInputProps) {
  // Local state to allow natural typing (including empty strings)
  const [localRatio, setLocalRatio] = useState(transformerRatio.toString());
  const [isFocused, setIsFocused] = useState(false);

  // Sync local state when the store value changes (e.g. from outside)
  const [prevRatio, setPrevRatio] = useState(transformerRatio);
  if (transformerRatio !== prevRatio) {
    setPrevRatio(transformerRatio);
    if (!isFocused) {
      setLocalRatio(transformerRatio.toString());
    }
  }

  return (
    <>
      <label htmlFor="transformer-ratio" style={{ marginTop: 10 }}>
        Impedance ratio (n:1)
      </label>
      <div className="row" style={{ marginTop: 4 }}>
        <input
          id="transformer-ratio"
          type="number"
          min={1}
          max={10000}
          step={1}
          value={localRatio}
          aria-describedby="transformer-hint"
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalRatio(s);
            const v = parseFloat(s);
            if (Number.isFinite(v) && v >= 1) {
              setTransformerRatio(v);
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            setLocalRatio(transformerRatio.toString());
          }}
        />
        {optimalRatio !== null && optimalRatio !== transformerRatio && (
          <button
            onClick={() => setTransformerRatio(optimalRatio)}
            title={`Set ratio to ${optimalRatio}:1 — the estimated best match for this antenna${feedlineActive ? ' and feedline' : ''}, from the simulated impedance. The ratio is never changed automatically; click to apply.`}
            aria-label={`Match transformer ratio to ${optimalRatio}:1`}
            style={{ flex: '0 0 auto' }}
          >
            Match {optimalRatio}:1
          </button>
        )}
      </div>
      <div id="transformer-hint" aria-live="polite" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
        {transformerRatio === 1
          ? 'Ratio 1:1 — a current ("choke") balun. Suppresses common-mode current on the feedline shield, leaves antenna impedance unchanged.'
          : `Ratio ${transformerRatio}:1 — divides antenna feedpoint impedance by ${transformerRatio} and chokes common-mode current on the shield.`}
        {' '}Insertion loss: {TRANSFORMER_INSERTION_LOSS_DB.toFixed(1)} dB.
      </div>
    </>
  );
}

/**
 * Calculates the optimal transformer ratio for the current antenna.
 *
 * The suggestion must be ONE value regardless of which transformer is currently
 * fitted. How the antenna feedpoint is obtained differs by configuration:
 *
 *   • No feedline → the transformer is display-only (NEC never sees it), so
 *     `result.impedance` already is the bare antenna feedpoint. Match it to the
 *     50 Ω system impedance.
 *   • Feedline present → the transformer is baked into the NEC model, so the
 *     rig-end `result.impedance` depends on the fitted ratio *and* is polluted
 *     by shield common-mode current — back-solving it makes the suggestion drift
 *     every time it is applied. Instead match the separately-solved bare antenna
 *     feedpoint (`feedpointImpedance`, transformer/feedline stripped) to the
 *     feedline's characteristic impedance. That reference doesn't move when the
 *     ratio changes, so the suggestion is stable.
 */
function calculateOptimalRatio(
  result: SimulationResult | null,
  feedpointImpedance: ImpedanceResult | null,
  feedlineActive: boolean,
  feedlineId: string,
  transformerRatio: number
): number | null {
  if (!result) return null;
  if (!feedlineActive) {
    return suggestedTransformerRatio(result.impedance, transformerRatio);
  }
  // Need the transformer-independent reference; until it arrives, offer nothing
  // rather than a value derived from the ratio-dependent rig-end reading.
  if (!feedpointImpedance) return null;
  const preset = findFeedlinePreset(feedlineId);
  const target = preset.z0 > 0 ? preset.z0 : Z0_SYSTEM;
  return matchRatioForFeedpoint(feedpointImpedance.R, target);
}

/**
 * Transformer / balun controls. Rendered as an in-line sub-block (no outer
 * panel-section) so it can be embedded inside the Antenna panel — the
 * transformer is part of the antenna's feedpoint hardware (it applies
 * before the simulation), so it belongs visually with the antenna geometry
 * controls rather than as a separate top-level section.
 */
export function TransformerControl() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    transformerEnabled,
    transformerRatio,
    feedlineId,
    result,
    feedpointImpedance,
    setTransformerEnabled,
    setTransformerRatio,
  } = useAntennaStore(useShallow((s) => ({
    transformerEnabled: s.transformerEnabled,
    transformerRatio: s.transformerRatio,
    feedlineId: s.feedlineId,
    result: s.result,
    feedpointImpedance: s.feedpointImpedance,
    setTransformerEnabled: s.setTransformerEnabled,
    setTransformerRatio: s.setTransformerRatio,
  })));

  const feedlineActive = feedlineId !== 'none';
  const optimalRatio = calculateOptimalRatio(
    result,
    feedpointImpedance,
    feedlineActive,
    feedlineId,
    transformerRatio
  );

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
        <TransformerRatioInput
          transformerRatio={transformerRatio}
          optimalRatio={optimalRatio}
          feedlineActive={feedlineActive}
          setTransformerRatio={setTransformerRatio}
        />
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
