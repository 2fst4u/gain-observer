import type { FeedlinePreset } from '../../../physics/constants';
import { StatRow } from '../../UI/StatRow';

interface FeedlineStatsProps {
  preset: FeedlinePreset;
  frequency: number;
  lossDb: number;
}

export function FeedlineStats({ preset, frequency, lossDb }: FeedlineStatsProps) {
  return (
    <>
      <StatRow
        style={{ marginTop: 10 }}
        label="Z₀ / VF"
        value={`${preset.z0.toFixed(0)} Ω · ${preset.velocityFactor.toFixed(2)}`}
      />
      <StatRow
        label={`Cable loss @ ${frequency.toFixed(2)} MHz`}
        value={`${lossDb.toFixed(2)} dB`}
      />
    </>
  );
}
