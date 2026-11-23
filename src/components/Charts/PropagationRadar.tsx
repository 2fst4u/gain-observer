// Top-down view of where an antenna's rays land after 1–3 hops through the
// modelled ionosphere: shaded by relative power density on the ground, with
// outlines for the half-power beam's reach.

import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";
import { calculateMaxRangeKm, nothingReturns } from "./propagationRadarUtils";
import {
  RadarGrid,
  RadarHopRings,
  RadarLabels,
  RadarCoverage,
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
        aria-label="Skywave landing distance radar plot"
        style={{ display: "block", maxWidth: "100%" }}
      >
        <RadarGrid
          cx={cx}
          cy={cy}
          size={size}
          maxRadiusPx={maxRadiusPx}
          margin={margin}
          maxRangeKm={maxRangeKm}
          units={units}
        />

        <RadarCoverage prediction={prediction} cx={cx} cy={cy} kmToPx={kmToPx} units={units} />

        {/* Outlines: where the half-power beam reaches after 1–3 hops. */}
        <RadarHopRings
          prediction={prediction}
          cx={cx}
          cy={cy}
          kmToPx={kmToPx}
        />

        {/* Centre dot = antenna location */}
        <circle cx={cx} cy={cy} r={4} fill="var(--accent)" />

        {nothingReturns(prediction) && (
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-muted)"
            fontFamily="system-ui, sans-serif"
          >
            {`Passes through at ${prediction.frequencyMHz.toFixed(2)} MHz`}
          </text>
        )}

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
