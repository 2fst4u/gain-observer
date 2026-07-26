import {
  toDisplayLength,
  fromDisplayLength,
} from '../../../physics/units';

export interface DipoleOffsetControlProps {
  units: 'metric' | 'imperial';
  unit: string;
  dipoleLength: number;
  feedlineOffset: number;
  setFeedlineOffset: (val: number) => void;
}

export function DipoleOffsetControl({
  units,
  unit,
  dipoleLength,
  feedlineOffset,
  setFeedlineOffset,
}: DipoleOffsetControlProps) {
  const dispOffset = toDisplayLength(feedlineOffset, units);
  const offsetLimit = Math.max(0, dipoleLength / 2 - 0.05);
  const dispOffsetLimit = toDisplayLength(offsetLimit, units);

  return (
    <>
      <label htmlFor="feedline-offset" style={{ marginTop: 10 }}>
        Attachment offset from centre ({unit}) — {dispOffset.toFixed(2)}
      </label>
      <div className="row">
        <input
          id="feedline-offset"
          type="range"
          min={-dispOffsetLimit}
          max={dispOffsetLimit}
          step={units === 'metric' ? 0.05 : 0.25}
          value={dispOffset}
          aria-label="Feedline attachment offset"
          aria-valuetext={`${dispOffset.toFixed(2)} ${unit}`}
          aria-describedby="feedline-offset-hint"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (isNaN(val)) return;
            setFeedlineOffset(fromDisplayLength(val, units));
          }}
        />
        <button
          onClick={() => { if (Math.abs(feedlineOffset) >= 1e-6) setFeedlineOffset(0); }}
          aria-disabled={Math.abs(feedlineOffset) < 1e-6}
          title={Math.abs(feedlineOffset) < 1e-6 ? 'Feedpoint is already centred' : 'Centre feedpoint'}
          aria-label="Centre feedpoint offset"
          style={{ flex: '0 0 auto' }}
        >
          Centre
        </button>
      </div>
      <div id="feedline-offset-hint" aria-live="polite" style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
        {Math.abs(feedlineOffset) < 1e-6
          ? 'Centred (perfectly balanced — no common-mode current).'
          : `Shifted ${Math.abs(dispOffset).toFixed(2)} ${unit} ${feedlineOffset > 0 ? '+ axis' : '− axis'}; common-mode current will flow on the shield.`}
      </div>
    </>
  );
}
