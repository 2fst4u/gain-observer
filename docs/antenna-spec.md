# Antenna Physics and Modeling Specification

This document is the stable reference for antenna geometry, coordinate systems, and the physical/mathematical model for all antenna types supported by `gain-observer`. All implementation work must reference and adhere to this specification to ensure consistency.

It is organised in two parts:

- **Part I — Concepts & Conventions** establishes the coordinate system, the shared glossary, the theory of terminated antennas, the SWR/impedance definitions, and the modeling patterns to avoid. These apply to every antenna type.
- **Part II — Per-Type Specifications** gives the concrete, NEC-card-level geometry, feedpoint, termination, and segmentation rules for each supported antenna.

---

# Part I — Concepts & Conventions

## 1. Coordinate Conventions

### 1.1 NEC Coordinate Axes

We use the standard NEC-2 Cartesian coordinate system:

- **Z-Axis**: Vertical axis. Positive Z is "up" (toward the zenith).
- **XY-Plane**: The horizontal ground plane.
- **Origin (0,0,0)**: Located at ground level directly under the antenna's geometric center (for symmetric antennas) or the primary feedpoint.

### 1.2 Ground Plane Convention

- **Free Space**: No ground plane. Calculations are performed in an infinite vacuum.
- **Perfect Ground**: An infinite, perfectly conducting plane at $Z = 0$.
- **Real Ground**: An infinite lossy dielectric plane at $Z = 0$, characterized by conductivity ($\sigma$ in S/m) and relative permittivity ($\epsilon_r$).
- **Grounded Wires**: Wires must not end exactly at $Z = 0$ unless they are part of a deliberate grounded structure (e.g., a monopole or a terminated leg). NEC-2 requires special care for wires touching ground.

### 1.3 Orientation and Angles

- **Compass Heading**: $0^\circ$ is North ($+Y$ axis), $90^\circ$ is East ($+X$ axis).
- **Internal Mapping**: To convert a compass heading $\alpha$ to a standard unit circle angle $\theta$ (where $0^\circ$ is $+X$): $\theta = 90^\circ - \alpha$.
- **Elevation**: $0^\circ$ is the horizon (XY plane), $90^\circ$ is the zenith ($+Z$ axis).

## 2. Glossary

These definitions apply to every antenna type in Part II.

- **Directivity ($D$):** $D = \frac{4\pi U_{max}}{P_{rad}}$.
- **Gain ($G$):** $10 \log_{10}(\eta \cdot D)$ dBi.
- **Realized Gain:** $G(dBi) + 10 \log_{10}(1 - |\Gamma|^2)$.
- **Efficiency ($\eta$):** $P_{rad} / P_{in}$.
- **Front/Back:** $G_{peak} - G_{180^\circ}$ (dB).
- **Ripple:** $(I_{max}-I_{min})/(I_{max}+I_{min})$.

## 3. "Terminated" Antennas

### 3.1 Physical Meaning

A **terminated** antenna places a non-inductive resistive load somewhere on the radiating structure to absorb the wave that would otherwise reflect and form a standing wave. Two distinct families exist in this app, and they behave very differently:

- **Open travelling-wave terminations** (Sloping V): each leg is an open long wire carrying a travelling wave from the apex feed out to a terminator at its far (ground-ward) tip. The termination absorbs the wave that would otherwise reflect, so each wire's radiation cone tilts toward its tip and the two cones reinforce off the open mouth of the V. The directionality comes from the travelling-wave _direction_ along each leg, **not** from any left/right geometric asymmetry. Result: a unidirectional, broadly cardioid pattern fired along the bisector of the V's opening, broadband.
- **Closed aperiodic-loop terminations** (Terminated Delta, Terminated Folded Dipole [T2FD]): the structure is a closed loop fed at a symmetric point; the current is absorbed at the symmetric point opposite the feed via a single resistor _bridging the gap_ (not shunted to ground). Because the geometry stays bilaterally symmetric and the loop is electrically compact, the pattern remains bidirectional/broadside — **not** unidirectional. The termination buys broadband flat impedance, trading efficiency for flat SWR across an octave.

### 3.2 Termination Implementation

- **Sloping V**: Termination consists of a resistor connected from the end of each leg to ground via a short stub wire. Typical value $300\text{--}600\,\Omega$ (matches the leg's characteristic impedance against ground).
- **Terminated Delta**: Termination is a single resistor on a short horizontal _bridge wire_ spanning the gap at the centre of the base. Typical value $\sim 600\,\Omega$ (close to the loop wire's characteristic impedance over typical HF heights, $Z_0 \approx 60 \ln(2h/a) \approx 500\text{--}700\,\Omega$). **Not** two resistors to ground — that topology is symmetric but fails to terminate the loop, leaving large reactive feedpoint impedance and high leg current ripple.
- **Terminated Folded Dipole**: Termination is a single resistor on a short horizontal _bridge wire_ spanning the gap at the centre of the top (un-fed) conductor. Typical value $\sim 390\text{--}600\,\Omega$. Like the terminated delta, this implements a proper TFD (T2FD) aperiodic-loop topology by forcing current through the resistor across the gap.
- **Effect (sloping V)**: converts a resonant bi-directional radiator into a broadband uni-directional travelling-wave radiator.
- **Effect (terminated delta)**: converts a resonant narrowband loop into a broadband aperiodic loop. Pattern stays roughly delta-loop-shaped (broadside max, end-fire minimum). Multi-band usable with a 9:1 unun.
- **Effect (terminated folded dipole)**: flattens SWR across a wide frequency range compared to a standard folded dipole, at the cost of radiation efficiency due to power dissipated in the termination.

### 3.3 Termination vs. Matching

- **Crucial Distinction**: A "correctly terminated" antenna **does not** imply a $50\,\Omega$ feedpoint SWR.
- The termination resistor is chosen to match the **antenna wire's characteristic impedance** to ground to prevent reflections on the wire itself.
- The resulting feedpoint impedance may still be high (e.g., $400\text{--}800\,\Omega$) and will likely require a transformer (Balun/Unun) to match to $50\,\Omega$ coax.

## 4. SWR and Impedance Definitions

### 4.1 Raw Feedpoint Impedance

The complex impedance $Z = R + jX$ calculated by NEC at the excitation segment.

### 4.2 Raw SWR (vs 50 Ω)

SWR calculated directly from the raw feedpoint impedance relative to a $50\,\Omega$ system:
$$\Gamma = \frac{Z - 50}{Z + 50}$$
$$\text{SWR} = \frac{1 + |\Gamma|}{1 - |\Gamma|}$$

### 4.3 Reflection Distinction

- **Wire Reflection**: Reflection at the end of the antenna wire (controlled by termination).
- **Source SWR**: Mismatch between the transmission line (or generator) and the antenna feedpoint.
- **Note**: A travelling-wave antenna (terminated) can have an excellent (low) wire reflection but a high source SWR if not transformed.

## 5. Invalid Modeling Patterns to Avoid

1.  **Grounded Tips at Z=0**: Do not end wires at $Z=0$ unless intentionally modeling a grounded structure. For real ground, wires should typically end at a small height (e.g., $0.001\text{--}0.1\,\text{m}$) or use the NEC-2 ground connection cards correctly if implemented.
2.  **Silent Geometry Clamping**: If a user enters a height or length that is physically impossible or violates NEC constraints (e.g., segment length/radius ratio), do not silently change the value in the physics engine without reflecting this in the UI.
3.  **Inconsistent Termination**: Do not mix "per-leg-to-ground" termination and "across-tip" termination in the same antenna model unless it is a specific, documented hybrid type.
4.  **SWR-based Proof of Termination**: Never use a low SWR alone as "proof" that an antenna is correctly terminated. A resonant antenna can have $1:1$ SWR, but it is not "terminated" in the travelling-wave sense. Termination must be verified by inspecting the current distribution (lack of standing wave) and front-to-back ratio.

---

# Part II — Per-Type Specifications

Every type below uses the coordinate conventions of Part I §1 and the glossary of Part I §2. Termination behaviour is governed by the theory in Part I §3 and the SWR conventions by Part I §4.

## 6. Dipole

- **Balanced:** Yes.

### 6.1 Geometry Definition

- **Structure:** A single straight horizontal wire (or two collinear wires).
- **Apex Location:** Geometric center of the wire at $(0, 0, \text{height})$.
- **Leg Count & Length:** 1 wire, total end-to-end length $L$.
- **Reference Length:** $0.475\lambda$ (Resonance).
- **Conventions:** Straight wire aligned with orientation vector.
- **Tips:** Symmetric endpoints at $\pm L/2$ relative to apex.
- **Min Height:** Fully supports `height = 0` (or `height <= 0`), which seamlessly switches the model to a free space environment without ground, preventing NEC-2 `GE 1` instability.

### 6.2 Feedpoint Definition

- **NEC Excitation:** Single-segment voltage source (`EX`) on Tag 1.
- **Segment:** Center segment of the wire (center-fed by default).
- **Feed Type:** Single-segment voltage source.
- **Offset Feed:** Supports offset feedpoints (e.g., Off-Center Fed Dipole) by splitting the wire asymmetrically.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; offset feedpoints are supported via splitting the wire).

### 6.3 Termination Definition

- **Model:** None. Dipoles are resonant, non-terminated antennas.

### 6.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR (Mismatch to 50 Ω).

### 6.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$ minimum.
- **Minimum:** 9 segments total.
- **Alignment:** Must use an **odd** number of segments to ensure a precise center feedpoint.

---

## 7. Inverted-V

- **Balanced:** Yes.

### 7.1 Geometry Definition

- **Structure:** Two wires sloping down from a common central apex.
- **Apex Location:** Highest point at $(0, 0, \text{height})$. The `height` parameter refers to the apex.
- **Leg Count & Length:** 2 legs, total radiating length $L$ (sum of both legs).
- **Reference Length:** $0.485\lambda$ total ($0.5\lambda$ with 0.97 end-effect).
- **Angle/Slope:** Included angle $\alpha$ between legs (Default 120°). The angle automatically flattens (increases) if necessary to prevent the tips from dropping below the minimum height.
- **Tips:** Symmetric endpoints at $z = \text{height} - \frac{L - \text{bridge}}{2} \cdot \cos(\alpha_{\text{eff}}/2)$, where $\alpha_{\text{eff}}$ is the effective angle after any required flattening.
- **Min Height:** Tip height must be $\ge 0.5$ m.

### 7.2 Feedpoint Definition

- **NEC Excitation:** 1-segment "source bridge" (Tag 3) at apex.
- **Segment:** Segment 1 of Tag 3.
- **Feed Type:** Balanced bridge segment.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable).

### 7.3 Termination Definition

- **Model:** None.

### 7.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR.

### 7.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$ minimum.
- **Minimum:** 9 segments per radiating leg.
- **Alignment:** Legs should have equal segments. Bridge is exactly 1 segment.

---

## 8. Sloping V (Terminated)

- **Balanced:** Yes (apex-fed). Supports termination at the far ends of the legs (see Part I §3).

### 8.1 Geometry Definition

- **Structure:** Two wires forming a V-shape, sloping from a high feedpoint toward the ground or lower supports.
- **Apex Location:** Highest point at $(0, 0, \text{height})$. The `height` parameter refers to the feedpoint (apex).
- **Leg Count & Length:** 2 legs, total radiating length $L$ (sum of both legs).
- **Reference Length:** $2.0\lambda$ **total** ($\approx 1.0\lambda$ per leg). The `length` parameter is the total radiating wire, split into two legs of $(L - \text{bridge})/2$ each. Traveling-wave structure, so no end-effect correction applies.
- **Angle/Slope:** Included angle $\alpha$ (between legs). The downward slope of the legs is automatically calculated so that the tips rest at the ground floor (`SLOPING_V_MIN_TIP_Z_M` or $0.5$ m) to ensure consistent termination to ground.
- **Tips:** Endpoints at ground-ward end of legs.
- **Min Height:** Tip height must be $\ge 0.5$ m.

### 8.2 Feedpoint Definition

- **NEC Excitation:** 1-segment source bridge at apex.
- **Segment:** Segment 1 of bridge.
- **Feed Type:** Balanced bridge segment.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable).

### 8.3 Termination Definition

- **Topology:** Resistor from each leg tip to ground via short stub wires.
- **Diagram:**
  ```
       Apex (Feed)
          / \
         /   \
        /     \
      Tip     Tip
       |       |
       R       R
       |       |
      GND     GND
  ```
- **NEC Model:** `LD 4` loads on short vertical stub wires extending from each tip down to near-ground (`SLOPING_V_STUB_BOTTOM_Z_M`).
- **Value:** `terminatingResistor` is applied identically to both stubs.
- **Return Path:** Explicit NEC current path from the wire tip toward the ground plane.

### 8.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Statement:** Traveling wave antennas often have high raw SWR (e.g., 600 Ω feed). Raw SWR graph reflects this mismatch, not termination quality.

### 8.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$ minimum.
- **Minimum:** 9 segments per radiating leg.

---

## 9. Delta Loop

- **Balanced:** Yes.

### 9.1 Geometry Definition

- **Structure:** An apex-up, isosceles triangular loop of wire.
- **Apex Location:** Highest point at $(0, 0, \text{height})$.
- **Leg Count & Length:** 3 wires forming a triangle, total perimeter $L$.
- **Reference Length:** $1.0\lambda$ (Resonance).
- **Angle/Slope:** Equilateral triangle in the vertical plane (flattens to isosceles when the mast height is below the equilateral height; perimeter preserved).
- **Tips:** Bottom corners.
- **Min Height:** Bottom wire must be $\ge 0.5$ m above ground.

### 9.2 Feedpoint Definition

- **NEC Excitation:** Last segment of the left leg (Tag 1), nearest the apex.
- **Segment:** Segment `segmentsPerLeg` of Tag 1.
- **Feed Type:** Single-segment voltage source (or split bridge if feedline connected).
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable).

### 9.3 Termination Definition

- **Model:** None.

### 9.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR.

### 9.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$.
- **Minimum:** 9 segments per side.
- **Alignment:** Excitation is placed at the apex, so segment count alignment on the bottom wire is not strictly constrained by feedpoint centering.

---

## 10. Terminated Delta (aperiodic loop)

- **Termination Support:** A single resistor across the base-centre gap (not two resistors to ground). Designed for broadband flat impedance, not directionality — the antenna remains roughly broadside-bidirectional, like a delta loop but aperiodic (see Part I §3).

### 10.1 Geometry Definition

- **Structure:** A triangular loop of wire, split at the centre of the base, with a single horizontal _bridge wire_ spanning the gap.
- **Apex Location:** Highest point at $(0, 0, \text{height})$.
- **Leg Count & Length:** 3 wires forming a triangle, total perimeter $L$. The bottom wire is split at the centre, so the structure is emitted as two top legs + two half-base wires + one bridge wire across the gap (when terminated).
- **Reference Length:** $1.0\lambda$ canonical, but resonance is not the design goal: a properly bridged termination flattens impedance across an octave or more, so the antenna is used multi-band rather than at a single design frequency.
- **Angle/Slope:** Equilateral triangle in the vertical plane (flattens to isosceles when the mast height is below the equilateral height; perimeter preserved).
- **Tips:** Bottom corners. The bottom wire is split at the centre with a gap (`FEED_BRIDGE_LENGTH_M`).
- **Min Height:** Bottom wire must be $\ge 0.5$ m above ground.

### 10.2 Feedpoint Definition

- **NEC Excitation:** Last segment of the LEFT leg (at the apex) when no feedline is fitted; 1-segment apex bridge when a feedline is present.
- **Feed Type:** Apex feed (balanced).
- **Feedline Support:** Supported (radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable). A 9:1 (or similar) unun is typically required at the rig end to bring the ~500–900 Ω feedpoint Z down to ~50 Ω.

### 10.3 Termination Definition

- **Topology:** A single horizontal _bridge wire_ spans the gap between the two half-base inner ends. The terminating resistor sits on that bridge. This is an aperiodic-loop topology (the triangular cousin to the T2FD).
- **NEC Model:** One `LD 4` load on the single segment of `TERMINATED_DELTA_BRIDGE_TAG`. No vertical stubs, no ground shunts.
- **Value:** `terminatingResistor` should be close to the loop wire's characteristic impedance over real ground, $Z_0 \approx 60 \ln(2h/a) \approx 500\text{--}700\,\Omega$. Default is 600 Ω.
- **What this is NOT:** Not a unidirectional travelling-wave antenna. The geometry is bilaterally symmetric, so by symmetry the pattern is bidirectional/broadside (delta-loop-like). The termination buys broadband flat impedance, not directionality. For a unidirectional cardioid you need an asymmetric topology (e.g. corner-fed/corner-terminated K9AY-style), which this app does not currently model.

### 10.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR.

### 10.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$.
- **Minimum:** 9 segments per side.
- **Alignment:** Base is split into two halves.

---

## 11. Vertical Whip

- **Balanced:** No (unbalanced, driven against ground or radials).

### 11.1 Geometry Definition

- **Shape:** A single vertical wire extending upwards from the base.
- **`height` parameter:** The height of the base above ground (metres). Usually 0 or very small.
- **`length` parameter:** The length of the vertical wire (metres). Defaults to 32 ft (9.75 m).
- **Orientation:** Not applicable (omnidirectional).
- **Base:** The vertical wire starts at the maximum of `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) and `height` to ensure electrical isolation from the ground.
- **Reference length:** $0.2375\lambda$ (¼λ with 0.95 end-effect).

### 11.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of `VERTICAL_WHIP_TAG` (12) — the lowest segment at the base.
- **Feed Type:** Base-fed monopole (unbalanced). Coax shield connects at the base; the antenna is driven against the ground / counterpoise.
- **Feedline Support:** Not modelled. The feedline is treated as ideal.

### 11.3 Counterpoise

- **Model:** When enabled, `VERTICAL_WHIP_RADIAL_COUNT` (4) horizontal ¼λ radials fan out from the base at equal azimuth spacing, tagged `VERTICAL_WHIP_RADIAL_TAG` (13).
- **Without counterpoise:** The source has no proper return path; NEC reports the high reactance and SWR that a radial-less base-fed antenna physically exhibits.

### 11.4 SWR Convention

- **Reference:** 50 Ω.
- **Notes:** A resonant ¼λ vertical over a good ground plane presents roughly 36 Ω.

### 11.5 Segmentation Rules

- **Density:** 20 segments per λ minimum for the whip and each radial.
- **Minimum:** 9 segments (`MIN_SEGS_PER_LEG`) per wire.
- **Whip and radials are emitted as separate `Wire` objects**, tagged independently.

---

## 12. Inverted-L

- **Balanced:** No.

### 12.1 Geometry Definition

- **Shape:** Two wire segments forming an L: a vertical section from the base up to the bend point, followed by a horizontal top-loading section extending outward at right angles.
- **`height` parameter:** Bend-point height above ground (metres). This equals the length of the vertical section (base gap excluded). Controls how tall the mast needs to be.
- **`length` parameter:** Total wire length (vertical + horizontal combined, metres). The horizontal section absorbs any length beyond the vertical section: $L_{horiz} = L_{total} - L_{vert}$.
- **Orientation:** Azimuth direction the horizontal section runs.
- **Base:** The vertical wire starts at `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) above ground — same electrical isolation as the vertical whip.
- **Bend junction:** The end of the vertical wire and the start of the horizontal wire share an exact coordinate so NEC creates a proper wire junction.
- **Reference length:** $0.2375\lambda$ total (¼λ with 0.95 end-effect); the horizontal section provides the electrical length the mast height falls short of.

### 12.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of `INVERTED_L_VERTICAL_TAG` (14) — the lowest segment at the base of the vertical section.
- **Feed Type:** Base-fed monopole (unbalanced). Coax shield connects at the base; the antenna is driven against the ground / counterpoise.
- **Feedline Support:** Not modelled (same convention as vertical whip). The feedline is treated as ideal.

### 12.3 Counterpoise

- **Model:** When enabled, `VERTICAL_WHIP_RADIAL_COUNT` (4) horizontal ¼λ radials fan out from the base at equal azimuth spacing, tagged `INVERTED_L_RADIAL_TAG` (16). Identical pattern to the vertical whip's counterpoise.
- **Without counterpoise:** The source has no proper return path; NEC reports the high reactance and SWR that a radial-less base-fed antenna physically exhibits.

### 12.4 SWR Convention

- **Reference:** 50 Ω.
- **Notes:** A resonant ¼λ inverted-L over a good ground presents roughly 30–50 Ω — a usable direct coax match. Feedpoint impedance varies with height, horizontal-section fraction, and ground quality. The vertical-section fraction has a stronger influence on the radiation pattern (more vertical component → more omnidirectional; more horizontal component → slight gain asymmetry in the horizontal-section direction).

### 12.5 Segmentation Rules

- **Density:** 20 segments per λ minimum for each section independently.
- **Minimum:** 9 segments per section (`MIN_SEGS_PER_LEG`).
- **Vertical and horizontal sections are emitted as separate `Wire` objects**, tagged independently so current-ripple diagnostics can distinguish them.

---

## 13. Folded Dipole

- **Balanced:** Yes.

### 13.1 Geometry Definition

- **Shape:** Two parallel half-wave conductors joined at both ends, forming a narrow rectangular loop in the vertical plane. The bottom (fed) conductor sits at `z = height`; the top (un-fed) conductor sits at `z = height + aperture`. The connectors are short vertical wires at each end. The overall structure is fully buildable at a modest height — the top conductor only rises `aperture` (≤ 0.5 m) above the feedpoint, unlike a vertical loop.
- **`length` parameter:** Each conductor's length (metres). Reference length: ½λ (0.475λ with end-effect) — same as a standard dipole; the fold does not change the resonant length.
- **`foldedDipoleAperture` parameter:** Vertical spacing between the two parallel conductors (metres). Default 0.3 m. Clamped to [0.02 m, `FOLDED_DIPOLE_MAX_APERTURE_M` = 0.5 m]. The upper cap keeps the antenna a genuine folded dipole and, crucially, within the spacing range where NEC's close-parallel-wire solution converges inside `MAX_SEGS_PER_LEG` (see §13.5).
- **Orientation:** Azimuth the conductor axis runs. The aperture is in the vertical (Z) direction; changing the orientation rotates the axis in the horizontal plane but the top/bottom wire layout is preserved.
- **Fed conductor:** Split at its centre by a `FEED_BRIDGE_LENGTH_M` feed bridge (the two halves carry `LEFT_LEG_TAG` / `RIGHT_LEG_TAG`, the same split-fed convention as the standard dipole).
- **Min Height:** Bottom conductor at `z = height`; fully supports `height = 0` (or `height <= 0`), which seamlessly switches the model to a free space environment without ground, preventing NEC-2 `GE 1` instability. The top conductor is automatically at `z = height + aperture`.

### 13.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of `FEED_BRIDGE_TAG` (3) at the centre of the lower conductor — handled by the existing `hasBridge` excitation path.
- **Feed Type:** Single-segment voltage source on the bridge; balanced.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; feedpoint always at the centre bridge, offset is not applicable).
- **Feedpoint Impedance:** Approximately 4× a plain dipole (~300 Ω) for equal-diameter conductors, largely independent of spacing. A 4:1 balun brings this to ~75 Ω; a 6:1 brings it to ~50 Ω for direct coax use. 300 Ω twin-lead matches it directly.

### 13.3 Termination Definition

- **Topology:** Optional. The opposite conductor is split into two halves at the centre. When terminated, a single `LD 4` resistor sits on a short horizontal bridge wire (`FOLDED_DIPOLE_TERM_BRIDGE_TAG`) that spans the gap between the two inner ends of the un-fed (top) conductor.
- **Unterminated (`terminatingResistor = 0`):** A classic folded dipole — ~300 Ω, narrowband, dipole gain and pattern.
- **Terminated (`terminatingResistor > 0`):** A terminated folded dipole (TFD or T2FD). The resistor flattens SWR across a wide frequency range at the cost of efficiency (roughly half the power is dissipated). Typical value ~390–600 Ω. This is the straight-conductor cousin of the aperiodic loop modelled under §10 as a terminated delta.

### 13.4 SWR Convention

- **Reference:** 50 Ω.
- **Statement:** Raw SWR against 50 Ω is high (~6:1) for the unterminated ~300 Ω feedpoint. A 6:1 impedance-transforming balun is **enabled by default** when this antenna type is selected, transforming the feedpoint to ~50 Ω and showing the characteristic flat broadband SWR curve. The terminated variant (TFD) shows an even flatter curve, reflecting the resistive termination rather than improved efficiency.

### 13.5 Segmentation Rules

- **Target segment length:** `min(λ / 20, aperture / 2)`. NEC's thin-wire kernel loses accuracy for closely-spaced parallel wires once the segment length grows much larger than the wire separation; tying the segment length to half the aperture is the empirical point at which the free-space gain converges to the dipole value. All segment counts derive from this single target length, capped at `MAX_SEGS_PER_LEG` (100). This is also why the aperture is capped at 0.5 m — wider spacings would need more than 100 segments to converge.
- **Minimum:** 9 segments (`MIN_SEGS_PER_LEG`) per fed half-conductor and for each half of the opposite conductor.
- **Alignment:** The opposite conductor is always split into two symmetric halves (each with the same segment count) around the centre. The fed conductor is split into two halves around the 1-segment feed bridge.
- **Wires:** 7 wires total — fed-conductor left half, feed bridge, fed-conductor right half, opposite conductor left half, opposite conductor right half, and the two end connectors across the aperture (shared `FOLDED_DIPOLE_CONNECTOR_TAG`). An 8th wire (the termination bridge) is added when terminated.

### 13.6 Gain

- **Unterminated:** Identical to a standard dipole (~2.15 dBi in free space) at narrow apertures. The fold is an impedance transformation, not a gain mechanism.
- **Wide aperture:** As the spacing grows toward a notable fraction of a wavelength, the two in-phase conductors begin to act as a broadside two-element array and the pattern departs from a simple dipole.
- **Terminated:** Lower than a plain dipole — the terminating resistor dissipates a substantial fraction of the input power (the broadband-vs-efficiency trade).
