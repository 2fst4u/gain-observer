import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { GeometryStatus } from './GeometryStatus';
import { TransformerControl } from './TransformerControl';

import { TypeControl } from './Geometry/TypeControl';
import { LengthControl } from './Geometry/LengthControl';
import { TravelingWaveLegControl } from './Geometry/TravelingWaveLegControl';
import { HeightControl } from './Geometry/HeightControl';
import { VAngleControl } from './Geometry/VAngleControl';
import { ApertureControl } from './Geometry/ApertureControl';
import { TerminationControl } from './Geometry/TerminationControl';
import { CounterpoiseControl } from './Geometry/CounterpoiseControl';
import { OrientationControl } from './Geometry/OrientationControl';

export function GeometryControl() {
  const { antennaType } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
  })));

  const isGroundMountedVertical = antennaType === 'vertical-whip' || antennaType === 'inverted-l';

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2><label htmlFor="antenna-type">Antenna</label></h2>

      <TypeControl />
      <LengthControl />
      <TravelingWaveLegControl />
      <HeightControl />
      <VAngleControl />
      <ApertureControl />
      <TerminationControl />
      <CounterpoiseControl />
      <GeometryStatus />
      <OrientationControl />

      {/* Transformer / balun: hidden for base-fed monopole-style antennas —
          the transformer model assumes a balanced two-terminal feedpoint. */}
      {!isGroundMountedVertical && <TransformerControl />}
    </section>
  );
}
