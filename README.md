# HF Antenna Gain Visualiser

**[www.gain.observer](https://www.gain.observer/)**

A 3D, physics-accurate visualiser for HF antenna radiation patterns, powered by
NEC-2 compiled to WebAssembly.

Pick an antenna, set your frequency, height and ground, and see the pattern it
actually radiates — in 3D, with elevation and azimuth cuts, SWR across the band,
and a comparison mode for putting two configurations side by side. The NEC-2
engine runs entirely in your browser; nothing is uploaded, and there is nothing
to install.

## Using it

Open **[www.gain.observer](https://www.gain.observer/)**. That's it — it runs on
phones, tablets and desktops, and works offline once loaded.

Keyboard shortcuts:

- **`t`** — toggle dark/light theme
- **`u`** — toggle metric/imperial units
- **`m`** — toggle between normal and comparison mode

## What it models

Dipoles, inverted-V, sloping-V, inverted-L, vertical whips, folded dipoles,
delta loops and terminated deltas, from 1.8–30 MHz, over real ground.
`docs/antenna-spec.md` describes the geometry and physics of each in detail.

## About the project

This is a hosted application first. The source is open under GPL v3 and you are
welcome to read, fork or run it, but it is built and maintained to be used at
the link above rather than self-hosted, and the documentation is written with
that reader in mind.

It is GPL v3 because it statically links `nec2c` (by N. Kyriazis), which is
itself GPL v3. See LICENSE for the full text.
