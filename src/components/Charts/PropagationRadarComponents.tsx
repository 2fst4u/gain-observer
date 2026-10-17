import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";
import {
  buildAzimuthalWedges,
  formatDistance,
  qualityOpacity,
  statusFill,
} from "./propagationRadarUtils";

export function RadarGrid({
  cx,
  cy,
  size,
  maxRadiusPx,
  margin,
}: {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
  readonly maxRadiusPx: number;
  readonly margin: number;
}) {
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
      {prediction.hops.map((ring) => (
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
      ))}
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
      const wedges = buildAzimuthalWedges(
        prediction.azimuthalHops,
        ring.n,
        cx,
        cy,
        kmToPx,
      );
      hopRings.push(<g key={ring.n}>{wedges}</g>);
    } else {
      hopRings.push(
        <circle
          key={ring.n}
          cx={cx}
          cy={cy}
          r={ring.rangeKm * kmToPx}
          fill={statusFill(ring.status)}
          fillOpacity={qualityOpacity(ring.linkQuality)}
          stroke={statusFill(ring.status)}
          strokeOpacity={ring.linkQuality === "unusable" ? 0.35 : 0.85}
          strokeWidth={2}
          strokeDasharray={ring.linkQuality === "unusable" ? "4 3" : undefined}
        />,
      );
    }
  }
  return <>{hopRings}</>;
}

export function LegendSwatch({
  color,
  label,
}: {
  readonly color: string;
  readonly label: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          opacity: 0.85,
        }}
      />
      {label}
    </span>
  );
}

export function RadarLegend() {
  return (
    <figcaption
      style={{
        display: "flex",
        gap: 12,
        fontSize: 11,
        color: "var(--text-muted)",
      }}
    >
      <LegendSwatch color="var(--success)" label="Open" />
      <LegendSwatch color="var(--warning)" label="Marginal" />
      <LegendSwatch color="var(--danger)" label="Closed" />
      <span>Faint/dashed = weak signal</span>
    </figcaption>
  );
}
