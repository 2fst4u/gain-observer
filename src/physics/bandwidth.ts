// Shared SWR-bandwidth detection. Used by the chart stats (to list the usable
// bands) and by the adaptive sweep (to frame the window around them).

export interface SwrBand {
  /** Lower edge of the band (MHz). */
  readonly fLow: number;
  /** Upper edge of the band (MHz). */
  readonly fHigh: number;
  /** True when the band runs off the low end of the swept range (open below). */
  readonly lowClipped: boolean;
  /** True when the band runs off the high end of the swept range (open above). */
  readonly highClipped: boolean;
}

/**
 * Find every contiguous frequency band where `swrs[i] <= threshold`.
 *
 * `freqs` must be ascending and the same length as `swrs`. Band edges are
 * linearly interpolated to the exact threshold crossing. A band that touches
 * the first or last sample is flagged clipped (its true edge lies beyond the
 * swept range). Returns bands in ascending frequency order.
 */
export function findSwrBands(
  freqs: readonly number[],
  swrs: readonly number[],
  threshold = 2,
): SwrBand[] {
  const n = Math.min(freqs.length, swrs.length);
  const bands: SwrBand[] = [];
  if (n === 0) return bands;

  // Frequency where the SWR line between samples i and i+1 crosses threshold.
  const crossing = (i: number): number => {
    const s1 = swrs[i]!;
    const s2 = swrs[i + 1]!;
    if (s2 === s1) return freqs[i]!;
    const t = (threshold - s1) / (s2 - s1);
    return freqs[i]! + t * (freqs[i + 1]! - freqs[i]!);
  };

  let curLow: number | null = null;
  let curLowClipped = false;

  if (swrs[0]! <= threshold) {
    curLow = freqs[0]!;
    curLowClipped = true;
  }

  for (let i = 0; i < n - 1; i++) {
    const s1 = swrs[i]!;
    const s2 = swrs[i + 1]!;
    if (s1 > threshold && s2 <= threshold) {
      // Entering a band.
      curLow = crossing(i);
      curLowClipped = false;
    } else if (s1 <= threshold && s2 > threshold && curLow !== null) {
      // Leaving a band.
      bands.push({ fLow: curLow, fHigh: crossing(i), lowClipped: curLowClipped, highClipped: false });
      curLow = null;
      curLowClipped = false;
    }
  }

  if (curLow !== null) {
    bands.push({ fLow: curLow, fHigh: freqs[n - 1]!, lowClipped: curLowClipped, highClipped: true });
  }

  return bands;
}
