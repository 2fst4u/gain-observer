
## 2024-05-18 - Expensive 3D computations in tight loops
**Learning:** In Three.js geometry generation, recalculating vertex angles (spherical coordinates from Cartesian) for `thetaDeg` and `phiDeg` on every frame or state change can be significantly expensive and redundant, especially when LOD details stay the same. Caching these arrays separately from visual attributes drastically improves performance.
**Action:** When mapping scalar data to 3D meshes (like antenna radiation patterns), cache structural calculations (like vertex spherical angles) separately from dynamic visual state (like colors or scale) using separate `useMemo` hooks.
