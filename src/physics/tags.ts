// --- Geometry Tags ---
export const MAIN_WIRE_TAG = 5; // single-wire dipole (no feedline)
export const LEFT_LEG_TAG = 1; // left leg of split antenna
export const RIGHT_LEG_TAG = 2; // right leg of split antenna
export const FEED_BRIDGE_TAG = 3; // 1-segment source bridge
export const FEEDLINE_SHIELD_TAG = 4; // coax shield (radiating outer surface)
export const DELTA_BASE_TAG = 6; // base wire of delta loop (left corner to right corner)

export const SLOPING_V_LEFT_STUB_TAG = 7;
export const SLOPING_V_RIGHT_STUB_TAG = 8;

export const TERMINATED_DELTA_LEFT_BASE_TAG = 9;
export const TERMINATED_DELTA_RIGHT_BASE_TAG = 10;
export const TERMINATED_DELTA_BRIDGE_TAG = 11;

/**
 * Wire tag for the vertical whip (single-wire monopole).
 * Distinct from MAIN_WIRE_TAG so the renderer can place the feedpoint marker
 * at the base of the whip rather than at its midpoint.
 */
export const VERTICAL_WHIP_TAG = 12;

export const VERTICAL_WHIP_RADIAL_TAG = 13;

export const INVERTED_L_VERTICAL_TAG = 14;
export const INVERTED_L_HORIZONTAL_TAG = 15;
export const INVERTED_L_RADIAL_TAG = 16;

export const FOLDED_DIPOLE_OPPOSITE_TAG = 17;
export const FOLDED_DIPOLE_CONNECTOR_TAG = 18;

/**
 * Termination bridge wire for the TFD (Terminated Folded Dipole).
 *
 * Present only when a non-zero terminating resistor is fitted. The bridge is a
 * short horizontal wire spanning the centre gap of the un-fed (top) conductor,
 * joining the two inner ends of its split halves. An LD-4 load on segment 1 of
 * this wire forces the top-conductor travelling wave to pass through the
 * terminating resistance as it crosses the gap — the physically correct model
 * for a traveling-wave TFD, dissipating the wave that would otherwise reflect.
 * This mirrors the terminated-delta's centre-gap bridge.
 */
export const FOLDED_DIPOLE_TERM_BRIDGE_TAG = 19;
