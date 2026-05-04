import { useAntennaStore } from '../../store/antennaStore';
import {
  FEEDLINE_PRESETS,
  feedlineLossDb,
  findFeedlinePreset,
} from '../../physics/constants';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';

export function FeedlineControl() {
  const units = useAntennaStore((s) => s.units);
  const frequency = useAntennaStore((s) => s.frequency);
  const dipoleLength = useAntennaStore((s) => s.length);
  const feedlineId = useAntennaStore((s) => s.feedlineId);
  const feedlineLength = useAntennaStore((s) => s.feedlineLength);
  const feedlineOffset = useAntennaStore((s) => s.feedlineOffset);
  const balunEnabled = useAntennaStore((s) => s.balunEnabled);
  const setFeedline = useAntennaStore((s) => s.setFeedline);
  const setFeedlineLength = useAntennaStore((s) => s.setFeedlineLength);
  const setFeedlineOffset = useAntennaStore((s) => s.setFeedlineOffset);
  const setBalunEnabled = useAntennaStore((s) => s.setBalunEnabled);

  const preset = findFeedlinePreset(feedlineId);
  const enabled = preset.id !== 'none';
  const unit = displayLengthUnit(units);
  const dispLen = toDisplayLength(feedlineLength, units);
  const dispOffset = toDisplayLength(feedlineOffset, units);
  const offsetLimit = Math.max(0, dipoleLength / 2 - 0.05);
  const dispOffsetLimit = toDisplayLength(offsetLimit, units);
  const lossDb = enabled ? feedlineLossDb(preset, frequency, feedlineLength) : 0;

  return (
    <div className="panel-section">
      <h3>Feedline</h3>
      <label htmlFor="feedline-preset">Cable</label>
      <select
        id="feedline-preset"
        value={feedlineId}
        onChange={(e) => setFeedline(e.target.value)}
      >
        {FEEDLINE_PRESETS.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        {preset.hint}
      </div>

      {enabled && (
        <>
          <label htmlFor="feedline-length" style={{ marginTop: 10 }}>
            Length ({unit})
          </label>
          <input
            id="feedline-length"
            type="number"
            min={0}
            max={units === 'metric' ? 200 : 656}
            step={units === 'metric' ? 0.5 : 1}
            value={dispLen.toFixed(2)}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setFeedlineLength(fromDisplayLength(val, units));
            }}
          />

          <label htmlFor="feedline-offset" style={{ marginTop: 10 }}>
            Attachment offset from centre ({unit}) — {dispOffset.toFixed(2)}
          </label>
          <input
            id="feedline-offset"
            type="range"
            min={-dispOffsetLimit}
            max={dispOffsetLimit}
            step={units === 'metric' ? 0.05 : 0.25}
            value={dispOffset}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setFeedlineOffset(fromDisplayLength(val, units));
            }}
          />
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            {Math.abs(feedlineOffset) < 1e-6
              ? 'Centred (perfectly balanced — no common-mode current).'
              : `Shifted ${Math.abs(dispOffset).toFixed(2)} ${unit} ${feedlineOffset > 0 ? '+ axis' : '− axis'}; common-mode current will flow on the shield.`}
          </div>

          <label
            htmlFor="balun-toggle"
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <input
              id="balun-toggle"
              type="checkbox"
              checked={balunEnabled}
              onChange={(e) => setBalunEnabled(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <span>1:1 current (choke) balun at feedpoint</span>
          </label>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            {balunEnabled
              ? 'Suppresses common-mode current on shield (~2 kΩ choke).'
              : 'Unchoked: shield can radiate. Pattern may distort.'}
          </div>

          <div className="stat" style={{ marginTop: 10 }}>
            <span className="stat-label">Z₀ / VF</span>
            <span className="stat-value">{preset.z0.toFixed(0)} Ω · {preset.velocityFactor.toFixed(2)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Cable loss @ {frequency.toFixed(2)} MHz</span>
            <span className="stat-value">{lossDb.toFixed(2)} dB</span>
          </div>
        </>
      )}
    </div>
  );
}
