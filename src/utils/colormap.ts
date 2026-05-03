// Colormap lookup tables. Viridis is perceptually uniform and colorblind-safe.
// Table sampled at 32 stops; we linearly interpolate between stops at lookup.
//
// Source: matplotlib viridis (MIT).

export type ColormapName = 'viridis' | 'turbo' | 'jet';

type RGB = readonly [number, number, number];

/** 32-stop viridis colormap (normalized 0..1 RGB). */
const VIRIDIS: readonly RGB[] = [
  [0.267004, 0.004874, 0.329415],
  [0.282656, 0.100196, 0.422160],
  [0.277134, 0.185228, 0.489898],
  [0.253935, 0.265254, 0.529983],
  [0.221989, 0.339161, 0.548752],
  [0.190631, 0.407061, 0.556089],
  [0.163625, 0.471133, 0.558148],
  [0.139147, 0.533812, 0.555298],
  [0.120565, 0.596422, 0.543611],
  [0.134692, 0.658636, 0.517649],
  [0.208030, 0.718701, 0.472873],
  [0.327796, 0.772852, 0.408240],
  [0.477504, 0.821444, 0.318195],
  [0.647257, 0.858400, 0.209861],
  [0.824940, 0.884720, 0.106217],
  [0.993248, 0.906157, 0.143936],
];

const TURBO: readonly RGB[] = [
  [0.18995, 0.07176, 0.23217],
  [0.27366, 0.22323, 0.70580],
  [0.25269, 0.48024, 0.95734],
  [0.15844, 0.73551, 0.92305],
  [0.12014, 0.90284, 0.67692],
  [0.37740, 0.99107, 0.31489],
  [0.74143, 0.92594, 0.16010],
  [0.97860, 0.74726, 0.09689],
  [0.98675, 0.41859, 0.05475],
  [0.79600, 0.17377, 0.01729],
  [0.47960, 0.01583, 0.01055],
];

const JET: readonly RGB[] = [
  [0, 0, 0.5], [0, 0, 1], [0, 0.5, 1], [0, 1, 1],
  [0.5, 1, 0.5], [1, 1, 0], [1, 0.5, 0], [1, 0, 0], [0.5, 0, 0],
];

export function pickTable(name: ColormapName): readonly RGB[] {
  switch (name) {
    case 'viridis': return VIRIDIS;
    case 'turbo': return TURBO;
    case 'jet': return JET;
  }
}

/**
 * Look up an RGB triplet from a colormap at a 0..1 position.
 * Clamps the input and lerps between adjacent stops.
 */
export function sampleColormap(name: ColormapName, t: number): RGB {
  const table = pickTable(name);
  if (!Number.isFinite(t)) return table[0]!;
  const clamped = Math.min(1, Math.max(0, t));
  const f = clamped * (table.length - 1);
  const i = Math.floor(f);
  const j = Math.min(i + 1, table.length - 1);
  const a = table[i]!;
  const b = table[j]!;
  const w = f - i;
  return [
    a[0] + (b[0] - a[0]) * w,
    a[1] + (b[1] - a[1]) * w,
    a[2] + (b[2] - a[2]) * w,
  ];
}

/**
 * Map a dBi gain to a 0..1 colormap position using the chosen dynamic range.
 * Values above maxDb map to 1; values below maxDb - range map to 0.
 */
export function gainToColorT(gainDb: number, maxDb: number, rangeDb: number): number {
  const minDb = maxDb - rangeDb;
  if (gainDb >= maxDb) return 1;
  if (gainDb <= minDb) return 0;
  return (gainDb - minDb) / rangeDb;
}

/**
 * Hot-path optimized version of sampleColormap that writes directly into an output array.
 * Uses bitwise operations and avoids creating intermediate array allocations.
 */
export function sampleColormapFast(table: readonly RGB[], t: number, out: Float32Array, offset: number): void {
  const clamped = (t >= 0 && t <= 1) ? t : (t < 0 ? 0 : (t > 1 ? 1 : 0));
  const lenM1 = table.length - 1;
  const f = clamped * lenM1;
  const i = f | 0; // fast Math.floor
  const j = i === lenM1 ? i : i + 1;
  const a = table[i]!;
  const b = table[j]!;
  const w = f - i;

  out[offset] = a[0] + (b[0] - a[0]) * w;
  out[offset + 1] = a[1] + (b[1] - a[1]) * w;
  out[offset + 2] = a[2] + (b[2] - a[2]) * w;
}

/**
 * Converts a colormap table into a CSS linear gradient string.
 * Used for rendering a legend gradient that matches the 3D scene colors.
 */
export function getColormapCssGradient(name: ColormapName): string {
  const table = pickTable(name);
  const stops = table.map((rgb, index) => {
    const percentage = (index / (table.length - 1)) * 100;
    const r = Math.round(rgb[0] * 255);
    const g = Math.round(rgb[1] * 255);
    const b = Math.round(rgb[2] * 255);
    return `rgb(${r}, ${g}, ${b}) ${percentage.toFixed(2)}%`;
  });
  // Draw the gradient from bottom (0%) to top (100%) so that
  // the highest value is at the top of the element.
  return `linear-gradient(to top, ${stops.join(', ')})`;
}
