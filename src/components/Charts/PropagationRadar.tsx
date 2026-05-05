// Top-down "radar" plot of estimated propagation range.
//
// The antenna sits at the centre and three concentric rings show the
// great-circle ground range covered by 1, 2, and 3 sky-wave hops at the
// current take-off angle. Ring colour reflects open / marginal / closed
// status from src/physics/propagation.ts.
//
// We deliberately use raw SVG (no Chart.js radar plugin) because:
//   - the chart is genuinely circular concentric rings, which is awkward
//     to express with Chart.js polar-area scales;
//   - SVG is easy to make theme-responsive (CSS variables work directly);
//   - it keeps the bundle small.

import type { PropagationPrediction } from '../../physics/propagation';
import type { UnitSystem } from '../../physics/units';

interface PropagationRadarProps {
  readonly prediction: PropagationPrediction;
  readonly units: UnitSystem;
  /** Pixel size (square). */
  readonly size?: number;
}

const KM_PER_MILE = 1.609344;

function formatDistance(km: number, units: UnitSystem): string {
  if (units === 'imperial') {
    const mi = km / KM_PER_MILE;
    return `${mi.toFixed(0)} mi`;
  }
  return `${km.toFixed(0)} km`;
}

function statusFill(status: 'open' | 'marginal' | 'closed'): string {
  // Use semantic CSS variables already defined in theme.css so the rings
  // pick up theme overrides without hard-coding hex values here.
  if (status === 'open') return 'var(--success)';
  if (status === 'marginal') return 'var(--warning)';
  return 'var(--danger)';
}

function qualityOpacity(quality: 'useful' | 'weak' | 'unusable'): number {
  if (quality === 'useful') return 0.16;
  if (quality === 'weak') return 0.08;
  return 0.035;
}

function worseStatus(a: 'open' | 'marginal' | 'closed', b: 'open' | 'marginal' | 'closed'): 'open' | 'marginal' | 'closed' {
  const rank = { open: 2, marginal: 1, closed: 0 } as const;
  return rank[a] <= rank[b] ? a : b;
}

function worseQuality(a: 'useful' | 'weak' | 'unusable', b: 'useful' | 'weak' | 'unusable'): 'useful' | 'weak' | 'unusable' {
  const rank = { useful: 2, weak: 1, unusable: 0 } as const;
  return rank[a] <= rank[b] ? a : b;
}

export function PropagationRadar({
  prediction,
  units,
  size = 280,
}: PropagationRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  // Leave a margin for axis labels.
  const margin = 24;

  // Find overall maximum range to scale the radar.
  let maxRangeKm = prediction.hops[prediction.hops.length - 1]?.rangeKm ?? 1;
  if (prediction.azimuthalHops) {
    for (const az of prediction.azimuthalHops) {
      const lastRange = az.rangeKm[az.rangeKm.length - 1];
      if (lastRange && lastRange > maxRangeKm) {
        maxRangeKm = lastRange;
      }
    }
  }

  const maxRadiusPx = (size / 2) - margin;
  const kmToPx = maxRadiusPx / Math.max(1, maxRangeKm);

  // Compass cardinal label positions.
  const cardinals = [
    { label: 'N', x: cx, y: margin - 6, anchor: 'middle' as const },
    { label: 'S', x: cx, y: size - margin + 14, anchor: 'middle' as const },
    { label: 'E', x: size - margin + 8, y: cy + 4, anchor: 'start' as const },
    { label: 'W', x: margin - 8, y: cy + 4, anchor: 'end' as const },
  ];

  // Convert hop ranges to pixel radii.
  const rings = prediction.hops.map((h) => ({
    n: h.n,
    rangeKm: h.rangeKm,
    rPx: h.rangeKm * kmToPx,
    status: h.status,
    linkQuality: h.linkQuality,
  }));


  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="Propagation range radar plot"
        style={{ display: 'block', maxWidth: '100%' }}
      >
        {/* Background disc */}
        <circle cx={cx} cy={cy} r={maxRadiusPx} fill="var(--bg-raised)" stroke="var(--border)" />

        {/* Faint inner gridlines at 25/50/75% of max range */}
        {[0.25, 0.5, 0.75].map((f) => (
          <circle
            key={f}
            cx={cx}
            cy={cy}
            r={maxRadiusPx * f}
            fill="none"
            stroke="var(--border)"
            strokeDasharray="2 3"
            opacity={0.5}
          />
        ))}

        {/* Cross-hair axes */}
        <line x1={cx} y1={margin} x2={cx} y2={size - margin} stroke="var(--border)" opacity={0.5} />
        <line x1={margin} y1={cy} x2={size - margin} y2={cy} stroke="var(--border)" opacity={0.5} />

        {/* Hop rings: rendered from outermost to innermost so labels stay readable.
            If azimuthalHops are available, the ring is a sequence of per-azimuth
            wedges so the colour reflects each bearing's own status / link
            quality, not a single global "best-bearing" colour. */}
        {rings.slice().reverse().map((ring) => {
          if (prediction.azimuthalHops && prediction.azimuthalHops.length > 1) {
            const az = prediction.azimuthalHops;
            const wedges = az.map((aPoint, i) => {
              const bPoint = az[(i + 1) % az.length]!;
              const rA = (aPoint.rangeKm[ring.n - 1] ?? 0) * kmToPx;
              const rB = (bPoint.rangeKm[ring.n - 1] ?? 0) * kmToPx;
              const aRad = ((aPoint.phiDeg % 360) + 360) % 360 * Math.PI / 180;
              const bRad = ((bPoint.phiDeg % 360) + 360) % 360 * Math.PI / 180;
              const ax = cx + rA * Math.sin(aRad);
              const ay = cy - rA * Math.cos(aRad);
              const bx = cx + rB * Math.sin(bRad);
              const by = cy - rB * Math.cos(bRad);
              // Colour the wedge by the worse status / quality of its two
              // bounding radials, so a closed bearing visually pulls the
              // wedge into "closed" rather than borrowing colour from a
              // neighbouring open bearing.
              const status = worseStatus(aPoint.status, bPoint.status);
              const linkQuality = worseQuality(aPoint.linkQuality, bPoint.linkQuality);
              return (
                <polygon
                  key={`${ring.n}-${i}`}
                  points={`${cx},${cy} ${ax},${ay} ${bx},${by}`}
                  fill={statusFill(status)}
                  fillOpacity={qualityOpacity(linkQuality)}
                  stroke={statusFill(status)}
                  strokeOpacity={linkQuality === 'unusable' ? 0.25 : 0.6}
                  strokeWidth={1}
                  strokeDasharray={linkQuality === 'unusable' ? '4 3' : undefined}
                />
              );
            });
            return <g key={ring.n}>{wedges}</g>;
          }

          return (
            <circle
              key={ring.n}
              cx={cx}
              cy={cy}
              r={ring.rPx}
              fill={statusFill(ring.status)}
              fillOpacity={qualityOpacity(ring.linkQuality)}
              stroke={statusFill(ring.status)}
              strokeOpacity={ring.linkQuality === 'unusable' ? 0.35 : 0.85}
              strokeWidth={2}
              strokeDasharray={ring.linkQuality === 'unusable' ? '4 3' : undefined}
            />
          );
        })}


        {/* Centre dot = antenna location */}
        <circle cx={cx} cy={cy} r={4} fill="var(--accent)" />

        {/* Cardinal direction labels */}
        {cardinals.map((c) => (
          <text
            key={c.label}
            x={c.x}
            y={c.y}
            textAnchor={c.anchor}
            fontSize={11}
            fill="var(--text-muted)"
            fontFamily="system-ui, sans-serif"
          >
            {c.label}
          </text>
        ))}

        {/* Range label on each hop ring (placed along the +y axis but offset
            to the right to avoid the 'N' cardinal and prevent overlap) */}
        {rings.map((ring) => (
          <text
            key={ring.n}
            x={cx + 24}
            y={cy - ring.rPx - 4}
            fontSize={10}
            fill="var(--text-dim)"
            fontFamily="system-ui, sans-serif"
            textAnchor="start"
          >
            {`${ring.n}× ${formatDistance(ring.rangeKm, units)}`}
          </text>
        ))}
      </svg>

      {/* Inline legend */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <LegendSwatch color="var(--success)" label="Open" />
        <LegendSwatch color="var(--warning)" label="Marginal" />
        <LegendSwatch color="var(--danger)" label="Closed" />
        <span>Faint/dashed = weak signal</span>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          opacity: 0.85,
        }}
      />
      {label}
    </span>
  );
}
