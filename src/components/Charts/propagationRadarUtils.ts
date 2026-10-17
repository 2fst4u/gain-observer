import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";

const KM_PER_MILE = 1.609344;

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
