import { useAntennaStore } from '../../store/antennaStore';
import type { Mode } from '../../store/antennaStore';

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: 'normal', label: 'Normal', hint: 'Standard DX pattern view' },
  { id: 'nvis', label: 'NVIS', hint: 'Highlights zenith lobe for regional comms' },
  { id: 'comparison', label: 'Compare', hint: 'Side-by-side two configs' },
];

export function ModeSelector() {
  const mode = useAntennaStore((s) => s.mode);
  const setMode = useAntennaStore((s) => s.setMode);
  return (
    <div className="panel-section">
      <h3>Mode</h3>
      <div className="button-group">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={mode === m.id ? 'active' : ''}
            onClick={() => setMode(m.id)}
            title={m.hint}
          >{m.label}</button>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        {MODES.find((m) => m.id === mode)!.hint}
      </div>
    </div>
  );
}
