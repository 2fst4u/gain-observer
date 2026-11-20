import { useAntennaStore } from '../../../store/antennaStore';
import { useShallow } from 'zustand/react/shallow';
import { FEED_BRIDGE_LENGTH_M, yagiDimensions } from '../../../physics/constants';
import { toDisplayLength, displayLengthUnit } from '../../../physics/units';
import { StatRow } from '../../UI/StatRow';

const PRESET_HEADINGS: Record<string, number> = { NS: 0, EW: 90, 'NE-SW': 45, 'NW-SE': 315 };
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Cut and placement dimensions for building the wire Yagi: every length and
 * spacing the model uses, in the selected units. Derived from the driven
 * element length with the same ratios the solver uses (yagiDimensions).
 */
export function YagiBuildSheet() {
  const { antennaType, units, length, height, orientation } = useAntennaStore(useShallow((s) => ({
    antennaType: s.antennaType,
    units: s.units,
    length: s.length,
    height: s.height,
    orientation: s.orientation,
  })));
  if (antennaType !== 'yagi') return null;

  const d = yagiDimensions(length);
  const unit = displayLengthUnit(units);
  const fmt = (m: number) => `${toDisplayLength(m, units).toFixed(2)} ${unit}`;
  const heading = ((typeof orientation === 'number' ? orientation : PRESET_HEADINGS[orientation] ?? 0) % 360 + 360) % 360;
  const compass = COMPASS[Math.round(heading / 45) % 8];
  const gap = FEED_BRIDGE_LENGTH_M;

  return (
    <section id="yagi-build-sheet" aria-labelledby="yagi-build-heading" style={{ marginTop: 12 }}>
      <h3 id="yagi-build-heading" style={{ fontSize: 11, margin: '0 0 6px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Build dimensions
      </h3>
      <YagiDiagram />
      <StatRow label="Reflector (rear)" title="End to end, one unbroken wire. Not connected to anything." value={fmt(d.reflectorM)} />
      <StatRow label="Driven element" title="End to end, including the centre gap where the coax connects." value={fmt(d.drivenM)} />
      <StatRow label="… each half" title={`Two equal halves either side of a ${fmt(gap)} centre insulator; coax centre to one half, braid to the other, through the 1:1 choke.`} value={fmt((d.drivenM - gap) / 2)} />
      <StatRow label="Director (front)" title="End to end, one unbroken wire. Not connected to anything." value={fmt(d.directorM)} />
      <StatRow label="Reflector → driven" title="Centre-to-centre distance between the wires, measured along the beam heading." value={fmt(d.spacingM)} />
      <StatRow label="Driven → director" title="Centre-to-centre distance between the wires, measured along the beam heading." value={fmt(d.spacingM)} />
      <StatRow label="Reflector → director" title="Overall boom length." value={fmt(d.boomM)} />
      <StatRow label="Height (all elements)" title="All three wires level, parallel and at the same height, centred on one line along the beam heading." value={fmt(height)} />
      <StatRow label="Beam heading" title="The director is on this side; the reflector on the opposite side." value={`${heading.toFixed(0)}° (${compass})`} />
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Lengths are for bare wire, measured to where the wire meets each insulator.
        Insulation makes wire electrically longer (typically 2–4%), so these lengths
        are slightly long for insulated wire: trim the driven element to resonance in
        place, then shorten the reflector and director by the same percentage.
      </div>
    </section>
  );
}

/** Top view, not to scale: three parallel wires centred on the boom line. */
function YagiDiagram() {
  return (
    <svg viewBox="0 0 240 100" role="img" aria-label="Top view: reflector, driven element and director as three parallel wires, with the beam heading towards the director." style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto 6px', color: 'var(--text-muted)' }}>
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="40" y1="8" x2="40" y2="84" />
        <line x1="110" y1="12" x2="110" y2="42" />
        <line x1="110" y1="50" x2="110" y2="80" />
        <line x1="180" y1="15" x2="180" y2="77" />
      </g>
      <circle cx="110" cy="46" r="3" fill="var(--accent)" />
      <g stroke="currentColor" strokeWidth="1" strokeDasharray="3 3">
        <line x1="40" y1="46" x2="180" y2="46" />
      </g>
      <path d="M196 46 h28 m-7 -5 l7 5 l-7 5" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <g fill="currentColor" fontSize="9" textAnchor="middle">
        <text x="40" y="92">Reflector</text>
        <text x="110" y="92">Driven</text>
        <text x="180" y="92">Director</text>
        <text x="210" y="38">beam</text>
      </g>
    </svg>
  );
}
