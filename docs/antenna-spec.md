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

## 6. Inverted-L

### 6.1 Geometry Definition

- **Shape:** Two wire segments forming an L: a vertical section from the base up to the bend point, followed by a horizontal top-loading section extending outward at right angles.
- **`height` parameter:** Bend-point height above ground (metres). This equals the length of the vertical section (base gap excluded). Controls how tall the mast needs to be.
- **`length` parameter:** Total wire length (vertical + horizontal combined, metres). The horizontal section absorbs any length beyond the vertical section: $L_{horiz} = L_{total} - L_{vert}$.
- **Orientation:** Azimuth direction the horizontal section runs.
- **Base:** The vertical wire starts at `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) above ground — same electrical isolation as the vertical whip.
- **Bend junction:** The end of the vertical wire and the start of the horizontal wire share an exact coordinate so NEC creates a proper wire junction.
- **Reference length:** ¼λ total (same as a quarter-wave vertical); the horizontal section provides the electrical length the mast height falls short of.

### 6.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of `INVERTED_L_VERTICAL_TAG` (14) — the lowest segment at the base of the vertical section.
- **Feed Type:** Base-fed monopole (unbalanced). Coax shield connects at the base; the antenna is driven against the ground / counterpoise.
- **Feedline Support:** Not modelled (same convention as vertical whip). The feedline is treated as ideal.

### 6.3 Counterpoise

- **Model:** When enabled, `VERTICAL_WHIP_RADIAL_COUNT` (4) horizontal ¼λ radials fan out from the base at equal azimuth spacing, tagged `INVERTED_L_RADIAL_TAG` (16). Identical pattern to the vertical whip's counterpoise.
- **Without counterpoise:** The source has no proper return path; NEC reports the high reactance and SWR that a radial-less base-fed antenna physically exhibits.

### 6.4 SWR Convention

- **Reference:** 50 Ω.
- **Notes:** A resonant ¼λ inverted-L over a good ground presents roughly 30–50 Ω — a usable direct coax match. Feedpoint impedance varies with height, horizontal-section fraction, and ground quality. The vertical-section fraction has a stronger influence on the radiation pattern (more vertical component → more omnidirectional; more horizontal component → slight gain asymmetry in the horizontal-section direction).

### 6.5 Segmentation Rules

- **Density:** 20 segments per λ minimum for each section independently.
- **Minimum:** 9 segments per section (`MIN_SEGS_PER_LEG`).
- **Vertical and horizontal sections are emitted as separate `Wire` objects**, tagged independently so current-ripple diagnostics can distinguish them.

### 6.6 Glossary

- Same as Section 1.6.

---

## 7. Vertical Whip

### 7.1 Geometry Definition

- **Shape:** A single vertical wire.
- **`height` parameter:** The starting base height of the vertical wire (metres). Typically near zero but gapped slightly (`VERTICAL_WHIP_BASE_GAP_M`, 0.01 m) above ground to maintain electrical isolation unless explicitly modelling a grounded monopole.
- **`length` parameter:** Total length of the vertical wire (metres).
- **Base:** The vertical wire starts at `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) above `height`.
- **Top:** The wire extends to `height + length`.

### 7.2 Feedpoint Definition

- **NEC Excitation:** Segment 1 of the vertical wire (Tag `VERTICAL_WHIP_TAG`, 12) — the lowest segment at the base.
- **Feed Type:** Base-fed monopole (unbalanced). Coax shield connects at the base.
- **Feedline Support:** Not modelled. The feedline is treated as ideal.

### 7.3 Counterpoise

- **Model:** When enabled, `VERTICAL_WHIP_RADIAL_COUNT` (4) horizontal ¼λ radials fan out from the base at equal azimuth spacing, tagged `VERTICAL_WHIP_RADIAL_TAG` (13).
- **Without counterpoise:** The source has no proper return path; NEC reports the high reactance and SWR that a radial-less base-fed antenna physically exhibits.

### 7.4 SWR Convention

- **Reference:** 50 Ω.
- **Notes:** Feedpoint impedance depends heavily on the length of the vertical whip, the presence and quality of radials, and ground conductivity.

### 7.5 Segmentation Rules

- **Density:** 20 segments per λ minimum.
- **Minimum:** 9 segments for the vertical whip and each radial.

### 7.6 Glossary

- Same as Section 1.6.
