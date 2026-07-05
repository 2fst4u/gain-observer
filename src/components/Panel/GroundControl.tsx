import { useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { GROUND_PRESETS, GROUND_PRESET_MAP } from '../../physics/constants';

export function GroundControl() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    groundId,
    groundSigma: sigma,
    groundEpsilon: epsilon,
    setGround,
    setCustomGround,
  } = useAntennaStore(useShallow((s) => ({
    groundId: s.groundId,
    groundSigma: s.groundSigma,
    groundEpsilon: s.groundEpsilon,
    setGround: s.setGround,
    setCustomGround: s.setCustomGround,
  })));
  const [expanded, setExpanded] = useState(false);

  const [localSigma, setLocalSigma] = useState(sigma.toString());
  const [localEpsilon, setLocalEpsilon] = useState(epsilon.toString());
  const [isSigmaFocused, setIsSigmaFocused] = useState(false);
  const [isEpsilonFocused, setIsEpsilonFocused] = useState(false);

  const [prevSigma, setPrevSigma] = useState(sigma);
  if (sigma !== prevSigma) {
    setPrevSigma(sigma);
    if (!isSigmaFocused) {
      setLocalSigma(sigma.toString());
    }
  }

  const [prevEpsilon, setPrevEpsilon] = useState(epsilon);
  if (epsilon !== prevEpsilon) {
    setPrevEpsilon(epsilon);
    if (!isEpsilonFocused) {
      setLocalEpsilon(epsilon.toString());
    }
  }

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>
        <label htmlFor="ground-preset" style={{ display: 'inline-block' }}>Ground</label>
        <button
          style={{ padding: '2px 8px', fontSize: 11, marginLeft: 8 }}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Simple: Hide custom ground settings' : 'Custom: Show custom ground settings'}
          title={expanded ? 'Hide custom settings' : 'Show custom settings'}
        >
          {expanded ? 'Simple' : 'Custom'}
        </button>
      </h2>
      <select id="ground-preset" aria-label="Ground preset" value={groundId} onChange={(e) => setGround(e.target.value)} aria-describedby="ground-hint">
        {GROUND_PRESETS.map((g) => (
          <option key={g.id} value={g.id}>{g.label}</option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      <div id="ground-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        {GROUND_PRESET_MAP.get(groundId)?.hint ?? 'Custom ground parameters.'}
      </div>
      {(expanded || groundId === 'custom') && (
        <>
          <label htmlFor="custom-ground-sigma" style={{ marginTop: 10 }}>Conductivity σ (S/m)</label>
          <input
            id="custom-ground-sigma"
            type="number"
            min={0}
            step={0.001}
            value={localSigma}
            onFocus={() => setIsSigmaFocused(true)}
            onChange={(e) => {
              const s = e.target.value;
              setLocalSigma(s);
              const val = parseFloat(s);
              if (!isNaN(val)) {
                setCustomGround(val, epsilon);
              }
            }}
            onBlur={() => {
              setIsSigmaFocused(false);
              setLocalSigma(sigma.toString());
            }}
          />
          <label htmlFor="custom-ground-epsilon" style={{ marginTop: 6 }}>Permittivity εr</label>
          <input
            id="custom-ground-epsilon"
            type="number"
            min={1}
            step={0.5}
            value={localEpsilon}
            onFocus={() => setIsEpsilonFocused(true)}
            onChange={(e) => {
              const s = e.target.value;
              setLocalEpsilon(s);
              const val = parseFloat(s);
              if (!isNaN(val)) {
                setCustomGround(sigma, val);
              }
            }}
            onBlur={() => {
              setIsEpsilonFocused(false);
              setLocalEpsilon(epsilon.toString());
            }}
          />
        </>
      )}
    </section>
  );
}
