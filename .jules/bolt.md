
## 2024-05-18 - Expensive 3D computations in tight loops
**Learning:** In Three.js geometry generation, recalculating vertex angles (spherical coordinates from Cartesian) for `thetaDeg` and `phiDeg` on every frame or state change can be significantly expensive and redundant, especially when LOD details stay the same. Caching these arrays separately from visual attributes drastically improves performance.
**Action:** When mapping scalar data to 3D meshes (like antenna radiation patterns), cache structural calculations (like vertex spherical angles) separately from dynamic visual state (like colors or scale) using separate `useMemo` hooks.
## 2025-02-18 - Pre-allocate Arrays in Polar Plot Generation
**Performance Issue:** Dynamic array resizing via `out.push(...)` in `cutAzimuth` and `cutElevation` inside `src/components/Charts/PolarPlots.tsx` caused significant memory overhead and slowdowns when called frequently during polar chart rendering.
**Optimization:** Replaced `[]` and `push` with `new Array(size)` and populated elements using a standard `for` loop and index assignments. This eliminates reallocation and pushes array creation performance from ~361ms down to ~138ms in synthetic benchmarking.
**Action:** Always pre-allocate arrays when the exact final size is known upfront, especially in chart generation or rendering loops.

## 2024-05-18 - Optimized Zenith Gain Fetch
**Learning:** In spherical coordinates used by the NEC-2 engine (theta=0 at zenith), the direction vector is straight up regardless of the azimuth (phi) step.
**Action:** Replace $O(N)$ averaging loops over `phi` at zenith with a direct $O(1)$ sample from `data[0]` to fetch the gain faster, avoiding redundant memory reads in the JS engine.
## 2025-02-18 - [Batching WebAssembly Engine Execution]
**Learning:** Instantiating the Emscripten WASM module and interacting with its virtual filesystem repeatedly inside a `for` loop (as seen in sequential sweeps) is a major performance bottleneck due to the engine's internal concurrency lock and initialization overhead.
**Action:** Always batch related simulations at the lowest possible layer. For the NEC-2 engine, this means generating a single input deck using the `FR` card's linear sweep capability (`FR 0 nfreq ...`) and parsing the multiple concatenated outputs in a single execution context.
## 2025-03-02 - Hot Loop Math and Inlining Optimization in 3D Rendering
**Learning:** In hot loops such as 3D geometry and color computation (like `RadiationPattern.tsx`), function calls and certain math functions incur high overhead when invoked millions of times per frame. `Math.pow(10, x)` is measurably slower than calculating the precomputed natural exponential `Math.exp(x * (Math.LN10 / 20))`. Additionally, inlining simple linear interpolation or condition checks inside hot loops avoids function stack overhead, yielding up to a 20-25% performance improvement in heavy 3D visualizations.
**Action:** Always precompute invariant scaling factors outside of hot loops and prefer `Math.exp()` with an `LN10` scale over `Math.pow(10, ...)` for power calculations. Inline simple value clamping and mapping logic rather than calling utility functions during inner rendering loops.
## 2025-05-05 - Avoid Math.hypot in bounded rendering loops
**Learning:** `Math.hypot` is significantly slower than doing a manual sum of squares and `Math.sqrt`, especially in V8 and other modern JS engines. The overhead of handling an arbitrary number of arguments and ensuring protection against overflow/underflow makes `Math.hypot` roughly 10-12x slower than standard `Math.sqrt(x*x + y*y + z*z)` when iterating over thousands of vertices.
**Action:** Always prefer `Math.sqrt` with manual squaring for simple 2D or 3D distance calculations in tight rendering or geometry loops where numbers are bounded (e.g. unit sphere coordinates). Avoid this optimization for unbounded numeric domains like complex magnitude or impedance calculations, where `Math.hypot`'s overflow/underflow protections are necessary.
## 2025-05-18 - Replacing memory-heavy string splitting with regex loop
**Learning:** For extremely large text payloads like 65,000-line NEC output files, using `text.slice(index).split('\n')` to process line-by-line causes huge memory allocations, GC pressure, and noticeably slows down parsing. A global regex using `gm` flag and maintaining state via `lastIndex` inside a `while (m = regex.exec(text))` loop allows zero-copy, in-place string matching.
**Action:** When extracting tabular data or structured data blocks from megabyte-sized strings, avoid `split('\n')` entirely. Prefer bounded `indexOf` searches or pre-compiled global `RegExp` objects leveraging `lastIndex` for iterative parsing.
