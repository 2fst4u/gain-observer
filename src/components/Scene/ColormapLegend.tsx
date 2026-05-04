import { useAntennaStore } from '../../store/antennaStore';
import { getColormapCssGradient } from '../../utils/colormap';
import type { SimulationResult } from '../../physics/types';

interface Props {
  readonly result: SimulationResult | null;
}

export function ColormapLegend({ result }: Props) {
  const colormap = useAntennaStore((s) => s.colormap);
  const dbRange = useAntennaStore((s) => s.dbRange);
  const colorMaxDb = useAntennaStore((s) => s.colorMaxDb);

  if (!result) return null;

  const minDb = colorMaxDb - dbRange;

  const gradient = getColormapCssGradient(colormap);

  return (
    <div className="colormap-legend">
      <div className="colormap-legend-labels">
        <span>{colorMaxDb.toFixed(1)} dBi</span>
        <span>{minDb.toFixed(1)} dBi</span>
      </div>
      <div
        className="colormap-legend-gradient"
        style={{ background: gradient }}
      />
    </div>
  );
}
