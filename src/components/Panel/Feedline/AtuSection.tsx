import { SyncedLengthInput } from './SyncedLengthInput';

export interface AtuSectionProps {
  units: 'metric' | 'imperial';
  unit: string;
  mainRunLossDb: number;
  atuEnabled: boolean;
  atuMainFeedlineLength: number;
  setAtuEnabled: (val: boolean) => void;
  setAtuMainFeedlineLength: (val: number) => void;
}

export function AtuSection({
  units,
  unit,
  mainRunLossDb,
  atuEnabled,
  atuMainFeedlineLength,
  setAtuEnabled,
  setAtuMainFeedlineLength,
}: AtuSectionProps) {
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <label
        htmlFor="atu-enable"
        style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0, margin: 0, fontSize: 12 }}
      >
        <input
          id="atu-enable"
          type="checkbox"
          checked={atuEnabled}
          onChange={(e) => setAtuEnabled(e.target.checked)}
        />
        ATU at the base of the mast
      </label>

      {atuEnabled && (
        <>
          <SyncedLengthInput
            id="atu-main-length"
            label={`Main run, ATU → shack (${unit})`}
            value={atuMainFeedlineLength}
            units={units}
            maxMetric={300}
            maxImperial={984}
            onChange={setAtuMainFeedlineLength}
            ariaDescribedBy="atu-hint"
          />
          <div id="atu-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            The feedline above becomes the short up-mast run (carries the antenna's native SWR);
            the tuner conjugate-matches at the base, so this main run to the shack stays ~1:1
            (matched loss {mainRunLossDb.toFixed(2)} dB). Realized gain keeps the up-mast loss
            under SWR, this main-run loss, and a Q-based tuner loss — but a tuner cannot recover
            ohmic/termination (efficiency) loss.
          </div>
        </>
      )}
    </div>
  );
}
