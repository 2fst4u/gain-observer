import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';

export function CounterpoiseControl() {
  const { antennaType, whipCounterpoise, designFrequency, setWhipCounterpoise } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    whipCounterpoise: s.whipCounterpoise,
    designFrequency: s.designFrequency ?? s.frequency,
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
          ? `4 horizontal radials are designed at ${designFrequency?.toFixed(2) ?? '—'} MHz. Their physical lengths stay fixed while tuning; changing the antenna design length redesigns them.`
          : 'No counterpoise is modelled. A real base-fed installation needs an explicitly modelled return conductor or ground system for reliable impedance predictions.'}
      </div>
    </>
  );
}
