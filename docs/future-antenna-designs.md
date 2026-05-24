# Future Antenna Designs

Antenna types desired for future implementation. Each entry notes the key geometry and what makes it distinct from existing designs.

---

## Folded Dipole

Half-wave dipole where both ends are connected by a second parallel conductor, forming a narrow rectangular loop. Feed impedance is ~300 Ω (4× a standard dipole), making it a natural match for 300 Ω twin-lead. Gain and pattern are identical to a dipole. Geometry requires two parallel wires joined at their ends with short connecting segments.

## Horizontal Loop (Skyloop)

Full-wave loop laid out horizontally (parallel to ground). Typically square or rectangular. At low heights it produces a high-angle NVIS pattern; at greater heights the pattern develops low-angle gain. The four-sided geometry requires corner wires and a flexible aspect-ratio parameter for square vs. rectangular configurations.

## Lazy-H / Collinear Stack

Two half-wave dipoles stacked vertically and fed in phase via a half-wave phasing stub. Adds approximately 3 dB of broadside gain over a single dipole by narrowing the elevation pattern. Requires a stacking height parameter and a phasing line modelled as a transmission line (TL card) between the two driven elements.
