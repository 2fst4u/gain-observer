import { useAntennaStore } from '../../store/antennaStore';
import { GROUND_PRESETS } from '../../physics/constants';
import { useState } from 'react';

export function GroundControl() {
  const groundId = useAntennaStore((s) => s.groundId);
  const sigma = useAntennaStore((s) => s.groundSigma);
  const epsilon = useAntennaStore((s) => s.groundEpsilon);
  const setGround = useAntennaStore((s) => s.setGround);
  const setCustomGround = useAntennaStore((s) => s.setCustomGround);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="panel-section">
      <h3>
        Ground
        <button style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Simple' : 'Custom'}
        </button>
      </h3>
      <select value={groundId} onChange={(e) => setGround(e.target.value)}>
        {GROUND_PRESETS.map((g) => (
          <option key={g.id} value={g.id}>{g.label}</option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        {GROUND_PRESETS.find((g) => g.id === groundId)?.hint ?? 'Custom ground parameters.'}
      </div>
      {(expanded || groundId === 'custom') && (
        <>
          <label style={{ marginTop: 10 }}>Conductivity σ (S/m)</label>
          <input
            type="number"
            min={0}
            step={0.001}
            value={sigma}
            onChange={(e) => setCustomGround(parseFloat(e.target.value), epsilon)}
          />
          <label style={{ marginTop: 6 }}>Permittivity εr</label>
          <input
            type="number"
            min={1}
            step={0.5}
            value={epsilon}
            onChange={(e) => setCustomGround(sigma, parseFloat(e.target.value))}
          />
        </>
      )}
    </div>
  );
}
