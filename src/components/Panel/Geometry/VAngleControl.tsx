import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';

export function VAngleControl() {
  const { antennaType, vAngle, setVAngle } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    vAngle: s.vAngle,
    setVAngle: s.setVAngle,
  })));

  if (antennaType !== 'sloping-v' && antennaType !== 'inverted-v') {
    return null;
  }

  return (
    <>
      <label htmlFor="sloping-v-angle" style={{ marginTop: 10 }}>V opening angle (°) — {vAngle}°</label>
      <input
        id="sloping-v-angle"
        type="range"
        min={10}
        max={180}
        step={1}
        value={vAngle}
        aria-label="V opening angle in degrees"
        aria-valuetext={`${vAngle}°`}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val)) return;
          setVAngle(val);
        }}
      />
    </>
  );
}
