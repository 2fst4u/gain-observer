import { FEEDLINE_PRESETS, type FeedlinePreset } from '../../../physics/constants';

interface FeedlinePresetSelectProps {
  feedlineId: string;
  preset: FeedlinePreset;
  onSelectFeedline: (id: string) => void;
}

export function FeedlinePresetSelect({
  feedlineId,
  preset,
  onSelectFeedline,
}: FeedlinePresetSelectProps) {
  return (
    <>
      <h2>
        <label htmlFor="feedline-preset">Feedline</label>
      </h2>
      <select
        id="feedline-preset"
        value={feedlineId}
        onChange={(e) => onSelectFeedline(e.target.value)}
        aria-describedby="feedline-hint"
      >
        {FEEDLINE_PRESETS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <div
        id="feedline-hint"
        aria-live="polite"
        style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}
      >
        {preset.hint}
      </div>
    </>
  );
}
