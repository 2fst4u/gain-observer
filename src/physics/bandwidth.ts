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
 * The elements in `points` must have ascending frequencies. Band edges are
 * linearly interpolated to the exact threshold crossing. A band that touches
 * the first or last sample is flagged clipped (its true edge lies beyond the
 * swept range). Returns bands in ascending frequency order.
 */
export function findSwrBands<T>(
  points: readonly T[],
  getFreq: (p: T) => number,
  getSwr: (p: T) => number,
  threshold = 2,
): SwrBand[] {
  const n = points.length;
  const bands: SwrBand[] = [];
  if (n === 0) return bands;

  let prevSwr = getSwr(points[0]!);

  // Frequency where the SWR line between samples i and i+1 crosses threshold.
  const crossing = (i: number, s1: number, s2: number): number => {
    const f1 = getFreq(points[i]!);
    const f2 = getFreq(points[i + 1]!);
    if (s2 === s1) return f1;
    const t = (threshold - s1) / (s2 - s1);
    return f1 + t * (f2 - f1);
  };

  let curLow: number | null = null;
  let curLowClipped = false;

  if (prevSwr <= threshold) {
    curLow = getFreq(points[0]!);
    curLowClipped = true;
  }

  for (let i = 0; i < n - 1; i++) {
    const s1 = prevSwr;
    const s2 = getSwr(points[i + 1]!);
    if (s1 > threshold && s2 <= threshold) {
      // Entering a band.
      curLow = crossing(i, s1, s2);
      curLowClipped = false;
    } else if (s1 <= threshold && s2 > threshold && curLow !== null) {
      // Leaving a band.
      bands.push({ fLow: curLow, fHigh: crossing(i, s1, s2), lowClipped: curLowClipped, highClipped: false });
      curLow = null;
      curLowClipped = false;
    }
    prevSwr = s2;
  }

  if (curLow !== null) {
    bands.push({ fLow: curLow, fHigh: getFreq(points[n - 1]!), lowClipped: curLowClipped, highClipped: true });
  }

  return bands;
}
