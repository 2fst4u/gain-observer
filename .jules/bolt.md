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

## 2025-05-18 - Precompute Elevation-Dependent Math Outside Hot Loops

**Learning:** In the propagation physics engine (`predictPropagation`), estimating MUF and calculating hop range involves expensive operations like `Math.asin`, `Math.cos`, and custom scaling. Calculating this for every combination of azimuth (`phi`) and elevation (`theta`) (i.e. $O(P \times T)$) is highly redundant because these geometric constraints depend _only_ on the elevation angle.
**Action:** Precompute these elevation-dependent metrics (MUF, range, path status) into a 1D array (`baseRays[theta]`) first. Inside the $O(P \times T)$ loop, simply combine the precomputed ray with the direction-specific gain. This optimization changes expensive math from $O(P \times T)$ to $O(T)$ plus simple assignments, significantly improving rendering and sweep speed.

## 2025-05-18 - Maintainability in Inner Loops

**Learning:** Reconstructing complex state strings (like `LinkQuality`) from integer rank metrics (like `0`/`1`/`2`) inside an inner loop using ternary operators is brittle and presents a maintainability hazard. If rank values or the states they represent ever evolve, the hardcoded ternary mappings become bugs.
**Action:** Instead of dynamically reconstructing states from arbitrary integer ranks, simply maintain explicit variables representing the best actual states found along with the rank used for comparison (e.g. `let bestLinkQuality: LinkQuality = 'unusable'`). This completely eliminates brittle conversions and avoids logic duplication later when producing output.

## 2024-05-17 - Optimize multiple Zustand selectors with useShallow

**Learning:** Selecting multiple separate fields from a Zustand store using separate `useStore(s => s.field)` calls incurs significant React hook overhead in highly-re-rendering components.
**Action:** When a component needs to select many fields from the store (e.g. 18 separate values), group them into a single object returned from a single hook call wrapped in `useShallow` from `zustand/react/shallow`. This cuts down overhead and batches state checks efficiently.

## 2025-05-18 - Replacing JSON.stringify with shallow object comparison

**Learning:** Checking for state changes by stringifying deep, derived objects like `SimulationInput` using `JSON.stringify` inside hot hooks (e.g. `usePhysicsEngine` subscription) creates severe memory allocation and execution time overhead (~300ms vs ~14ms per 100k runs). However, replacing it with a string concatenation of raw scalar dependencies can be a maintenance trap (violates DRY if fields change).
**Action:** When comparing objects from selectors, avoid `JSON.stringify`. Instead, perform a shallow iteration over the object's keys and compare values (`a[k] !== b[k]`), provided the returned object is functionally flat or correctly structured. This maintains the speed benefits of avoiding JSON processing while preserving the safety and maintainability of centralized selector functions.
