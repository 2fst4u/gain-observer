import { GeometryStatus } from './GeometryStatus';
import { useState } from 'react';
import { useAntennaStore, legMultipleFromLength, recommendedTerminatingResistor } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';
import { type AntennaType } from '../../store/antennaStore';
import { type OrientationPreset } from '../../store/antennaGeometry';
import { FOLDED_DIPOLE_MAX_APERTURE_M, FOLDED_DIPOLE_FEED_R_OHMS } from '../../physics/constants';
import { TransformerControl } from './TransformerControl';

const resonateTitles: Record<AntennaType, string> = {
  'dipole': 'Half-wave resonant length: ~73 Ω feedpoint — close to a direct 50 Ω coax match with no ATU needed. ~2.15 dBi gain. The most practical starting point for most installations.',
  'inverted-v': 'Set length to resonant ½λ',
  'delta-loop': 'Set perimeter to resonant 1λ',
  'sloping-v': 'Set total length to 2λ (1λ per leg)',
  'terminated-delta': 'Set perimeter to 1λ',
  'vertical-whip': 'Set whip length to resonant ¼λ',
  'inverted-l': 'Set total wire length (vertical + horizontal) to resonant ¼λ. The horizontal section makes up any length the mast height falls short of a full quarter-wave.',
  'folded-dipole': 'Set each conductor to a resonant ½λ. Raw feedpoint ~300 Ω (~4× a plain dipole). A 9:1 impedance-transforming balun is enabled by default — a compromise that lands both the plain and the terminated antenna under 1.7:1, since terminating adds the resistor in series with the feedpoint. Same gain and pattern as a plain dipole when unterminated. For a broadband T2FD, add the recommended 300 Ω terminating resistor and apply the suggested transformer ratio.',
};

function calculateTfdZ0(aperture: number, radius: number): number {
  return Math.round(120 * Math.acosh(aperture / (2 * radius)));
}

function LengthControl() {
  const {
    units,
    antennaType,
    length,
    frequency,
    setLength,
    setHalfWaveLength,
  } = useAntennaStore(
    useShallow((s) => ({
      units: s.units,
      antennaType: s.antennaType,
      length: s.length,
      frequency: s.frequency,
      setLength: s.setLength,
      setHalfWaveLength: s.setHalfWaveLength,
    }))
  );

  const unit = displayLengthUnit(units);
  const dispLen = toDisplayLength(length, units);

  const [localLen, setLocalLen] = useState(dispLen.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  const [prevDispLen, setPrevDispLen] = useState(dispLen);
  if (dispLen !== prevDispLen) {
    setPrevDispLen(dispLen);
    if (!isFocused) {
      setLocalLen(dispLen.toFixed(2));
    }
  }

  const lambda = 299.792458 / frequency;

  const resonateLabels: Record<AntennaType, string> = {
    'dipole': '½λ',
    'inverted-v': '½λ',
    'delta-loop': '1λ',
    'sloping-v': '1λ/leg',
    'terminated-delta': '1λ',
    'vertical-whip': '¼λ',
    'inverted-l': '¼λ',
    'folded-dipole': '½λ',
  };

  const isVerticalWhip = antennaType === 'vertical-whip';
  const isInvertedL = antennaType === 'inverted-l';
  const isFoldedDipole = antennaType === 'folded-dipole';

  const lengthLabel = isVerticalWhip
    ? `Whip length (${unit})`
    : isInvertedL
      ? `Total wire length — vertical + horizontal (${unit})`
      : isFoldedDipole
        ? `Conductor length — ½λ each (${unit})`
        : `Length (${unit})`;

  return (
    <>
      <label htmlFor="dipole-length" style={{ marginTop: 10 }}>{lengthLabel}</label>
      <div className="row">
        <input
          id="dipole-length"
          type="number"
          min={0.1}
          step={0.1}
          value={localLen}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalLen(s);
            const val = parseFloat(s);
            if (isNaN(val)) return;
            setLength(fromDisplayLength(val, units));
          }}
          onBlur={() => {
            setIsFocused(false);
            setLocalLen(dispLen.toFixed(2));
          }}
        />
        {antennaType !== 'sloping-v' && (
          <button
            onClick={setHalfWaveLength}
            title={resonateTitles[antennaType]}
            aria-label={`${resonateLabels[antennaType]} (Resonate antenna length)`}
          >
            {resonateLabels[antennaType]}
          </button>
        )}
        {antennaType === 'dipole' && (
          <button
            onClick={() => setLength(lambda * 1.25)}
            title="Extended Double Zepp length: 3–4 dB more gain than ½λ by using a longer wire aperture — narrower broadside lobes. Trade-off: feedpoint rises to ~1000 Ω, requiring a wide-range ATU or open-wire feedline. Very low heights can push the impedance toward zero, making matching harder."
            aria-label="1.25λ Extended Double Zepp preset length"
          >
            1.25λ
          </button>
        )}
      </div>
    </>
  );
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

  return `${terminatingResistor} Ω resistors at each inner half-base end (to ground via short stubs). Click Off to remove termination and inspect resonance. Affects gain, directivity, front/back ratio, feedpoint impedance, realized gain, and termination loss. Lower SWR alone does not indicate the best design point.`;
}

function TravelingWaveLegControl() {
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

function TerminationControl() {
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

  const [localResistor, setLocalResistor] = useState(terminatingResistor.toString());
  const [isResistorFocused, setIsResistorFocused] = useState(false);

  const [prevResistor, setPrevResistor] = useState(terminatingResistor);
  if (terminatingResistor !== prevResistor) {
    setPrevResistor(terminatingResistor);
    if (!isResistorFocused) {
      setLocalResistor(terminatingResistor.toString());
    }
  }

  if (antennaType !== 'sloping-v' && antennaType !== 'terminated-delta' && antennaType !== 'folded-dipole') {
    return null;
  }

  // Characteristic impedance of the two-wire line formed by the folded-dipole
  // conductors. Z₀ = 120 × acosh(D / (2r)), D = spacing (aperture), r = wire
  // radius. Quoted in the hint as the maximum-flatness option; it is no longer
  // the recommended value, because that line is the non-radiating
  // transmission-line mode and damping it costs far more gain than it is worth.
  const tfdZ0 = antennaType === 'folded-dipole' ? calculateTfdZ0(foldedDipoleAperture, wireRadius) : 0;

  // Recommended ("auto") terminating resistance for this antenna. Every type that
  // supports a terminating resistor gets the auto-resistance button.
  const isFolded = antennaType === 'folded-dipole';
  const recommended = recommendedTerminatingResistor(antennaType);

  return (
    <>
      <label htmlFor="terminating-resistor" style={{ marginTop: 10 }}>
        Termination resistance (Ω)
      </label>
      <div className="row">
        <input
          id="terminating-resistor"
          type="number"
          min={0}
          step={10}
          value={localResistor}
          aria-describedby="terminating-resistor-hint"
          onFocus={() => setIsResistorFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalResistor(s);
            const val = parseFloat(s);
            if (isNaN(val)) return;
            setTerminatingResistor(val);
          }}
          onBlur={() => {
            setIsResistorFocused(false);
            setLocalResistor(terminatingResistor.toString());
          }}
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

function OrientationControl() {
  const { antennaType, orientation, setOrientation } = useAntennaStore(
    useShallow((s) => ({
      antennaType: s.antennaType,
      orientation: s.orientation,
      setOrientation: s.setOrientation,
    }))
  );

  const orientations: OrientationPreset[] = ['NS', 'EW', 'NE-SW', 'NW-SE'];
  const PRESET_DEGREES: Record<OrientationPreset, number> = {
    'NS': 0,
    'EW': 90,
    'NE-SW': 45,
    'NW-SE': 315,
  };

  const currentDegrees = typeof orientation === 'number' ? orientation : PRESET_DEGREES[orientation];

  const [localOrient, setLocalOrient] = useState(currentDegrees.toString());
  const [isOrientFocused, setIsOrientFocused] = useState(false);

  const [prevOrient, setPrevOrient] = useState(orientation);
  if (orientation !== prevOrient) {
    setPrevOrient(orientation);
    if (!isOrientFocused) {
      setLocalOrient(currentDegrees.toString());
    }
  }

  const isVerticalWhip = antennaType === 'vertical-whip';
  const isInvertedL = antennaType === 'inverted-l';


  if (isVerticalWhip) return null; // No orientation for a vertical monopole

  return (
    <>
      <label htmlFor={isInvertedL ? "inverted-l-orientation" : "dipole-orientation"} style={{ marginTop: 10 }}>
        {isInvertedL ? "Horizontal section direction (°)" : "Orientation (°)"}
      </label>
      <div className="row">
        <input
          id={isInvertedL ? "inverted-l-orientation" : "dipole-orientation"}
          type="number"
          min={0}
          max={359}
          step={1}
          value={localOrient}
          onFocus={() => setIsOrientFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalOrient(s);
            const val = parseFloat(s);
            if (isNaN(val)) return;
            setOrientation(val);
          }}
          onBlur={() => {
            setIsOrientFocused(false);
            setLocalOrient(currentDegrees.toString());
          }}
        />
      </div>

      <div className="button-group" role="group" aria-label={isInvertedL ? "Horizontal section direction presets" : "Orientation presets"}>
        {orientations.map((o) => (
          <button
            key={o}
            className={orientation === o ? 'active' : ''}
            onClick={() => setOrientation(o)}
            aria-pressed={orientation === o}
          >
            {o}
          </button>
        ))}
      </div>
    </>
  );
}

function TypeControl() {
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

function HeightControl() {
  const { units, antennaType, height, setHeight } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    antennaType: s.antennaType,
    height: s.height,
    setHeight: s.setHeight,
  })));

  const unit = displayLengthUnit(units);
  const dispHeight = toDisplayLength(height, units);
  const maxHeight = units === 'metric' ? 40 : 131;

  const isVerticalWhip = antennaType === 'vertical-whip';
  const isInvertedL = antennaType === 'inverted-l';
  const isFoldedDipole = antennaType === 'folded-dipole';

  const heightLabel = isVerticalWhip
    ? `Base height above ground (${unit}) — ${dispHeight.toFixed(1)}`
    : isInvertedL
      ? `Mast / bend-point height (${unit}) — ${dispHeight.toFixed(1)}`
      : isFoldedDipole
        ? `Bottom conductor height / feedpoint (${unit}) — ${dispHeight.toFixed(1)}`
        : `Height above ground (${unit}) — ${dispHeight.toFixed(1)}`;

  return (
    <>
      <label htmlFor="dipole-height" style={{ marginTop: 10 }}>{heightLabel}</label>
      <input
        id="dipole-height"
        type="range"
        min={0}
        max={maxHeight}
        step={units === 'metric' ? 0.5 : 1}
        value={dispHeight}
        aria-label={isVerticalWhip ? 'Base height above ground' : isInvertedL ? 'Mast / bend-point height' : isFoldedDipole ? 'Bottom conductor height / feedpoint' : 'Height above ground'}
        aria-valuetext={`${dispHeight.toFixed(1)} ${unit}`}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val)) return;
          setHeight(fromDisplayLength(val, units));
        }}
      />
    </>
  );
}

function VAngleControl() {
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

function ApertureControl() {
  const { units, antennaType, foldedDipoleAperture, wireRadius, setFoldedDipoleAperture } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    antennaType: s.antennaType,
    foldedDipoleAperture: s.foldedDipoleAperture,
    wireRadius: s.wireRadius,
    setFoldedDipoleAperture: s.setFoldedDipoleAperture,
  })));

  if (antennaType !== 'folded-dipole') {
    return null;
  }

  const unit = displayLengthUnit(units);
  const dispAperture = toDisplayLength(foldedDipoleAperture, units);
  const minApertureDisp = toDisplayLength(0.02, units);
  const maxApertureDisp = toDisplayLength(FOLDED_DIPOLE_MAX_APERTURE_M, units);
  const tfdZ0 = calculateTfdZ0(foldedDipoleAperture, wireRadius);

  return (
    <>
      <label htmlFor="folded-dipole-aperture" style={{ marginTop: 10 }}>
        Conductor spacing / aperture ({unit}) — {dispAperture.toFixed(2)}
      </label>
      <input
        id="folded-dipole-aperture"
        type="range"
        min={minApertureDisp}
        max={maxApertureDisp}
        step={units === 'metric' ? 0.01 : 0.05}
        value={dispAperture}
        aria-label="Folded dipole conductor spacing"
        aria-valuetext={`${dispAperture.toFixed(2)} ${unit}`}
        aria-describedby="folded-dipole-aperture-hint"
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val)) return;
          setFoldedDipoleAperture(fromDisplayLength(val, units));
        }}
      />
      <div id="folded-dipole-aperture-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Vertical spacing between the bottom (fed) and top (un-fed) conductors. The fed conductor is at the antenna height; the top conductor is aperture above it. For equal-diameter wires the feedpoint stays ~4× a plain dipole (~300 Ω) regardless of spacing; wider spacing raises Z₀ of the two-wire line (currently Z₀ ≈ {tfdZ0} Ω), requiring a higher terminating resistor for a broadband T2FD match. Capped at {maxApertureDisp.toFixed(2)} {unit} — beyond a realistic folded-dipole spacing the structure morphs toward a loop and no longer solves reliably as two close parallel wires.
      </div>
    </>
  );
}

function CounterpoiseControl() {
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
