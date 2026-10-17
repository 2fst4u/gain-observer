/* eslint-disable react-refresh/only-export-components */
import type { JSX } from "react";
import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";

export const KM_PER_MILE = 1.609344;
export const DEG_TO_RAD = Math.PI / 180;

export function formatDistance(km: number, units: UnitSystem): string {
  if (units === "imperial") {
    const mi = km / KM_PER_MILE;
    return `${mi.toFixed(0)} mi`;
  }
  return `${km.toFixed(0)} km`;
}

export function statusFill(status: "open" | "marginal" | "closed"): string {
  // Use semantic CSS variables already defined in theme.css so the rings
  // pick up theme overrides without hard-coding hex values here.
  if (status === "open") return "var(--success)";
  if (status === "marginal") return "var(--warning)";
  return "var(--danger)";
}

export function qualityOpacity(quality: "useful" | "weak" | "unusable"): number {
  if (quality === "useful") return 0.16;
  if (quality === "weak") return 0.08;
  return 0.035;
}

export function worseStatus(
  a: "open" | "marginal" | "closed",
  b: "open" | "marginal" | "closed",
): "open" | "marginal" | "closed" {
  if (a === "closed" || b === "closed") return "closed";
  if (a === "marginal" || b === "marginal") return "marginal";
  return "open";
}

export function worseQuality(
  a: "useful" | "weak" | "unusable",
  b: "useful" | "weak" | "unusable",
): "useful" | "weak" | "unusable" {
  if (a === "unusable" || b === "unusable") return "unusable";
  if (a === "weak" || b === "weak") return "weak";
  return "useful";
}

export function calculateMaxRangeKm(prediction: PropagationPrediction): number {
  let maxRangeKm = prediction.hops[prediction.hops.length - 1]?.rangeKm ?? 1;
  if (prediction.azimuthalHops) {
    const len = prediction.azimuthalHops.length;
    for (let i = 0; i < len; i++) {
      const az = prediction.azimuthalHops[i]!;
      const lastRange = az.rangeKm[az.rangeKm.length - 1];
      if (lastRange && lastRange > maxRangeKm) {
        maxRangeKm = lastRange;
      }
    }
  }
  return maxRangeKm;
}

export function buildAzimuthalWedges(
  az: NonNullable<PropagationPrediction["azimuthalHops"]>,
  ringN: number,
  cx: number,
  cy: number,
  kmToPx: number,
): JSX.Element[] {
  const len = az.length;
  if (len === 0) return [];
  const wedges = new Array<JSX.Element>(len);

  const ringIndex = ringN - 1;
  let aPoint = az[0]!;
  const rA = (aPoint.rangeKm[ringIndex] ?? 0) * kmToPx;
  // Screen angle is a compass bearing: 0° points up (North) and grows
  // clockwise, hence x = sin, y = −cos. The pattern's own NEC azimuth φ is a
  // different convention and must not be substituted here.
  const aRad = (((aPoint.bearingDeg % 360) + 360) % 360) * DEG_TO_RAD;
  let ax = cx + rA * Math.sin(aRad);
  let ay = cy - rA * Math.cos(aRad);

  const firstPoint = aPoint;
  const firstAx = ax;
  const firstAy = ay;

  for (let i = 0; i < len; i++) {
    const isLast = i === len - 1;
    let bPoint, bx, by;

    if (isLast) {
      bPoint = firstPoint;
      bx = firstAx;
      by = firstAy;
    } else {
      bPoint = az[i + 1]!;
      const rB = (bPoint.rangeKm[ringIndex] ?? 0) * kmToPx;
      const bRad = (((bPoint.bearingDeg % 360) + 360) % 360) * DEG_TO_RAD;
      bx = cx + rB * Math.sin(bRad);
      by = cy - rB * Math.cos(bRad);
    }

    // Colour the wedge by the worse status / quality of its two
    // bounding radials, so a closed bearing visually pulls the
    // wedge into "closed" rather than borrowing colour from a
    // neighbouring open bearing.
    const status = worseStatus(aPoint.status, bPoint.status);
    const linkQuality = worseQuality(aPoint.linkQuality, bPoint.linkQuality);
    wedges[i] = (
      <polygon
        key={`${ringN}-${i}`}
        points={`${cx},${cy} ${ax},${ay} ${bx},${by}`}
        fill={statusFill(status)}
        fillOpacity={qualityOpacity(linkQuality)}
        stroke={statusFill(status)}
        strokeOpacity={linkQuality === "unusable" ? 0.25 : 0.6}
        strokeWidth={1}
        strokeDasharray={linkQuality === "unusable" ? "4 3" : undefined}
      />
    );

    aPoint = bPoint;
    ax = bx;
    ay = by;
  }
  return wedges;
}

export function RadarGrid({
  cx,
  cy,
  size,
  maxRadiusPx,
  margin,
}: {
  cx: number;
  cy: number;
  size: number;
  maxRadiusPx: number;
  margin: number;
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
  cx: number;
  cy: number;
  size: number;
  margin: number;
  prediction: PropagationPrediction;
  kmToPx: number;
  units: UnitSystem;
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
  prediction: PropagationPrediction;
  cx: number;
  cy: number;
  kmToPx: number;
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

export function LegendSwatch({ color, label }: { color: string; label: string }) {
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
