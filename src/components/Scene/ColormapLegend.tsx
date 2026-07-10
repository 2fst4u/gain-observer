import { useMemo } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { getColormapCssGradient } from '../../utils/colormap';
import type { SimulationResult } from '../../physics/types';

interface Props {
  readonly result: SimulationResult | null;
}

export function ColormapLegend({ result }: Props) {
  const { colormap, dbRange, colorMaxDb } = useAntennaStore(
    useShallow((s) => ({
      colormap: s.colormap,
      dbRange: s.dbRange,
      colorMaxDb: s.colorMaxDb,
    })),
  );

  // ⚡ Bolt: Performance Optimization
  // Memoize the CSS gradient string generation. This prevents unnecessary string allocations
  // and array processing when the component re-renders due to unrelated state changes
  // (like `colorMaxDb` or `dbRange`), reducing GC overhead and CPU usage.
  const gradient = useMemo(() => getColormapCssGradient(colormap), [colormap]);

  if (!result) return null;

  const minDb = colorMaxDb - dbRange;

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
