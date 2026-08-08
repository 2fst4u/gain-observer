// Radius law for the 3D radiation-pattern surface.
//
// Kept out of the component file so it can be unit-tested directly and so the
// component module keeps exporting only its component.

/**
 * NEC reports *power* gain in dB, so the linear gain is 10^(dB/10) and the
 * surface r(θ,φ) ∝ G(θ,φ) is the antenna's actual gain surface. The /20
 * (field-amplitude) exponent would draw the square root of the pattern
 * instead: lobes flattened, and every null and front-to-back ratio shown at
 * half its true dB depth.
 *
 *   10^(x/10) = exp(x · ln(10)/10)
 */
export const DB_TO_LINEAR_POWER = Math.LN10 / 10;

/**
 * Metres of radius per unit of linear gain, at 1× pattern scale: a 6 dBi
 * antenna draws a ~5 m peak radius, which sits sensibly against a typical HF
 * wire span.
 */
const RADIUS_M_PER_LINEAR_GAIN = 1.25;

/**
 * Very lossy antennas would otherwise shrink to nothing. Below this peak
 * radius the whole bubble is scaled up uniformly — shape and relative lobe
 * structure are preserved, only the absolute size stops being to scale.
 */
const MIN_PEAK_RADIUS_M = 0.35;

/**
 * Resolves the two numbers the vertex loop needs to turn a gain in dB into a
 * radius in metres:
 *
 *   radius = exp(max(gainDb, floorDb) · DB_TO_LINEAR_POWER) · factor
 *
 * `floorDb` is the pattern's own peak less the display dynamic range, rather
 * than a fixed absolute floor. An absolute floor collapses an entire low-gain
 * pattern onto one radius, so a very lossy antenna rendered as a featureless
 * sphere with no directivity at all; referencing the floor to the peak keeps
 * the shape intact at every gain level.
 */
export function radiusScaleForPattern(
  peakDb: number,
  dbRange: number,
  patternScale: number,
): { floorDb: number; factor: number } {
  const naturalPeakRadius = Math.exp(peakDb * DB_TO_LINEAR_POWER) * patternScale * RADIUS_M_PER_LINEAR_GAIN;
  const sizeBoost =
    naturalPeakRadius > 0 && naturalPeakRadius < MIN_PEAK_RADIUS_M
      ? MIN_PEAK_RADIUS_M / naturalPeakRadius
      : 1;
  return {
    floorDb: peakDb - dbRange,
    factor: patternScale * RADIUS_M_PER_LINEAR_GAIN * sizeBoost,
  };
}
