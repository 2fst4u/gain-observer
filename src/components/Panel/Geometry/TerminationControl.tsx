import { NumericInput } from '../../UI/NumericInput';
import { useAntennaStore, recommendedTerminatingResistor } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { calculateTfdZ0, getTerminationHint } from './geometryUtils';

export function TerminationControl() {
  const {
    antennaType,
    terminatingResistor,
    setTerminatingResistor,
    foldedDipoleAperture,
    wireRadius,
  } = useAntennaStore(
    useShallow((s) => ({
      antennaType: s.antennaType,
      terminatingResistor: s.terminatingResistor,
      setTerminatingResistor: s.setTerminatingResistor,
      foldedDipoleAperture: s.antennaType === 'folded-dipole' ? s.foldedDipoleAperture : 0,
      wireRadius: s.antennaType === 'folded-dipole' ? s.wireRadius : 0,
    }))
  );

  if (antennaType !== 'sloping-v' && antennaType !== 'terminated-delta' && antennaType !== 'folded-dipole') {
    return null;
  }

  const tfdZ0 = antennaType === 'folded-dipole' ? calculateTfdZ0(foldedDipoleAperture, wireRadius) : 0;
  const isFolded = antennaType === 'folded-dipole';
  const recommended = recommendedTerminatingResistor(antennaType);

  return (
    <>
      <label htmlFor="terminating-resistor" style={{ marginTop: 10 }}>
        Termination resistance (Ω)
      </label>
      <div className="row">
        <NumericInput
          id="terminating-resistor"
          min={0}
          step={10}
          value={terminatingResistor}
          aria-describedby="terminating-resistor-hint"
          onChange={setTerminatingResistor}
        />
        {recommended > 0 && (
          <button
            onClick={() => { if (terminatingResistor !== recommended) setTerminatingResistor(recommended); }}
            aria-disabled={terminatingResistor === recommended}
            title={terminatingResistor === recommended
              ? `Already using the recommended ${recommended} Ω termination`
              : isFolded
                ? `Set terminating resistor to ${recommended} Ω — the folded dipole's own feedpoint resistance, so the resistor takes half the power: −3 dB, the least you can pay for broadband behaviour. Raising it flattens SWR further but the loss grows as 10·log10(1 + R/${recommended}) dB.`
                : `Set terminating resistor to the recommended ${recommended} Ω for this antenna — approximately the structure's characteristic impedance over real ground, giving a flat broadband match.`}
            aria-label={`Set terminating resistor to recommended (${recommended} Ω)`}
            style={{ flex: '0 0 auto' }}
          >
            {`${recommended} Ω`}
          </button>
        )}
        <button
          onClick={() => { if (terminatingResistor !== 0) setTerminatingResistor(0); }}
          aria-disabled={terminatingResistor === 0}
          title={terminatingResistor === 0 ? 'Termination is already off' : 'Remove termination (unterminated antenna)'}
          aria-label="Turn off termination resistor"
          style={{ flex: '0 0 auto' }}
        >
          Off
        </button>
      </div>
      <div id="terminating-resistor-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {getTerminationHint(antennaType, terminatingResistor, tfdZ0)}
      </div>
    </>
  );
}
