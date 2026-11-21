import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import type { DeltaFeed } from '../../../store/antennaGeometry';

const OPTIONS: { value: DeltaFeed; label: string; hint: string }[] = [
  {
    value: 'apex',
    label: 'Apex',
    hint: 'Fed at the top. Mainly horizontal polarisation; at low heights most energy goes up (NVIS / short range). Feedpoint well above 50 Ω.',
  },
  {
    value: 'corner',
    label: 'Lower corner',
    hint: 'Fed at the bottom of one sloping side. The sloping sides radiate vertical polarisation at low angles in nearly all directions — better for long range from a low support. Resonates near a 1.03λ perimeter (the 1λ button sets this). Feedpoint about 80 Ω for a low, flattened loop (SWR ≈ 1.7 on 50 Ω coax), rising to 120–180 Ω as the triangle approaches equilateral.',
  },
];

/** Feedpoint choice for the (unterminated) delta loop. */
export function DeltaFeedControl() {
  const { antennaType, deltaFeed, setDeltaFeed } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    deltaFeed: s.deltaFeed,
    setDeltaFeed: s.setDeltaFeed,
  })));
  if (antennaType !== 'delta-loop') return null;
  const current = OPTIONS.find((o) => o.value === deltaFeed) ?? OPTIONS[0]!;
  return (
    <>
      <label style={{ marginTop: 10 }} id="delta-feed-label">Feedpoint</label>
      <div className="button-group" role="group" aria-labelledby="delta-feed-label">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            className={deltaFeed === o.value ? 'active' : ''}
            aria-pressed={deltaFeed === o.value}
            onClick={() => setDeltaFeed(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div aria-live="polite" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {current.hint}
      </div>
    </>
  );
}
