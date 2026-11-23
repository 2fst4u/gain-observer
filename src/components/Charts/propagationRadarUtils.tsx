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

/**
 * Outline style per hop count. Each extra hop adds a ground reflection and
 * another pass through the absorbing lower ionosphere over a longer path, so
 * later hops are weaker: green, amber, red, drawn progressively thinner and
 * fainter. This ranks the hops; it is not a computed signal level.
 */
export const HOP_STYLES: readonly { stroke: string; opacity: number; width: number }[] = [
  { stroke: "var(--success)", opacity: 0.95, width: 2.25 },
  { stroke: "var(--warning)", opacity: 0.8, width: 1.75 },
  { stroke: "var(--danger)", opacity: 0.65, width: 1.25 },
];

export function hopStyle(ringN: number) {
  return HOP_STYLES[Math.min(HOP_STYLES.length, Math.max(1, ringN)) - 1]!;
}
export type BeamEdge = "far" | "near";

/** True when the outlines trace the half-power beam rather than peak rays. */
export function hasHalfPowerBeam(az: readonly AzimuthalHop[]): boolean {
  return az.some((point) => point.halfPowerElevationDeg !== undefined);
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
  // Keep a readable scale when little or nothing returns.
  return Math.max(MIN_PLOT_RANGE_KM, maxRangeKm);
}

/** Smallest range the plot's rim represents. */
export const MIN_PLOT_RANGE_KM = 200;

/** True when no plotted ray returns at all at this frequency. */
export function nothingReturns(prediction: PropagationPrediction): boolean {
  const az = prediction.azimuthalHops;
  if (az && az.length > 1) {
    return hasHalfPowerBeam(az)
      ? !az.some((point) => point.halfPowerRangeKm !== undefined)
      : az.every((point) => !point.returns);
  }
  return prediction.hops.every((hop) => hop.rangeKm === undefined);
}

function describeBearing(point: AzimuthalHop, ringN: number, edge: BeamEdge, useBeam: boolean): string {
  const gain = point.realizedGainDbi !== undefined
    ? `, realized antenna gain ${point.realizedGainDbi.toFixed(2)} dBi` : "";
  const bearing = `Bearing ${point.bearingDeg.toFixed(0)}°`;
  const lobe = `Strongest lobe ${point.takeoffElevationDeg.toFixed(1)}°${gain}`;
  if (!useBeam) {
    const range = point.rangeKm[ringN - 1];
    return range !== undefined
      ? `${bearing}, elevation ${point.takeoffElevationDeg.toFixed(1)}°${gain}: ${ringN}× lands at ${range.toFixed(0)} km.`
      : `${bearing}, elevation ${point.takeoffElevationDeg.toFixed(1)}°${gain}: passes through the ionosphere.`;
  }
  const span = point.halfPowerElevationDeg;
  if (!span) return `${bearing}: no ray within ${HALF_POWER_DB} dB of peak. ${lobe}.`;
  const beam = `${bearing}, half-power beam ${span.lowDeg.toFixed(1)}–${span.highDeg.toFixed(1)}° elevation`;
  const reach = point.halfPowerRangeKm;
  if (!reach) return `${beam}: passes through the ionosphere. ${lobe}.`;
  const edgeText = edge === "far"
    ? `farthest landing ${(reach.farKm * ringN).toFixed(0)} km after ${ringN === 1 ? "1 hop" : `${ringN} hops`}`
    : `nearest landing ${reach.nearKm.toFixed(0)} km (skip zone inside)`;
  return `${beam}, ${edgeText}. ${lobe}.`;
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
        stroke={hopStyle(ringN).stroke}
        strokeOpacity={hopStyle(ringN).opacity}
        strokeWidth={edge === "far" ? hopStyle(ringN).width : 1.25}
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
