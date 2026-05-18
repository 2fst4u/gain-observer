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
- **Topology:** Differential resistor between the two leg tips.
- **Diagram:**
  ```
       Apex (Feed)
          / \
         /   \
        /     \
      Tip-----R-----Tip
  ```
- **NEC Model:** Single `LD 4` load on a 1-segment non-radiating bridge wire between tips.
- **Value:** `terminatingResistor` is the **total** differential resistance.
- **Return Path:** No return to ground. Explicitly rejects vertical drop wires or independent ground terminations.

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
