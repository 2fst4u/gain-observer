import type { JSX } from "react";
import type { PropagationPrediction } from "../../physics/propagation";
import { COVERAGE_BINS } from "../../physics/coverage";
import type { UnitSystem } from "../../physics/units";
import {
  buildAzimuthalSegments,
  formatDistance,
  hasHalfPowerBeam,
  hopStyle,
  ringSectorPath,
  STRENGTH_BANDS,
  strengthBand,
  KM_PER_MILE,
  niceGridStep,
  ringLabelAnchor,
} from "./propagationRadarUtils";

const LABEL_HALO = {
  stroke: "var(--bg-raised)",
  strokeWidth: 3,
  paintOrder: "stroke" as const,
};

export function RadarGrid({
  cx,
  cy,
  size,
  maxRadiusPx,
  margin,
  maxRangeKm,
  units = "metric",
}: {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly maxRadiusPx: number;
  readonly margin: number;
  /** Range at the rim. With it, grid circles sit at round distances and are
   * labelled; without it, they are unlabelled quarters of the rim. */
  readonly maxRangeKm?: number;
  readonly units?: UnitSystem;
}) {
  const unitKm = units === "imperial" ? KM_PER_MILE : 1;
  const maxRange = maxRangeKm !== undefined ? maxRangeKm / unitKm : undefined;
  const step = maxRange !== undefined ? niceGridStep(maxRange) : 0;
  const scale: { r: number; label?: string }[] = [];
  if (maxRange !== undefined && step > 0) {
    for (let k = 1; k * step < maxRange * 0.95; k++) {
      scale.push({
        r: (k * step / maxRange) * maxRadiusPx,
        label: formatDistance(k * step * unitKm, units),
      });
    }
  } else {
    for (const f of [0.25, 0.5, 0.75]) scale.push({ r: maxRadiusPx * f });
  }
  // Scale labels run down the SE diagonal, clear of the cardinal labels.
  const diag = Math.SQRT1_2;
  return (
    <>
      {/* Background disc */}
      <circle
        cx={cx}
        cy={cy}
        r={maxRadiusPx}
        fill="var(--bg-raised)"
        stroke="var(--border)"
      />

      {/* Faint inner gridlines at 25/50/75% of max range */}
      {scale.map(({ r }) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeDasharray="2 3"
          opacity={0.5}
        />
      ))}

      {/* Cross-hair axes */}
      <line
        x1={cx}
        y1={margin}
        x2={cx}
        y2={size - margin}
        stroke="var(--border)"
        opacity={0.5}
      />
      <line
        x1={margin}
        y1={cy}
        x2={size - margin}
        y2={cy}
        stroke="var(--border)"
        opacity={0.5}
      />
      {scale.map(({ r, label }) => label && (
        <text
          key={`scale-${r}`}
          x={cx + r * diag + 2}
          y={cy + r * diag + 10}
          fontSize={9}
          fill="var(--text-dim)"
          fontFamily="system-ui, sans-serif"
          {...LABEL_HALO}
        >
          {label}
        </text>
      ))}
    </>
  );
}

export function RadarLabels({
  cx,
  cy,
  size,
  margin,
  prediction,
  kmToPx,
  units,
}: {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly margin: number;
  readonly prediction: PropagationPrediction;
  readonly kmToPx: number;
  readonly units: UnitSystem;
}) {
  // Compass cardinal label positions.
  const cardinals = [
    { label: "N", x: cx, y: margin - 6, anchor: "middle" as const },
    { label: "S", x: cx, y: size - margin + 14, anchor: "middle" as const },
    { label: "E", x: size - margin + 8, y: cy + 4, anchor: "start" as const },
    { label: "W", x: margin - 8, y: cy + 4, anchor: "end" as const },
  ];

  return (
    <>
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
      {prediction.hops.map((ring) => {
        const az = prediction.azimuthalHops;
        if (az && az.length > 1) {
          // Not a circle: name the hop count at the outline's farthest point.
          const anchor = ringLabelAnchor(az, ring.n);
          if (!anchor || anchor.rangeKm * kmToPx < 1) return null;
          // Just inside the outline, so the rim's cardinal labels stay clear.
          const rad = anchor.bearingDeg * Math.PI / 180;
          const r = Math.max(0, anchor.rangeKm * kmToPx - 9);
          return (
            <text
              key={ring.n}
              x={cx + r * Math.sin(rad) + 3}
              y={cy - r * Math.cos(rad) + 4}
              fontSize={10}
              fontWeight={600}
              fill={hopStyle(ring.n).stroke}
              fontFamily="system-ui, sans-serif"
              textAnchor="start"
              {...LABEL_HALO}
            >
              {`${ring.n}×`}
            </text>
          );
        }
        if (ring.rangeKm === undefined) return null;
        return (
          <text
            key={ring.n}
            x={cx + 24}
            y={cy - ring.rangeKm * kmToPx - 4}
            fontSize={10}
            fill="var(--text-dim)"
            fontFamily="system-ui, sans-serif"
            textAnchor="start"
          >
            {`${ring.n}× ${formatDistance(ring.rangeKm, units)}`}
          </text>
        );
      })}
    </>
  );
}

export function RadarHopRings({
  prediction,
  cx,
  cy,
  kmToPx,
}: {
  readonly prediction: PropagationPrediction;
  readonly cx: number;
  readonly cy: number;
  readonly kmToPx: number;
}) {
  const hopRings = [];
  for (let k = prediction.hops.length - 1; k >= 0; k--) {
    const ring = prediction.hops[k]!;
    if (prediction.azimuthalHops && prediction.azimuthalHops.length > 1) {
      const segments = buildAzimuthalSegments(
        prediction.azimuthalHops,
        ring.n,
        cx,
        cy,
        kmToPx,
      );
      hopRings.push(<g key={ring.n}>{segments}</g>);
      // The half-power beam's near edge, where its highest ray lands. It sits
      // at the centre when the beam includes the zenith (NVIS), so is drawn
      // only when the beam leaves a gap close in.
      if (ring.n === 1 && hasHalfPowerBeam(prediction.azimuthalHops) &&
        prediction.azimuthalHops.some((point) => (point.halfPowerRangeKm?.nearKm ?? 0) * kmToPx >= 1)) {
        hopRings.push(
          <g key="near">
            {buildAzimuthalSegments(prediction.azimuthalHops, 1, cx, cy, kmToPx, "near")}
          </g>,
        );
      }
    } else if (ring.rangeKm !== undefined) {
      hopRings.push(
        <circle
          key={ring.n}
          cx={cx}
          cy={cy}
          r={ring.rangeKm * kmToPx}
          fill="none"
          stroke={hopStyle(ring.n).stroke}
          strokeOpacity={hopStyle(ring.n).opacity}
          strokeWidth={hopStyle(ring.n).width}
        />,
      );
    }
  }
  return <>{hopRings}</>;
}

/**
 * Shaded relative power density. Adjacent range bins of one bearing in the
 * same band are merged into one ring sector, so the SVG stays small.
 */
export function RadarCoverage({
  prediction,
  cx,
  cy,
  kmToPx,
  units,
}: {
  readonly prediction: PropagationPrediction;
  readonly cx: number;
  readonly cy: number;
  readonly kmToPx: number;
  readonly units: UnitSystem;
}) {
  const map = prediction.coverage;
  if (!map) return null;
  // Sectors overlap slightly to hide anti-aliasing seams. Each band is one
  // group with the opacity on the group, so overlaps composite once and do
  // not show as darker lines.
  const half = map.sectorWidthDeg / 2 + 0.35;
  const seamPx = 0.6;
  const byBand: JSX.Element[][] = STRENGTH_BANDS.map(() => []);
  map.bearingsDeg.forEach((bearing, si) => {
    let bin = 0;
    while (bin < COVERAGE_BINS) {
      const band = strengthBand(map.relativeDb[si * COVERAGE_BINS + bin]!);
      let end = bin + 1;
      while (end < COVERAGE_BINS && strengthBand(map.relativeDb[si * COVERAGE_BINS + end]!) === band) end++;
      if (band >= 0) {
        let strongest = -Infinity;
        for (let b = bin; b < end; b++) strongest = Math.max(strongest, map.relativeDb[si * COVERAGE_BINS + b]!);
        byBand[band]!.push(
          <path
            key={`${si}-${bin}`}
            d={ringSectorPath(cx, cy, Math.max(0, bin * map.binKm * kmToPx - seamPx), end * map.binKm * kmToPx, bearing - half, bearing + half)}
          >
            <title>{`Bearing ${bearing.toFixed(0)}°, ${formatDistance(bin * map.binKm, units)}–${formatDistance(end * map.binKm, units)}: up to ${strongest.toFixed(1)} dB relative to the strongest point`}</title>
          </path>,
        );
      }
      bin = end;
    }
  });
  return (
    <g>
      {/* Weakest first so stronger bands draw over their seams. */}
      {STRENGTH_BANDS.map((style, band) => ({ style, band })).reverse().map(({ style, band }) => (
        <g key={band} fill={style.fill} opacity={style.opacity} stroke="none">{byBand[band]}</g>
      ))}
    </g>
  );
}

export function RadarLegend() {
  return (
    <figcaption style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
      <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {STRENGTH_BANDS.map((band) => (
          <span key={band.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width={12} height={10} aria-hidden="true">
              <rect width={12} height={10} rx={2} fill={band.fill} fillOpacity={band.opacity} />
            </svg>
            {band.label}
          </span>
        ))}
      </span>
      <br />
      Relative signal strength on the ground: dB below the strongest point, all rays over 1–3 hops. Lines mark the half-power beam's reach (1×, 2×, 3×). D-layer absorption is not included · no absolute signal level
    </figcaption>
  );
}
