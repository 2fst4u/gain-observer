import { StatRow } from '../../UI/StatRow';

interface FeedlineStatsProps {
  z0: number;
  velocityFactor: number;
  frequency: number;
  lossDb: number;
}

export function FeedlineStats({
  z0,
  velocityFactor,
  frequency,
  lossDb,
}: FeedlineStatsProps) {
  return (
    <>
      <StatRow
        style={{ marginTop: 10 }}
        label="Z₀ / VF"
        value={`${z0.toFixed(0)} Ω · ${velocityFactor.toFixed(2)}`}
      />
      <StatRow
        label={`Cable loss @ ${frequency.toFixed(2)} MHz`}
        value={`${lossDb.toFixed(2)} dB`}
      />
    </>
  );
}
