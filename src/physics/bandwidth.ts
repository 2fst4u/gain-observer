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
 * Find every contiguous frequency band where `getSwr(item) <= threshold`.
 *
 * `items` must be sorted in ascending frequency order. Band edges are
 * linearly interpolated to the exact threshold crossing. A band that touches
 * the first or last sample is flagged clipped (its true edge lies beyond the
 * swept range). Returns bands in ascending frequency order.
 */
export function findSwrBands<T>(
  items: readonly T[],
  getFreq: (item: T) => number,
  getSwr: (item: T) => number,
  threshold = 2,
): SwrBand[] {
  const n = items.length;
  const bands: SwrBand[] = [];
  if (n === 0) return bands;

  let curLow: number | null = null;
  let curLowClipped = false;

  let prevS = getSwr(items[0]!);
  let prevF = getFreq(items[0]!);

  if (prevS <= threshold) {
    curLow = prevF;
    curLowClipped = true;
  }

  for (let i = 0; i < n - 1; i++) {
    const currItem = items[i + 1]!;
    const currS = getSwr(currItem);
    const currF = getFreq(currItem);

    if (prevS > threshold && currS <= threshold) {
      // Entering a band.
      const t = currS === prevS ? 0 : (threshold - prevS) / (currS - prevS);
      curLow = prevF + t * (currF - prevF);
      curLowClipped = false;
    } else if (prevS <= threshold && currS > threshold && curLow !== null) {
      // Leaving a band.
      const t = currS === prevS ? 0 : (threshold - prevS) / (currS - prevS);
      const highEdge = prevF + t * (currF - prevF);
      bands.push({ fLow: curLow, fHigh: highEdge, lowClipped: curLowClipped, highClipped: false });
      curLow = null;
      curLowClipped = false;
    }

    prevS = currS;
    prevF = currF;
  }

  if (curLow !== null) {
    bands.push({ fLow: curLow, fHigh: prevF, lowClipped: curLowClipped, highClipped: true });
  }

  return bands;
}
