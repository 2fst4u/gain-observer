import { useAntennaStore } from '../../store/antennaStore';
import type { Mode } from '../../store/antennaStore';

const MODES: Array<{ id: Mode; label: string; hint: string; shortcut?: string }> = [
  { id: 'normal', label: 'Normal', hint: 'Standard DX pattern view', shortcut: 'm' },
  { id: 'comparison', label: 'Compare', hint: 'Side-by-side two configs', shortcut: 'm' },
];

export function ModeSelector() {
  const mode = useAntennaStore((s) => s.mode);
  const setMode = useAntennaStore((s) => s.setMode);
  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2 id="mode-selector-heading">Mode</h2>
      <div className="button-group" role="group" aria-labelledby="mode-selector-heading" aria-describedby="mode-hint">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={mode === m.id ? 'active' : ''}
            onClick={() => setMode(m.id)}
            title={m.shortcut ? `${m.hint} (${m.shortcut.toUpperCase()})` : m.hint}
            aria-keyshortcuts={m.shortcut}
            aria-pressed={mode === m.id}
          >{m.label}</button>
        ))}
      </div>
      <div id="mode-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        {MODES.find((m) => m.id === mode)!.hint}
      </div>
    </section>
  );
}
