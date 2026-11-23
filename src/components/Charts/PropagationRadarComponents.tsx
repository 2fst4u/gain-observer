import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";
import {
  buildAzimuthalSegments,
  formatDistance,
  hasHalfPowerBeam,
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
              fill="var(--text-dim)"
              fontFamily="system-ui, sans-serif"
              textAnchor="start"
              {...LABEL_HALO}
            >
              {`${ring.n}×`}
            </text>
          );
        }
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
    } else {
      hopRings.push(
        <circle
          key={ring.n}
          cx={cx}
          cy={cy}
          r={ring.rangeKm * kmToPx}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.75}
          strokeWidth={2}
        />,
      );
    }
  }
  return <>{hopRings}</>;
}

export function RadarLegend() {
  return <figcaption style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ideal ground arcs of the half-power beam · no coverage or signal forecast</figcaption>;
}
