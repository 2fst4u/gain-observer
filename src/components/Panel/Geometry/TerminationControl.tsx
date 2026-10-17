import { NumericInput } from '../../UI/NumericInput';
import { useAntennaStore, recommendedTerminatingResistor, type AntennaType } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { FOLDED_DIPOLE_FEED_R_OHMS } from '../../../physics/constants';

function calculateTfdZ0(aperture: number, radius: number): number {
  return Math.round(120 * Math.acosh(aperture / (2 * radius)));
}

function getTerminationHint(antennaType: AntennaType, terminatingResistor: number, tfdZ0: number): string {
  if (terminatingResistor === 0) {
    if (antennaType === 'folded-dipole') {
      return 'Unterminated: a classic folded dipole — ~300 Ω feedpoint, narrowband, same gain and pattern as a plain dipole. Add a resistor for a broadband terminated folded dipole (T2FD); the recommended 300 Ω costs 3 dB, the least you can pay for broadband behaviour. Use the Match button in the Transformer section below to apply the suggested ratio.';
    }
    return 'Unterminated: travelling wave reflects, creating a standing-wave pattern. Use this mode to check whether the antenna structure resonates at the design frequency.';
  }

  if (antennaType === 'sloping-v') {
    return `${terminatingResistor} Ω resistors at each tip (to ground). Click Off to remove termination and inspect resonance. Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`;
  }

  if (antennaType === 'folded-dipole') {
    const lossDb = (10 * Math.log10(1 + terminatingResistor / FOLDED_DIPOLE_FEED_R_OHMS)).toFixed(1);
    return `${terminatingResistor} Ω resistor at the centre of the conductor opposite the feed. It sits at that conductor's current maximum, so it lands at the feedpoint almost 1:1 — raw feedpoint ≈ ${terminatingResistor + FOLDED_DIPOLE_FEED_R_OHMS} Ω — and costs about ${lossDb} dB of gain (10·log10(1 + R/${FOLDED_DIPOLE_FEED_R_OHMS})). The pattern shape is unchanged; watch Directivity hold still while Gain drops. Use the Match button in the Transformer section below to apply the optimal ratio (the transformer is never changed automatically). Raising R toward the two-wire line's Z₀ (≈ ${tfdZ0} Ω here) flattens SWR further at a steep price in gain; lowering it keeps gain but narrows the usable range. Click Off to restore the plain folded dipole.`;
  }

  return `${terminatingResistor} Ω resistor on a short bridge wire spanning the gap at the centre of the base (not to ground). Click Off to remove termination and inspect resonance. Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`;
}

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
