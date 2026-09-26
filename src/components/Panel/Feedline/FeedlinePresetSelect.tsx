import { FEEDLINE_PRESETS } from '../../../physics/constants';

interface FeedlinePresetSelectProps {
  feedlineId: string;
  presetHint: string;
  onChangeFeedline: (id: string) => void;
}

export function FeedlinePresetSelect({
  feedlineId,
  presetHint,
  onChangeFeedline,
}: FeedlinePresetSelectProps) {
  return (
    <>
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2><label htmlFor="feedline-preset">Feedline</label></h2>
      <select
        id="feedline-preset"
        value={feedlineId}
        onChange={(e) => onChangeFeedline(e.target.value)}
        aria-describedby="feedline-hint"
      >
        {FEEDLINE_PRESETS.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>
      <div id="feedline-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        {presetHint}
      </div>
    </>
  );
}
