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

**Learning:** Instantiating the Emscripten WASM module and interacting with its virtual filesystem repeatedly inside a `for` loop (as seen in sequential sweeps) is a major performance bottleneck due the engine's internal concurrency lock and initialization overhead.
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

## 2025-05-18 - Batch Zustand React Hooks with useShallow

**Learning:** Selecting multiple separate fields from a Zustand store using individual `useAntennaStore((s) => s.field)` calls creates excessive subscriber listeners and hook allocation overhead, noticeably impacting rendering performance when global state properties update rapidly in complex UI controls.
**Action:** Use `useShallow` from `zustand/react/shallow` to group multiple properties into a single object return in one hook call. This pattern minimizes re-renders to only when the specific destructured fields change and reduces React hook lifecycle overhead.

## 2025-05-18 - Do not use shallow reference equality on selectors that allocate new objects

**Learning:** Shallow `!==` comparison (iterating `Object.keys`) only works correctly when the compared objects hold primitive values. When a selector like `selectSimulationInput` allocates new arrays and object literals on every call (e.g. `buildWires(state)`, `{ wireTag: ... }`, `buildGroundParams(state)`), every key comparison will be `true` regardless of the underlying data, causing `schedule()` to fire on every store update — worse than the original.
**Action:** Use `JSON.stringify` for change-detection on derived selector objects that contain nested arrays or objects. The cost is ~3μs per call, which is negligible at typical UI event rates (100 events/s = 300μs/s total). Only optimise this if profiling proves it to be a real bottleneck.

## 2024-05-30 - SWR Chart Aggregation Optimization

**Learning:** Using chained array methods (e.g., `[...arr.map()]`) to extract values for finding a max or min leads to excessive intermediate array allocations and slower performance, especially in `useMemo` hooks calculating values over arrays. Using a standard `for` loop to directly calculate these aggregates is up to ~10x faster and uses less memory.
**Action:** Replaced `.map()` and spread syntax with standard `for` loops in `xBounds` and `yMax` calculations in `SWRChart.tsx`.

## 2025-02-14 - O(1) Map Lookups for Static Presets

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

## 2025-05-18 - Batch Zustand React Hooks with useShallow

**Learning:** Selecting multiple separate fields from a Zustand store using individual `useAntennaStore((s) => s.field)` calls creates excessive subscriber listeners and hook allocation overhead, noticeably impacting rendering performance when global state properties update rapidly in complex UI controls.
**Action:** Use `useShallow` from `zustand/react/shallow` to group multiple properties into a single object return in one hook call. This pattern minimizes re-renders to only when the specific destructured fields change and reduces React hook lifecycle overhead.

## 2025-05-18 - Do not use shallow reference equality on selectors that allocate new objects

**Learning:** Shallow `!==` comparison (iterating `Object.keys`) only works correctly when the compared objects hold primitive values. When a selector like `selectSimulationInput` allocates new arrays and object literals on every call (e.g. `buildWires(state)`, `{ wireTag: ... }`, `buildGroundParams(state)`), every key comparison will be `true` regardless of the underlying data, causing `schedule()` to fire on every store update — worse than the original.
**Action:** Use `JSON.stringify` for change-detection on derived selector objects that contain nested arrays or objects. The cost is ~3μs per call, which is negligible at typical UI event rates (100 events/s = 300μs/s total). Only optimise this if profiling proves it to be a real bottleneck.

## 2024-05-30 - SWR Chart Aggregation Optimization

**Learning:** Using chained array methods (e.g., `[...arr.map()]`) to extract values for finding a max or min leads to excessive intermediate array allocations and slower performance, especially in `useMemo` hooks calculating values over arrays. Using a standard `for` loop to directly calculate these aggregates is up to ~10x faster and uses less memory.
**Action:** Replaced `.map()` and spread syntax with standard `for` loops in `xBounds` and `yMax` calculations in `SWRChart.tsx`.

## 2025-02-14 - O(1) Map Lookups for Static Presets

**Learning:** When frequently querying static arrays by a unique ID (e.g., `GROUND_PRESETS`, `FEEDLINE_PRESETS`), using `Array.find()` results in $O(N)$ linear searches.
**Action:** Pre-compute a `Map` at module initialization to enable $O(1)$ lookups via `Map.get(id)`, replacing the inefficient $O(N)$ linear searches. This provides a measurable reduction in lookup time.

## 2025-02-12 - File Reading Tool Truncation

**Learning:** When dealing with truncated outputs from tools like `read_file` or `cat`, we should rely on more robust extraction commands like `sed` or `grep` to successfully explore large files, otherwise we violate the Exploration Rule during planning.
**Action:** Use `sed -n '<start>,<end>p'` or `grep -C <lines>` to inspect target regions in large files to guarantee adequate codebase exploration before creating a plan.

## 2025-05-18 - Set.has for O(1) Check over Array.includes

**Learning:** When checking string membership against a static, known list of options, defining an array inline and using `.includes()` requires reallocation on every execution and runs in $O(N)$ time. By extracting the static array into a module-scoped `Set`, we avoid memory reallocation and change the check to $O(1)$ time, yielding a measurable performance boost.
**Action:** Always extract static membership checks (like enum-like string arrays) into a module-scoped `Set` and use `Set.has()` in frequently-executed render paths or hot loops.
## 2024-05-14 - Replace mapped array operations with standard for loops in React Hooks

**Learning:** Array `.map()` creates shallow copies that can lead to large garbage collection pressure, particularly when generating intermediate arrays or used inside loops and computationally-heavy `useMemo` hooks.
**Action:** Replace sequential `.map()` chains and intermediate arrays with a single optimized `for` loop that performs calculations and populates output arrays concurrently in O(N) passes, drastically minimizing overhead.
## 2025-02-18 - Avoid O(n) array element extraction micro-optimization

**Learning:** Replacing native `Array.prototype.filter()` and `find()` with manual `for` loops on small arrays (e.g., extracting antenna wires by tag in `antennaStore.ts`) is considered a forbidden micro-optimization. It sacrifices code readability and provides zero measurable performance benefit.
**Action:** Do not replace clean, concise functional methods with verbose `for` loops for small arrays.

## 2025-02-18 - Avoid Set.has() micro-optimization on tiny static arrays

**Learning:** When performing membership checks against large static arrays, extracting the static array into a module-scoped `Set` and using `Set.has()` instead of `Array.includes()` achieves $O(1)$ lookup time. However, applying this to tiny, static arrays (e.g., 3-5 elements) offers no measurable performance improvement over `Array.includes()` and is considered a forbidden micro-optimization.
**Action:** Only use `Set.has()` for larger static arrays where the performance gain is measurable.

## 2025-02-18 - Pre-compute Maps for O(1) Lookups

**Learning:** When frequently querying static arrays by a unique ID (e.g., `GROUND_PRESETS`), using `Array.find()` results in $O(N)$ linear searches.
**Action:** Pre-compute a `Map` at module initialization to enable $O(1)$ lookups via `Map.get(id)`, replacing the inefficient $O(N)$ linear searches. This provides a measurable reduction in lookup time.

## 2025-05-18 - Loop Fusions and Array Find optimizations

**Learning:** Finding individual wires in an array generated from Three.js vectors inside `antennaStore.ts` using `.find` or `.filter` requires multiple $O(N)$ allocations and passes over the array.
**Action:** Replace multiple separate `.find` and `.filter` calls on array elements with a single `for` loop that stores the specific matches by evaluating all cases and executing early `break` statements. This removes functional allocation overhead inside hot store selectors.
## 2024-05-29 - Array method optimization in high frequency path
**Learning:** In the `nec2Engine.ts` file, inside the `findSwrBands` calls, using `.map()` on the `scan` and `broadScan` arrays generates unnecessary intermediate arrays before passing them into the function. This allocates more memory and requires more GC time, especially when dealing with potentially large sweep arrays on every global state update during simulations.
**Action:** Replace chains of array mapping methods like `scan.map(x).map(y)` with single, explicit `for` loops inside the function block to directly construct arrays and avoid intermediate allocation overhead.
## 2026-05-30 - Optimize SWR Chart dataset mapping\n**Learning:** High-frequency chart renders map over large arrays creating GC pressure. Pre-allocating arrays and using for loops instead of Array.prototype.map() provides a measurable speedup and avoids callback allocation.\n**Action:** Replaced .map() calls in `computeChartData` with IIFEs wrapping a standard for loop.
## 2026-05-30 - Avoid Intermediate Array Allocations in High-Frequency Paths
**Learning:** In high-frequency computational paths, mapping data into parallel intermediate arrays (even with pre-allocated `new Array(length)` and manual `for` loops) incurs noticeable memory allocation overhead and GC pressure. Refactoring utility functions (like `findSwrBands`) to accept a generic array (`T[]`) along with inline accessor functions (`(item: T) => number`) allows processing complex data in place, significantly reducing execution time.
**Action:** Refactored `findSwrBands` in `src/physics/bandwidth.ts` to use generic items with accessor functions, updating calls in `nec2Engine.ts` and `swrChartUtils.ts` to avoid creating intermediate arrays for frequency and SWR values.
## 2025-02-18 - Optimize SWR Chart Data Processing
**Learning:** High-frequency render blocks passing large arrays to Chart.js shouldn't use `.map()` which generates intermediate copies and garbage, but instead pre-allocate arrays and populate via `for` loops.
**Action:** Replaced `.map()` with pre-allocated `for` loops in `src/components/Charts/swrChartUtils.ts` (computeChartData).
## 2026-05-30 - Avoid Map Filter Chaining Array Allocations\n**Learning:** Chaining `.map().filter()` calls inside high-frequency render functions like `useDipoleGeometry` generates unnecessary intermediate shallow array copies and incurs excessive garbage collection pressure, particularly when handling 3D scene re-renders.\n**Action:** Replace functional map/filter chaining with a single standard `for` loop and array `push()` with early `continue` statements to eliminate intermediate allocations.

## 2026-05-31 - Avoid Array.prototype.map() in PolarPlots
**Learning:** In high-frequency React component renders (like rendering polar charts based on varying parameters), using `.map()` on arrays to normalise data creates unnecessary callback execution overhead and unoptimized array allocations, leading to increased GC pressure.
**Action:** Replaced `.map()` with a pre-allocated array (`new Array(len)`) and a standard `for` loop in `normaliseForPolar` within `src/components/Charts/PolarPlots.tsx` to measurably improve performance and reduce overhead.
## 2026-06-19 - Group React hooks using Zustand's useShallow
**Learning:** Using multiple separate `useAntennaStore((s) => s.property)` selector calls within a single component (like in `ColormapLegend.tsx`) incurs excess React hook allocation and store listener overhead, dragging down performance during high-frequency global state updates.
**Action:** Group multiple related Zustand store property selections into a single `useAntennaStore(useShallow(...))` hook block. This optimizes component re-rendering and mitigates lifecycle bottlenecks.

## 2024-05-18 - Optimize array filtering in React render cycle
**Learning:** Avoid array filtering directly inside a React component's render cycle, as it allocates a new array on every render. Instead, wrap the filtering logic in a `useMemo` block with appropriate dependencies to cache the result and prevent unnecessary reallocations when dependencies are stable.
**Action:** Updated `TerminationSection` in `src/components/Panel/StatsReadout.tsx` to use `useMemo` for filtering `legRipples`. Fixed early return statement to comply with React Hooks rules.
