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

export function buildAzimuthalSegments(
  az: NonNullable<PropagationPrediction["azimuthalHops"]>,
  ringN: number,
  cx: number,
  cy: number,
  kmToPx: number,
): JSX.Element[] {
  const len = az.length;
  if (len === 0) return [];
  const segments = new Array<JSX.Element>(len);

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

    segments[i] = (
      <line
        key={`${ringN}-${i}`}
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="var(--accent)"
        strokeOpacity={0.75}
        strokeWidth={1.5}
      >
        <title>{`Bearing ${aPoint.bearingDeg.toFixed(0)}°, elevation ${aPoint.takeoffElevationDeg.toFixed(1)}°${aPoint.realizedGainDbi !== undefined ? `, realized antenna gain ${aPoint.realizedGainDbi.toFixed(2)} dBi` : ''}. Ideal arc only.`}</title>
      </line>
    );

    aPoint = bPoint;
    ax = bx;
    ay = by;
  }
  return segments;
}
