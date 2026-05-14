import { useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { HF_BAND_PRESETS } from '../../physics/constants';

export function FrequencyControl() {
  const frequency = useAntennaStore((s) => s.frequency);
  const setFrequency = useAntennaStore((s) => s.setFrequency);
  const setHalfWaveLength = useAntennaStore((s) => s.setHalfWaveLength);

  // Use local string state to allow natural typing (trailing dots/zeros)
  // without immediate snapping from the store's clamp logic.
  const [localVal, setLocalVal] = useState(frequency.toFixed(3));
  const [isFocused, setIsFocused] = useState(false);

  // Sync local state when the store value changes (e.g. via preset buttons),
  // but ONLY if the user isn't currently typing in the field.
  const [prevFrequency, setPrevFrequency] = useState(frequency);
  if (frequency !== prevFrequency) {
    setPrevFrequency(frequency);
    if (!isFocused) {
      setLocalVal(frequency.toFixed(3));
    }
  }

  return (
    <div className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Frequency <span className="badge">{frequency.toFixed(3)} MHz</span></h2>
      <div className="row">
        <input
          type="number"
          min={1.8}
          max={30}
          step={0.01}
          value={localVal}
          aria-label="Frequency in MHz"
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            const s = e.target.value;
            setLocalVal(s);
            const val = parseFloat(s);
            if (!isNaN(val)) {
              setFrequency(val);
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            // On blur, ensure the local value matches the (possibly clamped) store value.
            setLocalVal(frequency.toFixed(3));
          }}
        />
      </div>
      <div style={{ marginTop: 8 }} className="button-group" role="group" aria-label="Amateur Radio Bands">
        {HF_BAND_PRESETS.map((b) => (
          <button
            key={b.name}
            className={Math.abs(b.mhz - frequency) < 0.05 ? 'active' : ''}
            onClick={() => {
              setFrequency(b.mhz);
              // Auto-re-resonate length to new reference length.
              setHalfWaveLength();
            }}
            title={`${b.mhz.toFixed(3)} MHz`}
            aria-pressed={Math.abs(b.mhz - frequency) < 0.05}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
