import { useAntennaStore } from '../../store/antennaStore';
import type { Colormap } from '../../store/antennaStore';

const COLORMAPS: Colormap[] = ['viridis', 'turbo', 'jet'];

export function DisplayControl() {
  const colormap = useAntennaStore((s) => s.colormap);
  const dbRange = useAntennaStore((s) => s.dbRange);
  const patternScale = useAntennaStore((s) => s.patternScale);
  const showGrid = useAntennaStore((s) => s.showGrid);
  const showAxes = useAntennaStore((s) => s.showAxes);
  const showPolarCuts = useAntennaStore((s) => s.showPolarCuts);
  const setColormap = useAntennaStore((s) => s.setColormap);
  const setDbRange = useAntennaStore((s) => s.setDbRange);
  const setPatternScale = useAntennaStore((s) => s.setPatternScale);
  const setShowGrid = useAntennaStore((s) => s.setShowGrid);
  const setShowAxes = useAntennaStore((s) => s.setShowAxes);
  const setShowPolarCuts = useAntennaStore((s) => s.setShowPolarCuts);

  return (
    <div className="panel-section">
      <h3>Display</h3>
      <label>Colormap</label>
      <div className="button-group">
        {COLORMAPS.map((c) => (
          <button
            key={c}
            className={colormap === c ? 'active' : ''}
            onClick={() => setColormap(c)}
          >{c}</button>
        ))}
      </div>

      <label style={{ marginTop: 10 }}>Dynamic range — {dbRange} dB</label>
      <input
        type="range" min={10} max={50} step={1}
        value={dbRange}
        onChange={(e) => setDbRange(parseInt(e.target.value))}
      />

      <label style={{ marginTop: 8 }}>Pattern scale — {patternScale.toFixed(2)}×</label>
      <input
        type="range" min={0.3} max={3} step={0.1}
        value={patternScale}
        onChange={(e) => setPatternScale(parseFloat(e.target.value))}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, fontSize: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0 }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Ground grid
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0 }}>
          <input type="checkbox" checked={showAxes} onChange={(e) => setShowAxes(e.target.checked)} />
          Axes helper
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0 }}>
          <input type="checkbox" checked={showPolarCuts} onChange={(e) => setShowPolarCuts(e.target.checked)} />
          Polar plots
        </label>
      </div>
    </div>
  );
}
