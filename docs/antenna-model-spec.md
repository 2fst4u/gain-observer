# Antenna Physics and Modeling Specification

This document defines the stable reference for antenna geometry, coordinate systems, and physics definitions used in the HF Gain Visualizer. All future implementation work must adhere to these specifications to ensure consistency.

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

## 2. Antenna Type Definitions

### 2.1 Dipole

- **Structure**: A single straight horizontal wire or two collinear wires.
- **Length**: The total end-to-end physical length.
- **Height**: The Z-coordinate of the wire(s).
- **Feedpoint**: Center-fed (split at the midpoint).
- **Balanced**: Yes.

### 2.2 Inverted V

- **Structure**: Two wires sloping down from a common central apex.
- **Apex Height**: The height parameter refers to the apex (highest point).
- **Length**: The total wire length (sum of both legs).
- **Angle**: Usually defined by the "included angle" between the legs or the height of the ends.
- **Feedpoint**: The apex.
- **Balanced**: Yes.

### 2.3 Sloping V (Terminated or Unterminated)

- **Structure**: Two wires forming a V-shape, typically sloping from a high feedpoint toward the ground or lower supports.
- **Length**: Refers to the length of a **single leg**.
- **Height**: Refers to the height of the feedpoint (apex).
- **Included Angle**: The angle between the two legs in the plane of the V.
- **Feedpoint**: The apex.
- **Termination Support**: Supports termination at the far ends of the legs.

### 2.4 Delta Loop

- **Structure**: A triangular loop of wire.
- **Length**: The total perimeter of the loop.
- **Configuration**: Apex-up or Apex-down.
- **Height**: Typically the height of the highest point (apex or top wire).
- **Feedpoint**: Center of the bottom wire (for horizontal polarization) or $1/4 \lambda$ from the apex (for vertical polarization).
- **Balanced**: Yes (if fed at center of a side).

### 2.5 Terminated Delta

- **Structure**: A triangular loop of wire, split at the centre of the base, with a single horizontal _bridge wire_ spanning the gap. The terminating resistor sits on the bridge (T2FD / aperiodic-loop topology).
- **Length**: The total perimeter of the loop.
- **Height**: The highest point (apex).
- **Feedpoint**: The apex.
- **Termination Support**: A single resistor across the base-centre gap (not two resistors to ground). Designed for broadband flat impedance, not directionality — the antenna remains roughly broadside-bidirectional, like a delta loop but aperiodic.

### 2.6 Vertical Whip

- **Structure**: A single vertical wire extending upwards from the base.
- **Length**: The length of the vertical wire.
- **Height**: The height of the base above ground (defaults to an elevated position of 8 meters).
- **Feedpoint**: Base-fed.
- **Balanced**: No (unbalanced, driven against ground or radials).

### 2.7 Inverted-L

- **Structure**: A vertical wire section from the base up to a bend point, followed by a horizontal top-loading section.
- **Length**: Total wire length (vertical + horizontal combined).
- **Height**: The bend-point height above ground.
- **Feedpoint**: Base-fed on the vertical section.
- **Balanced**: No.

### 2.8 Folded Dipole

- **Structure**: Two parallel half-wave conductors joined at both ends, forming a narrow rectangular loop.
- **Length**: The length of each conductor.
- **Height**: The height of the bottom fed conductor.
- **Feedpoint**: Center-fed on the bottom conductor.
- **Balanced**: Yes.

---

## 3. "Terminated" Antennas

### 3.1 Physical Meaning

A **terminated** antenna places a non-inductive resistive load somewhere on the radiating structure to absorb the wave that would otherwise reflect and form a standing wave. Two distinct families exist in this app, and they behave very differently:

- **Asymmetric travelling-wave terminations** (Sloping V): the wave travels along a single asymmetric path, with the terminator at the far end. Result: cardioid pattern, broadband, unidirectional.
- **Symmetric aperiodic loop terminations** (Terminated Delta, T2FD-style): the wave propagates around a closed loop from a symmetric feed point and is absorbed at a symmetric point opposite the feed via a single resistor _bridging the gap_ (not shunted to ground). Result: bidirectional/broadside-ish pattern, broadband flat impedance, **not** unidirectional. Trades efficiency for flat SWR across an octave.

### 3.2 Termination Implementation

- **Sloping V**: Termination consists of a resistor connected from the end of each leg to ground via a short stub wire. Typical value $300\text{--}600\,\Omega$ (matches the leg's characteristic impedance against ground).
- **Terminated Delta**: Termination is a single resistor on a short horizontal _bridge wire_ spanning the gap at the centre of the base. Typical value $\sim 600\,\Omega$ (close to the loop wire's characteristic impedance over typical HF heights, $Z_0 \approx 60 \ln(2h/a) \approx 500\text{--}700\,\Omega$). **Not** two resistors to ground — that topology is symmetric but fails to terminate the loop, leaving large reactive feedpoint impedance and high leg current ripple.
- **Effect (sloping V)**: converts a resonant bi-directional radiator into a broadband uni-directional travelling-wave radiator.
- **Effect (terminated delta)**: converts a resonant narrowband loop into a broadband aperiodic loop. Pattern stays roughly delta-loop-shaped (broadside max, end-fire minimum). Multi-band usable with a 9:1 unun.

### 3.3 Termination vs. Matching

- **Crucial Distinction**: A "correctly terminated" antenna **does not** imply a $50\,\Omega$ feedpoint SWR.
- The termination resistor is chosen to match the **antenna wire's characteristic impedance** to ground to prevent reflections on the wire itself.
- The resulting feedpoint impedance may still be high (e.g., $400\text{--}800\,\Omega$) and will likely require a transformer (Balun/Unun) to match to $50\,\Omega$ coax.

---

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

---

## 5. Invalid Modeling Patterns to Avoid

1.  **Grounded Tips at Z=0**: Do not end wires at $Z=0$ unless intentionally modeling a grounded structure. For real ground, wires should typically end at a small height (e.g., $0.001\text{--}0.1\,\text{m}$) or use the NEC-2 ground connection cards correctly if implemented.
2.  **Silent Geometry Clamping**: If a user enters a height or length that is physically impossible or violates NEC constraints (e.g., segment length/radius ratio), do not silently change the value in the physics engine without reflecting this in the UI.
3.  **Inconsistent Termination**: Do not mix "per-leg-to-ground" termination and "across-tip" termination in the same antenna model unless it is a specific, documented hybrid type.
4.  **SWR-based Proof of Termination**: Never use a low SWR alone as "proof" that an antenna is correctly terminated. A resonant antenna can have $1:1$ SWR, but it is not "terminated" in the travelling-wave sense. Termination must be verified by inspecting the current distribution (lack of standing wave) and front-to-back ratio.
