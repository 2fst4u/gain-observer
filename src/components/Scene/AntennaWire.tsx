// The physical antenna wires (dipole + optional coax-shield feedline),
// rendered as thin cylinders between endpoints with a feed-point sphere at
// the antenna terminals. Converts from the NEC-style coordinate system
// (Z-up) used in the store to the R3F Y-up scene:
//   scene.x = nec.x
//   scene.y = nec.z
//   scene.z = -nec.y
//
// See RadiationPattern.tsx for the matching remap.

import { useShallow } from 'zustand/react/shallow';
import { useAntennaStore } from '../../store/antennaStore';
import { THEME_COLORS } from '../../utils/themeColors';
import { useAntennaGeometry, type AntennaWireProps } from './useAntennaGeometry';
import { AntennaElement } from './AntennaElement';
import { Feedpoint } from './Feedpoint';
import { ShieldElement } from './ShieldElement';
import { TerminatedDeltaElement } from './TerminatedDeltaElement';

export function AntennaWire(props: AntennaWireProps) {
  const { theme, transformerEnabled, terminatingResistor } = useAntennaStore(useShallow((s) => ({
    theme: s.theme,
    transformerEnabled: s.transformerEnabled,
    terminatingResistor: s.terminatingResistor,
  })));

  const { rendered, shield, feedpoint, terminatedDeltaSplit } = useAntennaGeometry(props);
  const wireColor = THEME_COLORS[theme].wire;

  return (
    <group>
      {rendered.map((s) => (
        <AntennaElement key={s.key} wire={s} color={wireColor} />
      ))}
      {feedpoint && <Feedpoint position={feedpoint} color={THEME_COLORS[theme].feedpoint} />}
      {shield && (
        <ShieldElement shield={shield} transformerEnabled={transformerEnabled} />
      )}
      {terminatedDeltaSplit && (
        <TerminatedDeltaElement
          split={terminatedDeltaSplit}
          theme={theme}
          terminatingResistor={terminatingResistor}
        />
      )}
    </group>
  );
}
