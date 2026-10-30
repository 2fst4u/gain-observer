// Top-down outline of ideal spherical-shell ground arcs.
// The outlines are geometric distances, not filled coverage regions.

import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";
import { calculateMaxRangeKm } from "./propagationRadarUtils";
import {
  RadarGrid,
  RadarHopRings,
  RadarLabels,
  RadarLegend,
} from "./PropagationRadarComponents";

export interface PropagationRadarProps {
  readonly prediction: PropagationPrediction;
  readonly units: UnitSystem;
  /** Pixel size (square). */
  readonly size?: number;
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

  const maxRangeKm = calculateMaxRangeKm(prediction);
  const maxRadiusPx = size / 2 - margin;
  const kmToPx = maxRadiusPx / Math.max(1, maxRangeKm);

  return (
    /* SEO: Upgrading generic <div> to a semantic <figure> tag groups the radar plot and its legend logically for crawlers and assistive technologies. margin: 0 prevents visual changes. */
    <figure
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        margin: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="Ideal propagation geometry radar plot"
        style={{ display: "block", maxWidth: "100%" }}
      >
        <RadarGrid
          cx={cx}
          cy={cy}
          size={size}
          maxRadiusPx={maxRadiusPx}
          margin={margin}
        />

        {/* Unfilled outlines show geometric arcs without implying coverage. */}
        <RadarHopRings
          prediction={prediction}
          cx={cx}
          cy={cy}
          kmToPx={kmToPx}
        />

        {/* Centre dot = antenna location */}
        <circle cx={cx} cy={cy} r={4} fill="var(--accent)" />

        <RadarLabels
          cx={cx}
          cy={cy}
          size={size}
          margin={margin}
          prediction={prediction}
          kmToPx={kmToPx}
          units={units}
        />
      </svg>

      {/* SEO: Using <figcaption> instead of a generic <div> clearly associates this legend with the preceding <svg> graphic. */}
      <RadarLegend />
    </figure>
  );
}
