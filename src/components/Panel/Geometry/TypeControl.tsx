import { useAntennaStore, type AntennaType } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { resonateTitles } from './geometryUtils';

export function TypeControl() {
  const { antennaType, setAntennaType } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    setAntennaType: s.setAntennaType,
  })));

  return (
    <>
      <select
        id="antenna-type"
        value={antennaType}
        onChange={(e) => setAntennaType(e.target.value as AntennaType)}
        aria-describedby="antenna-type-hint"
        style={{ marginBottom: 4 }}
      >
        <option value="dipole">Horizontal Dipole</option>
        <option value="inverted-v">Inverted V</option>
        <option value="sloping-v">Sloping V</option>
        <option value="delta-loop">Delta Loop</option>
        <option value="terminated-delta">Terminated Delta</option>
        <option value="vertical-whip">Vertical Whip</option>
        <option value="inverted-l">Inverted-L</option>
        <option value="folded-dipole">Folded Dipole</option>
      </select>
      <div id="antenna-type-hint" aria-live="polite" style={{ marginBottom: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        {resonateTitles[antennaType]}
      </div>
    </>
  );
}
