// Top-down "radar" plot of estimated propagation range.
//
// The antenna sits at the centre and three concentric rings show the
// great-circle ground range covered by 1, 2, and 3 sky-wave hops at the
// current take-off angle. Ring colour reflects open / marginal / closed
// status from src/physics/propagation.ts.
//
// We deliberately use raw SVG (no Chart.js radar plugin) because:
//   - the chart is genuinely circular concentric rings, which is awkward
//     to express with Chart.js polar-area scales;
//   - SVG is easy to make theme-responsive (CSS variables work directly);
//   - it keeps the bundle small.

import type { PropagationPrediction } from "../../physics/propagation";
import type { UnitSystem } from "../../physics/units";
import {
  calculateMaxRangeKm,
  RadarGrid,
  RadarHopRings,
  RadarLabels,
  RadarLegend,
} from "./propagationRadarUtils";

interface PropagationRadarProps {
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
        aria-label="Propagation range radar plot"
        style={{ display: "block", maxWidth: "100%" }}
      >
        <RadarGrid
          cx={cx}
          cy={cy}
          size={size}
          maxRadiusPx={maxRadiusPx}
          margin={margin}
        />

        {/* Hop rings: rendered from outermost to innermost so labels stay readable.
            If azimuthalHops are available, the ring is a sequence of per-azimuth
            wedges so the colour reflects each bearing's own status / link
            quality, not a single global "best-bearing" colour. */}
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
