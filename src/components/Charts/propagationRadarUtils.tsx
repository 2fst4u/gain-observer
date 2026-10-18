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
