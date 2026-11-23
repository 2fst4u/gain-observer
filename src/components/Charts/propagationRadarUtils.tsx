import type { JSX } from "react";
import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";
import { HALF_POWER_DB } from "../../physics/propagation";

export const KM_PER_MILE = 1.609344;
export const DEG_TO_RAD = Math.PI / 180;

export function formatDistance(km: number, units: UnitSystem): string {
  if (units === "imperial") {
    const mi = km / KM_PER_MILE;
    return `${mi.toFixed(0)} mi`;
  }
  return `${km.toFixed(0)} km`;
}

type AzimuthalHop = NonNullable<PropagationPrediction["azimuthalHops"]>[number];
export type BeamEdge = "far" | "near";

/** True when the outlines trace the half-power beam rather than peak rays. */
export function hasHalfPowerBeam(az: readonly AzimuthalHop[]): boolean {
  return az.some((point) => point.halfPowerRangeKm !== undefined);
}

/**
 * Ground arc drawn for one bearing and hop count. With half-power data, the
 * outline follows the beam's lowest (far) or highest (near) ray, so a broad
 * high-angle beam reads as reaching every bearing instead of collapsing to
 * whichever single ray is a fraction of a dB stronger. A bearing with no
 * half-power ray sits at the centre. Without that data, the peak ray is used.
 */
export function beamRangeKm(
  point: AzimuthalHop,
  ringN: number,
  useBeam: boolean,
  edge: BeamEdge = "far",
): number {
  if (!useBeam) return point.rangeKm[ringN - 1] ?? 0;
  const span = point.halfPowerRangeKm;
  if (!span) return 0;
  return (edge === "far" ? span.farKm : span.nearKm) * ringN;
}

/**
 * Where to put an outline's hop-count label: the outline's farthest point.
 * An outline that is not a circle has no single radius, so its label names
 * only the hop count; the grid circles carry the distance scale.
 */
export function ringLabelAnchor(
  az: readonly AzimuthalHop[],
  ringN: number,
): { bearingDeg: number; rangeKm: number } | undefined {
  if (az.length === 0) return undefined;
  const useBeam = hasHalfPowerBeam(az);
  let best = az[0]!;
  let bestKm = beamRangeKm(best, ringN, useBeam);
  for (const point of az) {
    const km = beamRangeKm(point, ringN, useBeam);
    if (km > bestKm) { best = point; bestKm = km; }
  }
  return { bearingDeg: best.bearingDeg, rangeKm: bestKm };
}

/** Grid-circle spacing: a 1, 2, 2.5 or 5 × 10ⁿ step in the display unit,
 * giving three to five circles inside the plotted range. */
export function niceGridStep(maxRange: number): number {
  if (!(maxRange > 0) || !Number.isFinite(maxRange)) return 0;
  const raw = maxRange / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw)!;
  return step * power;
}

export function calculateMaxRangeKm(prediction: PropagationPrediction): number {
  let maxRangeKm = prediction.hops[prediction.hops.length - 1]?.rangeKm ?? 1;
  const az = prediction.azimuthalHops;
  if (az) {
    const useBeam = hasHalfPowerBeam(az);
    const n = Math.max(prediction.hops.length, 1);
    for (let i = 0; i < az.length; i++) {
      const point = az[i]!;
      const lastRange = useBeam
        ? beamRangeKm(point, n, true, "far")
        : point.rangeKm[point.rangeKm.length - 1];
      if (lastRange && lastRange > maxRangeKm) {
        maxRangeKm = lastRange;
      }
    }
  }
  return maxRangeKm;
}

function describeBearing(point: AzimuthalHop, ringN: number, edge: BeamEdge, useBeam: boolean): string {
  const gain = point.realizedGainDbi !== undefined
    ? `, realized antenna gain ${point.realizedGainDbi.toFixed(2)} dBi` : "";
  if (!useBeam) {
    return `Bearing ${point.bearingDeg.toFixed(0)}°, elevation ${point.takeoffElevationDeg.toFixed(1)}°${gain}. Ideal arc only.`;
  }
  const span = point.halfPowerElevationDeg;
  if (!span) {
    return `Bearing ${point.bearingDeg.toFixed(0)}°: no ray within ${HALF_POWER_DB} dB of peak. Strongest lobe ${point.takeoffElevationDeg.toFixed(1)}°${gain}.`;
  }
  const hops = ringN === 1 ? "1 hop" : `${ringN} hops`;
  const edgeText = edge === "far"
    ? `farthest ${hops} at ${span.lowDeg.toFixed(1)}°`
    : `nearest 1 hop at ${span.highDeg.toFixed(1)}°`;
  return `Bearing ${point.bearingDeg.toFixed(0)}°, half-power beam ${span.lowDeg.toFixed(1)}–${span.highDeg.toFixed(1)}° elevation, ${edgeText}. Strongest lobe ${point.takeoffElevationDeg.toFixed(1)}°${gain}. Ideal arc only.`;
}

export function buildAzimuthalSegments(
  az: NonNullable<PropagationPrediction["azimuthalHops"]>,
  ringN: number,
  cx: number,
  cy: number,
  kmToPx: number,
  edge: BeamEdge = "far",
): JSX.Element[] {
  const len = az.length;
  if (len === 0) return [];
  const segments = new Array<JSX.Element>(len);

  const useBeam = hasHalfPowerBeam(az);
  let aPoint = az[0]!;
  const rA = beamRangeKm(aPoint, ringN, useBeam, edge) * kmToPx;
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
      const rB = beamRangeKm(bPoint, ringN, useBeam, edge) * kmToPx;
      const bRad = (((bPoint.bearingDeg % 360) + 360) % 360) * DEG_TO_RAD;
      bx = cx + rB * Math.sin(bRad);
      by = cy - rB * Math.cos(bRad);
    }

    segments[i] = (
      <line
        key={`${edge}-${ringN}-${i}`}
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="var(--accent)"
        strokeOpacity={0.75}
        strokeWidth={edge === "far" ? 1.5 : 1}
        strokeDasharray={edge === "near" ? "3 3" : undefined}
      >
        <title>{describeBearing(aPoint, ringN, edge, useBeam)}</title>
      </line>
    );

    aPoint = bPoint;
    ax = bx;
    ay = by;
  }
  return segments;
}
