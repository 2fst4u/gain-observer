import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { getColormapCssGradient } from '../../utils/colormap';
import type { SimulationResult } from '../../physics/types';

interface Props {
  readonly result: SimulationResult | null;
}

export function ColormapLegend({ result }: Props) {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const { colormap, dbRange, colorMaxDb } = useAntennaStore(
    useShallow((s) => ({
      colormap: s.colormap,
      dbRange: s.dbRange,
      colorMaxDb: s.colorMaxDb,
    })),
  );

  if (!result) return null;

  const minDb = colorMaxDb - dbRange;

  const gradient = getColormapCssGradient(colormap);

  return (
    /* SEO: Upgrade generic div wrapper to a semantic figure tag, with figcaption for clear labeling */
    <figure className="colormap-legend" aria-label="Gain colormap legend">
      <figcaption className="colormap-legend-labels">
        <span>{colorMaxDb.toFixed(1)} dBi</span>
        <span>{minDb.toFixed(1)} dBi</span>
      </figcaption>
      <div
        className="colormap-legend-gradient"
        style={{ background: gradient }}
      />
    </figure>
  );
}
