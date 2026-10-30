# Antenna geometry and physical model

This document describes the implemented model and its accuracy boundaries.
NEC-2 solves a thin-wire electromagnetic problem; geometry, materials, feed
networks and post-processing must also be validated. A plausible pattern or low
SWR is not proof of an accurate model.

## Coordinates and physical configuration

Internal lengths are metres, frequencies MHz, conductivity S/m, impedance ohms
and admittance siemens. NEC uses Z up, X east and Y north. Its θ angle is measured
from zenith; elevation is 90°−θ. Its azimuth φ is counterclockwise from east;
compass bearing is (90°−φ) mod 360°. The scene maps NEC (x,y,z) to (x,z,−y).

Operating frequency and design frequency are separate. Counterpoise dimensions
are fixed at design frequency and retained while tuning. Explicit antenna
design actions reset those dimensions. Segmentation can change with frequency
without moving physical endpoints. Captured comparisons retain the complete
physical and matching configuration. Rendering shares the solver wire builder.

## Antenna topologies

| Type | Dimensions and source | Optional termination |
|---|---|---|
| Dipole | Horizontal length L, centre height h; centre or offset feed. Default L≈0.475λ. | None |
| Inverted V | Descending legs, total length L; source bridge at apex h. Included angle is in the vertical plane and widens if necessary to keep tips above their floor. Default L≈0.485λ. | None |
| Sloping V | Two long legs; h is feed height, orientation is boresight, included angle is in azimuth. Tips approach 0.5 m when geometry permits. Default total length≈2λ. | Equal series resistors in downleads to two elevated radial screens |
| Delta loop | Isosceles triangle with perimeter L and apex height h; equilateral when height permits. Fed near the apex. Default perimeter≈λ. | None |
| Terminated delta | Same triangular layout, with a centre gap in the base. | One series resistor across the base gap; zero setting leaves the gap open |
| Vertical whip | Vertical wire length L; h is base height. Source on lowest segment. | Four horizontal radials of length 0.2375λ at design frequency |
| Inverted L | Vertical section plus horizontal top wire; L is total length and h is bend height. Base-fed. | Same radial option as whip |
| Folded dipole | Equal-radius parallel conductors of length L, joined at both ends; h is lower-wire height, aperture is vertical separation. Lower centre fed. Default L≈0.475λ, aperture 0.3 m. | Series resistor in the opposite conductor's centre |

A loop resistor is a link in the loop, not two shunts to earth. Sloping-V screens
are explicit elevated wires, not galvanic soil connections. Termination can
reduce resonance or reflections while dissipating power; it does not guarantee
50-ohm matching, a particular bandwidth or a unidirectional pattern. Default
resistances are representative starting points rather than measured optima.

Whip and inverted-L feedlines are idealized. Without an explicit return conductor
or counterpoise, do not interpret their impedance as a complete real installation.

## Ground and conductors

Ground is free space, an infinite perfect conductor, or a flat homogeneous lossy
half-space with specified relative permittivity and conductivity, using
Sommerfeld–Norton ground. Terrain, layered soil, insulation, nearby structures
and buried ground systems are absent. Height zero selects free space for
nonvertical antenna types as a documented application convention.

The application explicitly models copper conductivity **58×10⁶ S/m**, through
NEC LD5 loading. Analytic engine callers may omit conductivity for ideal wires.

The near-ground modelling floor for real soil is 0.001 wavelength at the lowest
sweep frequency, 1 MHz: **0.2998 m**. It is fixed while tuning. Whip/L bases,
radials and eligible shield/screens use this elevated model; the height control
explains it. Free/perfect-ground geometry retains its separate conventions. A
wire close to real ground is not treated as a galvanic earth connection.

## Mesh and angular accuracy

Long wires target at least 20 segments per wavelength, with grading near small
source/load bridges. Adjacent segments need compatible lengths and adequate
length/radius aspect ratios. Mesh density alone does not guarantee accuracy.

Folded dipoles align longitudinal segment centres on both parallel conductors,
including corresponding source/termination cells. Centre-cell length is at most
0.1 m. The old silent 100-segment-per-half cap is removed; invalid thin-wire
aspects or excessive meshes raise errors. The 0.02–0.5 m UI aperture range is
not itself an accuracy guarantee.

The application uses a fixed **2° radiation grid**, independent of rendering
LOD. A low-power device can draw fewer vertices without changing its computed
gain, directivity or efficiency. Across every antenna type over perfect and
average ground at 14 MHz, the 2° grid matched 1° sampling to within 0.001 dB in
escaping efficiency and 0.01 dB in peak gain, at about a quarter of the
far-field work; 5° drifted by up to 0.04 dB. Engine callers choosing other grids must
account for sampling error. Tests check mesh convergence and power balance at
1.8, 7.1 and 30 MHz with folded apertures 0.02, 0.3 and 0.5 m. These reference
cases do not certify every arbitrary geometry, wire length and radius.

## Feed system

Differential cable signals use a nonradiating distributed two-port. Exposed
common-mode cable conductors are separate physical wires. Their explicit
route descends in a plane normal to the antenna: vertically, or inclined 10°
away from a loop plane so it cannot cross the base wire and form an accidental
electrical junction. When the cable is longer than the drop to ground
clearance, it turns 90° there and runs horizontally away from the antenna for
the rest of its length. It is an assumed visible route, not a measurement of an
installation's cable path.

Matched attenuation is the preset fit `(k1√f+k2f)·length/100` dB. With real cable
impedance Zc and propagation length γl=αl+jβl:

```
αl = matchedLossDb · ln(10) / 20
βl = 2π · electricalLength / wavelength
Y11 = Y22 = coth(γl)/Zc
Y12 = −csch(γl)/Zc
```

Attenuation changes both source impedance and power. Frequency-dependent cable
networks are recomputed at every sweep point. Ideal untransformed lossless lines
can use native TL cards; lossy/transformed lines use precise NT cards. An ideal
transformer is cascaded algebraically with the cable, avoiding an unintended
differential connection through its common-mode choke.

Transformer ratio n:1 is an impedance ratio: Z becomes Z/n. For reactive Z, the
continuous ratio minimizing reflection against a real Z0 is |Z|/Z0; permitted
integer candidates are compared. A transformer cannot cancel reactance. With
no actual modelled line, including zero-length/clipped cable, the transform is
applied in the display layer.

A fitted choke has representative common-mode resistance 2000 Ω; transformer
hardware adds representative insertion loss 0.2 dB. These are assumptions, not
measured broadband device responses. Cable presets likewise approximate uniform
TEM lines with real Zc; balanced-line common modes need more detailed geometry.

The mast-base ATU is an explicit two-reactance **L network**, with ESR |X|/Q
and shunt conductance |B|/Q, Q=150 for both components. Both orientations and
roots are considered, the finite-loss circuit is retuned toward a real 50 Ω
input, and component dissipation gives insertion loss. Unachievable matches
are not reported as 1:1. Component tuning ranges and power ratings are absent.

NEC gain already includes the up-mast cable loss. A separate **50 Ω RG-213**
main run, even with 450 Ω ladder line above the tuner, adds matched main-run
loss once. ATU sweep curves indicate independent retuning at each frequency;
they do not measure antenna bandwidth.

## Power and diagnostic definitions

NEC power gain is G=4πU/Paccepted. Linear average gain is
`<G>=(1/4π)∫G sinθ dθ dφ`, the fraction of accepted source power escaping to the
far field. Integrate the full sphere in free space, and the upper hemisphere
over ground, **half-weighting θ=90° only over ground**. Azimuth is periodic,
without duplicating the 360° endpoint. Peak directivity is Gmax/<G>.

- Far-field efficiency is the integrated pattern and includes soil absorption.
- Conductor/network efficiency is the NEC budget remainder after structure and
  network heat. NEC does not subtract environmental ground absorption there.
- Realized gain additionally accounts for source mismatch and display-side feed
  hardware. Results, polar cuts, 3D surfaces, comparisons and ray geometry share
  this adjustment and avoid deducting cable loss twice.

NEC structure loss includes copper and every LD resistor, including chokes.
Termination heat is attributed separately to designated resistors using
½|Ipeak|²R. Network heat includes cable loss. Diagnostic watts refer to the
model's 1 V peak excitation, not an assumed transmitter power.

Current envelope range is 20log10(max|I|/min|I|). Radiation, attenuation and
geometry vary the envelope even for a purely forward wave. This metric is
not a reflected-power fraction or a quantitative termination match.

## Ray geometry

The ray view reflects straight rays from a user-selected ideal spherical shell
(default 300 km) above a 6371 km Earth. For elevation ε and shell height h, the
one-hop surface arc is `2R[π/2−ε−asin(R cosε/(R+h))]`. Repeated illustrated arcs
reuse this geometry. The strongest lobe per bearing and its realized antenna
gain are shown.

There is **no ionospheric forecast, MUF, LUF, received SNR or availability
classification**. Real propagation needs frequency-dependent electron-density
profiles, refraction, absorption, path conditions and a transmitter/receiver/noise
link budget. True hmF2 is not a virtual reflection height. Manual latitude and
longitude provide approximate monthly solar-angle context only.

## Validation boundaries

Real-NEC tests include each topology in supported reference configurations,
conductor-loss checks, folded mesh convergence, analytic line/transformer/circuit
benchmarks, and sweep-versus-point consistency for identical hardware. No gain
normalization is used to conceal failed energy balance.

The choked radiating-shield feed of the terminated-delta family has an unresolved
numerical power-convergence defect. The engine rejects that combination rather
than presenting a trusted-looking result, and the terminated delta therefore
defaults to the choke off. Further work must establish both power
and impedance convergence, not tune a mesh to make one integral pass.

Thin-wire NEC-2, homogeneous ground, assumed cable routing and nominal hardware
remain modelling assumptions. Independent solvers and installation measurements
are needed before claiming installation-specific accuracy.

The shipped NEC loader/Wasm passed the numerical regressions but their original
source revision and compiler have not been recovered. Artifact hashes and the
verified-source requirements for future builds are recorded in
[`nec2-build/PROVENANCE.md`](../nec2-build/PROVENANCE.md). This limitation is not
resolved by assigning a guessed engine version or an unrelated upstream source.
