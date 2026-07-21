import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import {
  FEEDLINE_PRESETS,
  feedlineLossDb,
  findFeedlinePreset,
} from '../../physics/constants';
import { displayLengthUnit } from '../../physics/units';
import type { AntennaType } from '../../physics/types';
import { StatRow } from '../UI/StatRow';
import { SyncedLengthInput } from './Feedline/SyncedLengthInput';
import { DipoleOffsetControl } from './Feedline/DipoleOffsetControl';
import { AtuSection } from './Feedline/AtuSection';

// vertical-whip is intentionally excluded — this panel does not apply to it
const SUPPORTED_ANTENNA_TYPES: ReadonlySet<AntennaType> = new Set([
  'dipole',
  'inverted-v',
  'delta-loop',
  'sloping-v',
  'terminated-delta',
  'folded-dipole',
]);


export function FeedlineControl() {
  // ⚡ Bolt: Performance Optimization
  // Grouped multiple individual Zustand store selector subscriptions into a single useShallow block.
  // This reduces React hook allocation overhead and minimizes the number of store listeners,
  // noticeably improving rendering performance when global state properties change rapidly.
  const {
    units,
    antennaType,
    frequency,
    length: dipoleLength,
    feedlineId,
    feedlineLength,
    feedlineOffset,
    atuEnabled,
    atuMainFeedlineLength,
    setFeedline,
    setFeedlineLength,
    setFeedlineOffset,
    setAtuEnabled,
    setAtuMainFeedlineLength,
  } = useAntennaStore(useShallow((s) => ({
    units: s.units,
    antennaType: s.antennaType,
    frequency: s.frequency,
    length: s.length,
    feedlineId: s.feedlineId,
    feedlineLength: s.feedlineLength,
    feedlineOffset: s.feedlineOffset,
    atuEnabled: s.atuEnabled,
    atuMainFeedlineLength: s.atuMainFeedlineLength,
    setFeedline: s.setFeedline,
    setFeedlineLength: s.setFeedlineLength,
    setFeedlineOffset: s.setFeedlineOffset,
    setAtuEnabled: s.setAtuEnabled,
    setAtuMainFeedlineLength: s.setAtuMainFeedlineLength,
  })));

  const preset = findFeedlinePreset(feedlineId);
  const enabled = preset.id !== 'none';
  const unit = displayLengthUnit(units);

  if (!SUPPORTED_ANTENNA_TYPES.has(antennaType)) return null;

  const lossDb = enabled ? feedlineLossDb(preset, frequency, feedlineLength) : 0;

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2><label htmlFor="feedline-preset">Feedline</label></h2>
      <select
        id="feedline-preset"
        value={feedlineId}
        onChange={(e) => setFeedline(e.target.value)}
        aria-describedby="feedline-hint"
      >
        {FEEDLINE_PRESETS.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>
      <div id="feedline-hint" aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
        {preset.hint}
      </div>

      {enabled && (
        <>
          <SyncedLengthInput
            id="feedline-length"
            label={`Length (${unit})`}
            value={feedlineLength}
            units={units}
            maxMetric={200}
            maxImperial={656}
            onChange={setFeedlineLength}
          />

          {antennaType === 'dipole' && (
            <DipoleOffsetControl
              units={units}
              unit={unit}
              dipoleLength={dipoleLength}
              feedlineOffset={feedlineOffset}
              setFeedlineOffset={setFeedlineOffset}
            />
          )}

          <StatRow
            style={{ marginTop: 10 }}
            label="Z₀ / VF"
            value={`${preset.z0.toFixed(0)} Ω · ${preset.velocityFactor.toFixed(2)}`}
          />
          <StatRow
            label={`Cable loss @ ${frequency.toFixed(2)} MHz`}
            value={`${lossDb.toFixed(2)} dB`}
          />

          <AtuSection
            units={units}
            unit={unit}
            frequency={frequency}
            preset={preset}
            atuEnabled={atuEnabled}
            atuMainFeedlineLength={atuMainFeedlineLength}
            setAtuEnabled={setAtuEnabled}
            setAtuMainFeedlineLength={setAtuMainFeedlineLength}
          />
        </>
      )}
    </section>
  );
}
