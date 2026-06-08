# Antenna Physics Specification

This document defines the physical and mathematical model for all antenna types supported by `gain-observer`. All subsequent implementations must reference and adhere to this specification.

---

## 1. Center-Fed Dipole

### 1.1 Geometry Definition

- **Apex Location:** Geometric center of the wire at $(0, 0, \text{height})$.
- **Leg Count & Length:** 1 wire, total length $L$.
- **Reference Length:** $0.475\lambda$ (Resonance).
- **Conventions:** Straight wire aligned with orientation vector.
- **Tips:** Symmetric endpoints at $\pm L/2$ relative to apex.
- **Min Height:** All points must satisfy $z \ge 0.1$ m to avoid NEC-2 `GE 1` instability.

### 1.2 Feedpoint Definition

- **NEC Excitation:** Single-segment voltage source (`EX`) on Tag 1.
- **Segment:** Center segment of the wire.
- **Feed Type:** Single-segment voltage source.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card).

### 1.3 Termination Definition

- **Model:** None. Dipoles are resonant, non-terminated antennas.

### 1.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR (Mismatch to 50 Ω).

### 1.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$ minimum.
- **Minimum:** 9 segments total.
- **Alignment:** Must use an **odd** number of segments to ensure a precise center feedpoint.

### 1.6 Glossary

- **Directivity ($D$):** $D = \frac{4\pi U_{max}}{P_{rad}}$.
- **Gain ($G$):** $10 \log_{10}(\eta \cdot D)$ dBi.
- **Realized Gain:** $G(dBi) + 10 \log_{10}(1 - |\Gamma|^2)$.
- **Efficiency ($\eta$):** $P_{rad} / P_{in}$.
- **Front/Back:** $G_{peak} - G_{180^\circ}$ (dB).
- **Ripple:** $(I_{max}-I_{min})/(I_{max}+I_{min})$.

---

## 2. Inverted-V

### 2.1 Geometry Definition

- **Apex Location:** Highest point at $(0, 0, \text{height})$.
- **Leg Count & Length:** 2 legs, total radiating length $L$ (sum of both legs).
- **Reference Length:** $0.485\lambda$ (Resonance).
- **Angle/Slope:** Included angle $\alpha$ between legs (Default 120°). Mapping: $\alpha$ is the angle in the vertical plane.
- **Tips:** Symmetric endpoints at $z = \text{height} - (L/2) \cdot \cos(\alpha/2)$.
- **Min Height:** Tip height must be $\ge 0.1$ m.

### 2.2 Feedpoint Definition

- **NEC Excitation:** 1-segment "source bridge" (Tag 3) at apex.
- **Segment:** Segment 1 of Tag 3.
- **Feed Type:** Balanced bridge segment.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable).

### 2.3 Termination Definition

- **Model:** None.

### 2.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR.

### 2.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$ minimum.
- **Minimum:** 9 segments per radiating leg.
- **Alignment:** Legs should have equal segments. Bridge is exactly 1 segment.

### 2.6 Glossary

- Same as Section 1.6.

---

## 3. Sloping V (Terminated)

### 3.1 Geometry Definition

- **Apex Location:** Highest point at $(0, 0, \text{height})$.
- **Leg Count & Length:** 2 legs, length $L$ **per leg** (Total radiating wire $2L$).
- **Reference Length:** $2.0\lambda$ per leg (Traveling wave directivity).
- **Angle/Slope:** Included angle $\alpha$ (between legs) and slope angle $\theta$ (below horizontal).
- **Tips:** Endpoints at ground-ward end of legs.
- **Min Height:** Tip height must be $\ge 0.1$ m.

### 3.2 Feedpoint Definition

- **NEC Excitation:** 1-segment source bridge at apex.
- **Segment:** Segment 1 of bridge.
- **Feed Type:** Balanced bridge segment.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable).

### 3.3 Termination Definition

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

### 3.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Statement:** Traveling wave antennas often have high raw SWR (e.g., 600 Ω feed). Raw SWR graph reflects this mismatch, not termination quality.

### 3.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$ minimum.
- **Minimum:** 9 segments per radiating leg.

### 3.6 Glossary

- Same as Section 1.6.

---

## 4. Delta Loop

### 4.1 Geometry Definition

- **Apex Location:** Highest point at $(0, 0, \text{height})$.
- **Leg Count & Length:** 3 wires forming a triangle, total perimeter $L$.
- **Reference Length:** $1.03\lambda$ (Resonance).
- **Angle/Slope:** Equilateral triangle in the vertical plane.
- **Tips:** Bottom corners.
- **Min Height:** Bottom wire must be $\ge 0.1$ m above ground.

### 4.2 Feedpoint Definition

- **NEC Excitation:** Center of the bottom horizontal wire (Tag 2).
- **Segment:** Center segment of Tag 2.
- **Feed Type:** Single-segment voltage source.
- **Feedline Support:** Supported (Radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable).

### 4.3 Termination Definition

- **Model:** None.

### 4.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR.

### 4.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$.
- **Minimum:** 9 segments per side.
- **Alignment:** Bottom wire should have an **odd** number of segments for center feed.

### 4.6 Glossary

- Same as Section 1.6.

---

## 5. Terminated Delta (T2FD / aperiodic loop)

### 5.1 Geometry Definition

- **Apex Location:** Highest point at $(0, 0, \text{height})$.
- **Leg Count & Length:** 3 wires forming a triangle, total perimeter $L$. The bottom wire is split at the centre, so the structure is emitted as two top legs + two half-base wires + one bridge wire across the gap (when terminated).
- **Reference Length:** $1.0\lambda$ canonical, but resonance is not the design goal: a properly bridged termination flattens impedance across an octave or more, so the antenna is used multi-band rather than at a single design frequency.
- **Angle/Slope:** Equilateral triangle in the vertical plane (flattens to isosceles when the mast height is below the equilateral height; perimeter preserved).
- **Tips:** Bottom corners. The bottom wire is split at the centre with a gap (`TERMINATED_DELTA_CENTRE_GAP_M`).
- **Min Height:** Bottom wire must be $\ge 0.1$ m above ground.

### 5.2 Feedpoint Definition

- **NEC Excitation:** Last segment of the LEFT leg (at the apex) when no feedline is fitted; 1-segment apex bridge when a feedline is present.
- **Feed Type:** Apex feed (balanced).
- **Feedline Support:** Supported (radiating shield + NEC `TL` card; feedpoint always at apex, offset is not applicable). A 9:1 (or similar) unun is typically required at the rig end to bring the ~500–900 Ω feedpoint Z down to ~50 Ω.

### 5.3 Termination Definition

- **Topology:** A single horizontal _bridge wire_ spans the gap between the two half-base inner ends. The terminating resistor sits on that bridge. This is the canonical T2FD / aperiodic-loop topology.
- **NEC Model:** One `LD 4` load on the single segment of `TERMINATED_DELTA_BRIDGE_TAG`. No vertical stubs, no ground shunts.
- **Value:** `terminatingResistor` should be close to the loop wire's characteristic impedance over real ground, $Z_0 \approx 60 \ln(2h/a) \approx 500\text{--}700\,\Omega$. Default is 600 Ω.
- **What this is NOT:** Not a unidirectional travelling-wave antenna. The geometry is bilaterally symmetric, so by symmetry the pattern is bidirectional/broadside (delta-loop-like). The termination buys broadband flat impedance, not directionality. For a unidirectional cardioid you need an asymmetric topology (e.g. corner-fed/corner-terminated K9AY-style), which this app does not currently model.

### 5.4 SWR Convention

- **Reference:** 50.0 Ω.
- **Metric:** Raw feedpoint SWR.

### 5.5 Segmentation Rules

- **Density:** 20 segments per $\lambda$.
- **Minimum:** 9 segments per side.
- **Alignment:** Base is split into two halves.

### 5.6 Glossary

- Same as Section 1.6.

---


## 6. Vertical Whip

### 6.1 Geometry Definition

- **Shape:** A single vertical wire extending upwards from the base.
- **`height` parameter:** The height of the base above ground (metres). Defaults to an elevated position of 8 meters.
- **`length` parameter:** The length of the vertical wire (metres).
- **Orientation:** Not applicable (omnidirectional).
- **Base:** The vertical wire starts at `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) above `height` to ensure electrical isolation from the ground unless a counterpoise is used.
- **Reference length:** ¼λ (quarter-wave monopole).

### 6.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of `VERTICAL_WHIP_TAG` (12) — the lowest segment at the base.
- **Feed Type:** Base-fed monopole (unbalanced). Coax shield connects at the base; the antenna is driven against the ground / counterpoise.
- **Feedline Support:** Not modelled. The feedline is treated as ideal.

### 6.3 Counterpoise

- **Model:** When enabled, `VERTICAL_WHIP_RADIAL_COUNT` (4) horizontal ¼λ radials fan out from the base at equal azimuth spacing, tagged `VERTICAL_WHIP_RADIAL_TAG` (13).
- **Without counterpoise:** The source has no proper return path; NEC reports the high reactance and SWR that a radial-less base-fed antenna physically exhibits.

### 6.4 SWR Convention

- **Reference:** 50 Ω.
- **Notes:** A resonant ¼λ vertical over a good ground plane presents roughly 36 Ω.

### 6.5 Segmentation Rules

- **Density:** 20 segments per λ minimum for the whip and each radial.
- **Minimum:** 9 segments (`MIN_SEGS_PER_LEG`) per wire.
- **Whip and radials are emitted as separate `Wire` objects**, tagged independently.

### 6.6 Glossary

- Same as Section 1.6.

---

## 7. Inverted-L

### 7.1 Geometry Definition

- **Shape:** Two wire segments forming an L: a vertical section from the base up to the bend point, followed by a horizontal top-loading section extending outward at right angles.
- **`height` parameter:** Bend-point height above ground (metres). This equals the length of the vertical section (base gap excluded). Controls how tall the mast needs to be.
- **`length` parameter:** Total wire length (vertical + horizontal combined, metres). The horizontal section absorbs any length beyond the vertical section: $L_{horiz} = L_{total} - L_{vert}$.
- **Orientation:** Azimuth direction the horizontal section runs.
- **Base:** The vertical wire starts at `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) above ground — same electrical isolation as the vertical whip.
- **Bend junction:** The end of the vertical wire and the start of the horizontal wire share an exact coordinate so NEC creates a proper wire junction.
- **Reference length:** ¼λ total (same as a quarter-wave vertical); the horizontal section provides the electrical length the mast height falls short of.

### 7.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of `INVERTED_L_VERTICAL_TAG` (14) — the lowest segment at the base of the vertical section.
- **Feed Type:** Base-fed monopole (unbalanced). Coax shield connects at the base; the antenna is driven against the ground / counterpoise.
- **Feedline Support:** Not modelled (same convention as vertical whip). The feedline is treated as ideal.

### 7.3 Counterpoise

- **Model:** When enabled, `VERTICAL_WHIP_RADIAL_COUNT` (4) horizontal ¼λ radials fan out from the base at equal azimuth spacing, tagged `INVERTED_L_RADIAL_TAG` (16). Identical pattern to the vertical whip's counterpoise.
- **Without counterpoise:** The source has no proper return path; NEC reports the high reactance and SWR that a radial-less base-fed antenna physically exhibits.

### 7.4 SWR Convention

- **Reference:** 50 Ω.
- **Notes:** A resonant ¼λ inverted-L over a good ground presents roughly 30–50 Ω — a usable direct coax match. Feedpoint impedance varies with height, horizontal-section fraction, and ground quality. The vertical-section fraction has a stronger influence on the radiation pattern (more vertical component → more omnidirectional; more horizontal component → slight gain asymmetry in the horizontal-section direction).

### 7.5 Segmentation Rules

- **Density:** 20 segments per λ minimum for each section independently.
- **Minimum:** 9 segments per section (`MIN_SEGS_PER_LEG`).
- **Vertical and horizontal sections are emitted as separate `Wire` objects**, tagged independently so current-ripple diagnostics can distinguish them.

### 7.6 Glossary

- Same as Section 1.6.

---

## 8. Folded Dipole

### 8.1 Geometry Definition

- **Shape:** Two parallel half-wave conductors joined at both ends, forming a narrow rectangular loop in the vertical plane. The bottom (fed) conductor sits at `z = height`; the top (un-fed) conductor sits at `z = height + aperture`. The connectors are short vertical wires at each end. The overall structure is fully buildable at a modest height — the top conductor only rises `aperture` (≤ 0.5 m) above the feedpoint, unlike a vertical loop.
- **`length` parameter:** Each conductor's length (metres). Reference length: ½λ (0.475λ with end-effect) — same as a standard dipole; the fold does not change the resonant length.
- **`foldedDipoleAperture` parameter:** Vertical spacing between the two parallel conductors (metres). Default 0.3 m. Clamped to [0.02 m, `FOLDED_DIPOLE_MAX_APERTURE_M` = 0.5 m]. The upper cap keeps the antenna a genuine folded dipole and, crucially, within the spacing range where NEC's close-parallel-wire solution converges inside `MAX_SEGS_PER_LEG` (see §8.5).
- **Orientation:** Azimuth the conductor axis runs. The aperture is in the vertical (Z) direction; changing the orientation rotates the axis in the horizontal plane but the top/bottom wire layout is preserved.
- **Fed conductor:** Split at its centre by a `FEED_BRIDGE_LENGTH_M` feed bridge (the two halves carry `DIPOLE_LEFT_TAG` / `DIPOLE_RIGHT_TAG`, the same split-fed convention as the standard dipole).
- **Min Height:** Bottom conductor at `z = height`; `height ≥ 0.1` m to avoid NEC `GE 1` instability. The top conductor is automatically at `z = height + aperture`.

### 8.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of `FEED_BRIDGE_TAG` (3) at the centre of the lower conductor — handled by the existing `hasBridge` excitation path.
- **Feed Type:** Single-segment voltage source on the bridge; balanced.
- **Feedline Support:** Not currently modelled (the antenna is balanced and typically fed via 300 Ω twin-lead or a 4:1 balun). The transformer/balun post-processing control is available.
- **Feedpoint Impedance:** Approximately 4× a plain dipole (~300 Ω) for equal-diameter conductors, largely independent of spacing. A 4:1 balun brings this to ~75 Ω; a 6:1 brings it to ~50 Ω for direct coax use. 300 Ω twin-lead matches it directly.

### 8.3 Termination Definition

- **Topology:** Optional. The opposite conductor is split into two halves at the centre. When terminated, a single `LD 4` resistor sits on a short horizontal bridge wire (`FOLDED_DIPOLE_TERM_BRIDGE_TAG`) that spans the gap between the two halves.
- **Unterminated (`terminatingResistor = 0`):** A classic folded dipole — ~300 Ω, narrowband, dipole gain and pattern.
- **Terminated (`terminatingResistor > 0`):** A terminated folded dipole (TFD). The resistor flattens SWR across a wide frequency range at the cost of efficiency (roughly half the power is dissipated). Typical value ~390–600 Ω. This is the straight-conductor cousin of the T2FD modelled under §5 as a terminated delta.

### 8.4 SWR Convention

- **Reference:** 50 Ω.
- **Statement:** Raw SWR against 50 Ω is high (~6:1) for the unterminated ~300 Ω feedpoint. A 6:1 impedance-transforming balun is **enabled by default** when this antenna type is selected, transforming the feedpoint to ~50 Ω and showing the characteristic flat broadband SWR curve. The terminated variant (TFD) shows an even flatter curve, reflecting the resistive termination rather than improved efficiency.

### 8.5 Segmentation Rules

- **Target segment length:** `min(λ / 20, aperture / 2)`. NEC's thin-wire kernel loses accuracy for closely-spaced parallel wires once the segment length grows much larger than the wire separation; tying the segment length to half the aperture is the empirical point at which the free-space gain converges to the dipole value. All segment counts derive from this single target length, capped at `MAX_SEGS_PER_LEG` (100). This is also why the aperture is capped at 0.5 m — wider spacings would need more than 100 segments to converge.
- **Minimum:** 9 segments (`MIN_SEGS_PER_LEG`) per fed half-conductor and for each half of the opposite conductor.
- **Alignment:** The opposite conductor is always split into two symmetric halves (each with the same segment count) around the centre. The fed conductor is split into two halves around the 1-segment feed bridge.
- **Wires:** 7 wires total — fed-conductor left half, feed bridge, fed-conductor right half, opposite conductor left half, opposite conductor right half, and the two end connectors across the aperture (shared `FOLDED_DIPOLE_CONNECTOR_TAG`). An 8th wire (the termination bridge) is added when terminated.

### 8.6 Gain

- **Unterminated:** Identical to a standard dipole (~2.15 dBi in free space) at narrow apertures. The fold is an impedance transformation, not a gain mechanism.
- **Wide aperture:** As the spacing grows toward a notable fraction of a wavelength, the two in-phase conductors begin to act as a broadside two-element array and the pattern departs from a simple dipole.
- **Terminated:** Lower than a plain dipole — the terminating resistor dissipates a substantial fraction of the input power (the broadband-vs-efficiency trade).

### 8.7 Glossary

- Same as Section 1.6.
