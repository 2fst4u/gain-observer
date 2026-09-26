import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import {
  feedlineLossDb,
  findFeedlinePreset,
} from '../../physics/constants';
import { displayLengthUnit } from '../../physics/units';
import type { AntennaType } from '../../physics/types';
import { FeedlinePresetSelect } from './Feedline/FeedlinePresetSelect';
import { FeedlineStats } from './Feedline/FeedlineStats';
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
  const atuMainRunLossDb = enabled ? feedlineLossDb(preset, frequency, atuMainFeedlineLength) : 0;

  return (
    <section className="panel-section">
      <FeedlinePresetSelect
        feedlineId={feedlineId}
        presetHint={preset.hint}
        onChangeFeedline={setFeedline}
      />

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

          <FeedlineStats
            z0={preset.z0}
            velocityFactor={preset.velocityFactor}
            frequency={frequency}
            lossDb={lossDb}
          />

          <AtuSection
            units={units}
            unit={unit}
            mainRunLossDb={atuMainRunLossDb}
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
