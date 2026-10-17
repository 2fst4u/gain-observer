import { useAntennaStore, legMultipleFromLength } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';

export function TravelingWaveLegControl() {
  const { antennaType, length, frequency, setLegLengthMultiple } = useAntennaStore(
    useShallow((s) => ({
      antennaType: s.antennaType,
      length: s.length,
      frequency: s.frequency,
      setLegLengthMultiple: s.setLegLengthMultiple,
    }))
  );

  if (antennaType !== 'sloping-v') {
    return null;
  }

  const currentLegMultiple = legMultipleFromLength(length, frequency);
  const lambda = 299.792458 / frequency;

  return (
    <div className="button-group" role="group" aria-label="Leg length in wavelengths">
      {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((n) => (
        <button
          key={n}
          className={currentLegMultiple === n ? 'active' : ''}
          onClick={() => setLegLengthMultiple(n)}
          title={`Set each leg to ${n}λ — ${(n * 2 * lambda).toFixed(1)} m total`}
          aria-pressed={currentLegMultiple === n}
        >
          {n}λ
        </button>
      ))}
    </div>
  );
}
