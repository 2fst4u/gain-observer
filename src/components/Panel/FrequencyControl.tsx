import { useAntennaStore } from '../../store/antennaStore';
import { HF_BAND_PRESETS, halfWaveLength } from '../../physics/constants';

export function FrequencyControl() {
  const frequency = useAntennaStore((s) => s.frequency);
  const setFrequency = useAntennaStore((s) => s.setFrequency);
  const setLength = useAntennaStore((s) => s.setLength);

  return (
    <div className="panel-section">
      <h3>Frequency <span className="badge">{frequency.toFixed(3)} MHz</span></h3>
      <div className="row">
        <input
          type="number"
          min={1.8}
          max={30}
          step={0.01}
          value={frequency}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) setFrequency(val);
          }}
        />
      </div>
      <div style={{ marginTop: 8 }} className="button-group">
        {HF_BAND_PRESETS.map((b) => (
          <button
            key={b.name}
            className={Math.abs(b.mhz - frequency) < 0.05 ? 'active' : ''}
            onClick={() => {
              setFrequency(b.mhz);
              // Auto-re-resonate length to new ½λ.
              setLength(halfWaveLength(b.mhz));
            }}
            title={`${b.mhz.toFixed(3)} MHz`}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
