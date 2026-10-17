import { NumericInput } from '../../UI/NumericInput';
import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { type OrientationPreset } from '../../../store/antennaGeometry';

export function OrientationControl() {
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

  const isVerticalWhip = antennaType === 'vertical-whip';
  const isInvertedL = antennaType === 'inverted-l';

  if (isVerticalWhip) return null; // No orientation for a vertical monopole

  return (
    <>
      <label htmlFor={isInvertedL ? "inverted-l-orientation" : "dipole-orientation"} style={{ marginTop: 10 }}>
        {isInvertedL ? "Horizontal section direction (°)" : "Orientation (°)"}
      </label>
      <div className="row">
        <NumericInput
          id={isInvertedL ? "inverted-l-orientation" : "dipole-orientation"}
          min={0}
          max={359}
          step={1}
          value={currentDegrees}
          onChange={setOrientation}
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
