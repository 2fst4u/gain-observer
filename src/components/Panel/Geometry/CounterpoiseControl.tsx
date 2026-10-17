import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';

export function CounterpoiseControl() {
  const { antennaType, whipCounterpoise, setWhipCounterpoise } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    whipCounterpoise: s.whipCounterpoise,
    setWhipCounterpoise: s.setWhipCounterpoise,
  })));

  const isGroundMountedVertical = antennaType === 'vertical-whip' || antennaType === 'inverted-l';

  if (!isGroundMountedVertical) {
    return null;
  }

  return (
    <>
      <label
        htmlFor="whip-counterpoise"
        style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: '10px 0 0 0', fontSize: 12 }}
      >
        <input
          id="whip-counterpoise"
          type="checkbox"
          checked={whipCounterpoise}
          onChange={(e) => setWhipCounterpoise(e.target.checked)}
          aria-describedby="whip-counterpoise-hint"
        />
        Add ¼λ counterpoise radials
      </label>
      <div id="whip-counterpoise-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {whipCounterpoise
          ? '4 horizontal ¼λ radials fan out from the base, giving the source a proper low-loss return path (canonical ground-plane vertical).'
          : 'No counterpoise. NEC will report the high reactance and poor SWR that a radial-less base-fed antenna actually exhibits — switch the toggle on to model a proper ground-plane antenna.'}
      </div>
    </>
  );
}
