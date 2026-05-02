// Unit conversion helpers. Internal state is always metric.

export type UnitSystem = 'metric' | 'imperial';

const METERS_PER_FOOT = 0.3048;

function feetToMeters(ft: number): number {
  return ft * METERS_PER_FOOT;
}

/**
 * Convert a metric-stored length into a user-facing number in the chosen system.
 * Always returns meters for metric, feet for imperial.
 */
export function toDisplayLength(meters: number, system: UnitSystem): number {
  return system === 'metric' ? meters : meters / METERS_PER_FOOT;
}

/**
 * Inverse of toDisplayLength: takes a user-entered value and returns meters.
 */
export function fromDisplayLength(value: number, system: UnitSystem): number {
  return system === 'metric' ? value : feetToMeters(value);
}

export function displayLengthUnit(system: UnitSystem): string {
  return system === 'metric' ? 'm' : 'ft';
}

/**
 * Format a length (stored in meters) for UI display with fixed precision.
 */
export function formatLength(meters: number, system: UnitSystem, precision = 2): string {
  const v = toDisplayLength(meters, system);
  return `${v.toFixed(precision)} ${displayLengthUnit(system)}`;
}
