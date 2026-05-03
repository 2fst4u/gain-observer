import { useAntennaStore } from '../../store/antennaStore';
import { FEEDLINE_PRESETS } from '../../physics/constants';
import {
  toDisplayLength,
  fromDisplayLength,
  displayLengthUnit,
} from '../../physics/units';

export function FeedlineControl() {
  const feedlineId = useAntennaStore((s) => s.feedlineId);
  const feedlineLength = useAntennaStore((s) => s.feedlineLength);
  const setFeedline = useAntennaStore((s) => s.setFeedline);
  const setFeedlineLength = useAntennaStore((s) => s.setFeedlineLength);
  const units = useAntennaStore((s) => s.units);

  const unit = displayLengthUnit(units);
  const dispLen = toDisplayLength(feedlineLength, units);
  const hasFeedline = feedlineId !== 'custom';

  return (
    <div className="panel-section">
      <h3>Feedline</h3>
      <select value={feedlineId} onChange={(e) => setFeedline(e.target.value)}>
        {FEEDLINE_PRESETS.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      {hasFeedline && (
        <>
          <label htmlFor="feedline-length" style={{ marginTop: 10 }}>Length ({unit})</label>
          <input
            id="feedline-length"
            type="number"
            min={0}
            step={1}
            value={dispLen}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setFeedlineLength(fromDisplayLength(val, units));
            }}
          />
        </>
      )}
    </div>
  );
}
