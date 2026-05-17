import { useAntennaStore } from '../../store/antennaStore';
import type { Colormap } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';

const COLORMAPS: Colormap[] = ['viridis', 'turbo', 'jet'];

export function DisplayControl() {
  const {
    colormap,
    dbRange,
    colorMaxDb,
    patternScale,
    showGrid,
    showAxes,
    showPolarCuts,
    setColormap,
    setDbRange,
    setColorMaxDb,
    setPatternScale,
    setShowGrid,
    setShowAxes,
    setShowPolarCuts,
  } = useAntennaStore(useShallow((s) => ({
    colormap: s.colormap,
    dbRange: s.dbRange,
    colorMaxDb: s.colorMaxDb,
    patternScale: s.patternScale,
    showGrid: s.showGrid,
    showAxes: s.showAxes,
    showPolarCuts: s.showPolarCuts,
    setColormap: s.setColormap,
    setDbRange: s.setDbRange,
    setColorMaxDb: s.setColorMaxDb,
    setPatternScale: s.setPatternScale,
    setShowGrid: s.setShowGrid,
    setShowAxes: s.setShowAxes,
    setShowPolarCuts: s.setShowPolarCuts,
  })));

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Display</h2>
      <label id="colormap-label">Colormap</label>
      <div className="button-group" role="group" aria-labelledby="colormap-label">
        {COLORMAPS.map((c) => (
          <button
            key={c}
            className={colormap === c ? 'active' : ''}
            onClick={() => setColormap(c)}
            aria-pressed={colormap === c}
          >{c}</button>
        ))}
      </div>

      <label htmlFor="dynamic-range" style={{ marginTop: 10 }}>Dynamic range — {dbRange} dB</label>
      <input
        id="dynamic-range"
        type="range" min={10} max={50} step={1}
        value={dbRange}
        onChange={(e) => setDbRange(parseInt(e.target.value, 10))}
      />

      <label htmlFor="color-max" style={{ marginTop: 8 }}>Color max — {colorMaxDb} dBi</label>
      <input
        id="color-max"
        type="range" min={-20} max={30} step={1}
        value={colorMaxDb}
        onChange={(e) => setColorMaxDb(parseInt(e.target.value, 10))}
      />

      <label htmlFor="pattern-scale" style={{ marginTop: 8 }}>Pattern scale — {patternScale.toFixed(2)}×</label>
      <input
        id="pattern-scale"
        type="range" min={0.3} max={3} step={0.1}
        value={patternScale}
        onChange={(e) => setPatternScale(parseFloat(e.target.value))}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10, fontSize: 12 }}>
        <label htmlFor="show-grid" style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0 }}>
          <input id="show-grid" type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Ground grid
        </label>
        <label htmlFor="show-axes" style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0 }}>
          <input id="show-axes" type="checkbox" checked={showAxes} onChange={(e) => setShowAxes(e.target.checked)} />
          Axes helper
        </label>
        <label htmlFor="show-polar-cuts" style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0 }}>
          <input id="show-polar-cuts" type="checkbox" checked={showPolarCuts} onChange={(e) => setShowPolarCuts(e.target.checked)} />
          Polar plots
        </label>
      </div>
    </section>
  );
}
