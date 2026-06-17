import { useState } from 'react';
import { useAntennaStore } from '../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
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
import type { AntennaType } from '../../physics/types';
import { StatRow } from '../UI/StatRow';

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
  const dispLen = toDisplayLength(feedlineLength, units);
  const dispOffset = toDisplayLength(feedlineOffset, units);

  const [localLen, setLocalLen] = useState(dispLen.toFixed(2));
  const [isFocused, setIsFocused] = useState(false);

  const [prevDispLen, setPrevDispLen] = useState(dispLen);
  if (dispLen !== prevDispLen) {
    setPrevDispLen(dispLen);
    if (!isFocused) {
      setLocalLen(dispLen.toFixed(2));
    }
  }

  if (!SUPPORTED_ANTENNA_TYPES.has(antennaType)) return null;

  const offsetLimit = Math.max(0, dipoleLength / 2 - 0.05);
  const dispOffsetLimit = toDisplayLength(offsetLimit, units);
  const lossDb = enabled ? feedlineLossDb(preset, frequency, feedlineLength) : 0;
  const mainRunLossDb = enabled ? feedlineLossDb(preset, frequency, atuMainFeedlineLength) : 0;

  return (
    <section className="panel-section">
      {/* SEO: Use sequential heading tags (H2) to follow document outline initiated by H1 */}
      <h2>Feedline</h2>
      <label htmlFor="feedline-preset">Cable</label>
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
          <label htmlFor="feedline-length" style={{ marginTop: 10 }}>
            Length ({unit})
          </label>
          <input
            id="feedline-length"
            type="number"
            min={0}
            max={units === 'metric' ? 200 : 656}
            step={units === 'metric' ? 0.5 : 1}
            value={localLen}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              const s = e.target.value;
              setLocalLen(s);
              const val = parseFloat(s);
              if (!isNaN(val)) {
                setFeedlineLength(fromDisplayLength(val, units));
              }
            }}
            onBlur={() => {
              setIsFocused(false);
              setLocalLen(dispLen.toFixed(2));
            }}
          />

          {antennaType === 'dipole' && (
            <FeedlineOffsetControl
              units={units}
              unit={unit}
              dispOffset={dispOffset}
              dispOffsetLimit={dispOffsetLimit}
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

          <AtuControl
            units={units}
            unit={unit}
            atuEnabled={atuEnabled}
            setAtuEnabled={setAtuEnabled}
            atuMainFeedlineLength={atuMainFeedlineLength}
            setAtuMainFeedlineLength={setAtuMainFeedlineLength}
            mainRunLossDb={mainRunLossDb}
          />
        </>
      )}
    </section>
  );
}

interface FeedlineOffsetControlProps {
  units: 'metric' | 'imperial';
  unit: string;
  dispOffset: number;
  dispOffsetLimit: number;
  feedlineOffset: number;
  setFeedlineOffset: (offset: number) => void;
}

function FeedlineOffsetControl({
  units,
  unit,
  dispOffset,
  dispOffsetLimit,
  feedlineOffset,
  setFeedlineOffset,
}: FeedlineOffsetControlProps) {
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
          aria-describedby="feedline-offset-hint"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) setFeedlineOffset(fromDisplayLength(val, units));
          }}
        />
        <button
          onClick={() => setFeedlineOffset(0)}
          disabled={Math.abs(feedlineOffset) < 1e-6}
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

interface AtuControlProps {
  units: 'metric' | 'imperial';
  unit: string;
  atuEnabled: boolean;
  setAtuEnabled: (enabled: boolean) => void;
  atuMainFeedlineLength: number;
  setAtuMainFeedlineLength: (length: number) => void;
  mainRunLossDb: number;
}

function AtuControl({
  units,
  unit,
  atuEnabled,
  setAtuEnabled,
  atuMainFeedlineLength,
  setAtuMainFeedlineLength,
  mainRunLossDb,
}: AtuControlProps) {
  const dispMainLen = toDisplayLength(atuMainFeedlineLength, units);
  const [localMainLen, setLocalMainLen] = useState(dispMainLen.toFixed(2));
  const [mainFocused, setMainFocused] = useState(false);
  const [prevDispMainLen, setPrevDispMainLen] = useState(dispMainLen);

  if (dispMainLen !== prevDispMainLen) {
    setPrevDispMainLen(dispMainLen);
    if (!mainFocused) {
      setLocalMainLen(dispMainLen.toFixed(2));
    }
  }

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
          <label htmlFor="atu-main-length" style={{ marginTop: 10 }}>
            Main run, ATU → shack ({unit})
          </label>
          <input
            id="atu-main-length"
            type="number"
            min={0}
            max={units === 'metric' ? 300 : 984}
            step={units === 'metric' ? 0.5 : 1}
            value={localMainLen}
            aria-describedby="atu-hint"
            onFocus={() => setMainFocused(true)}
            onChange={(e) => {
              const s = e.target.value;
              setLocalMainLen(s);
              const val = parseFloat(s);
              if (!isNaN(val)) setAtuMainFeedlineLength(fromDisplayLength(val, units));
            }}
            onBlur={() => {
              setMainFocused(false);
              setLocalMainLen(dispMainLen.toFixed(2));
            }}
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
