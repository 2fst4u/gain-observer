## 2024-05-13 - Knip Unused Export Removal
**Learning:** `knip` correctly identifies types that are unused outside of the file they are defined in, but removing the `export` keyword can break TypeScript builds if the types are referenced internally by other *exported* interfaces in the same file. I need to be careful when removing `export` from types and verify that they aren't part of an exported interface's signature.
**Action:** Always check internal usages of a type within the file, especially if it's used in the signature of other exported entities, before deciding to drop the `export` keyword. Run `npm run build` to guarantee safety.
## 2024-05-22 - [Kept for compatibility]
**Learning:** Code Cleanup Safety Pattern: Never remove exported constants or variables that are explicitly marked in comments as 'kept for compatibility' (e.g., DELTA_LOOP_RIGHT_LEG_TAG), even if they appear completely unused in the current repository, to avoid breaking external systems or legacy data parsing.
**Action:** Always read the inline comments of a variable or function before removing it to ensure it is not kept for compatibility reasons.
## 2024-05-23 - Internal Definitions and Export Cleanup
**Learning:** `knip` flagged `INVERTED_L_HORIZONTAL_TAG` and `INVERTED_L_RADIAL_TAG` as unused exports in `src/store/antennaStore.ts`. However, these constants are actually defined in `src/physics/constants.ts` and used in `src/store/antennaGeometry.ts`. The re-export in the store file was unnecessary, but the actual declarations were not dead code.
**Action:** When `knip` reports an unused export, particularly in a file that seems to be re-exporting things (like an aggregator or a store), trace the variable back to its definition and do a global search (`grep`) to see if it is used *anywhere* else in the application. Only delete the original definition if it is 100% dead code application-wide. If it is used elsewhere but the re-export is truly unused, only remove the re-export.
## 2024-06-07 - Extracted duplicated cleanZero function
**Learning:** Ensure all duplicated instances of a function are removed when extracting it to a central utility file.
**Action:** Replaced all 4 local declarations of cleanZero with an import from the new math utility file.

## 2024-06-09 - Extract duplicated Delta Loop geometry math
**Learning:** We extracted duplicated identical geometry logic from `buildDeltaLoopWires` and `buildTerminatedDeltaWires` into a single helper function `calcDeltaLoopGeometry` in `src/store/antennaGeometry.ts`, destructuring only the required return values.
**Action:** Created `calcDeltaLoopGeometry` utility function, refactored both callers to use the utility, verified safety with code coverage tests, lint, and build.

## 2024-06-11 - Constant export cleanup
**Learning:** Removing an unused export for a constant that is still used internally within the same file requires leaving the import intact.
**Action:** When un-exporting variables, do a local grep to see if they are still used in the file; if so, do not remove the import.
## 2026-06-17 - Un-exporting Internal Utilities and Constants
**Learning:** `knip` correctly flagged `reflectionCoefficientMag`, `INITIAL_HEIGHT`, and `FEED_BRIDGE_LENGTH_M` (re-export) as unused outside their declaring files. When a function or constant is only used internally, it should not be exported, improving module encapsulation.
**Action:** When cleaning up unused exports, simply remove the `export` keyword if the symbol is used locally. If it was re-exported in a centralized `export { ... }` block but unused outside, remove it from that block while keeping its import intact if it's used within the aggregator file. Always verify with `npm run build` and `npm run test` afterward.
## 2024-05-18 - [False Positive on Unused Type Import: ComparisonSnapshot]
**Learning:** A static analysis tool incorrectly flagged a valid type import (`ComparisonSnapshot` in `src/components/Scene/AntennaScene.tsx`) as unused, when it was actually being used as a type for a property in an interface definition (`interface AntennaSceneProps`).
**Action:** When investigating reported unused type imports, carefully examine the file to ensure the type isn't used within type signatures or interfaces. If verified as a false positive, do not remove the import, and instead note the false positive in the journal and close the task without making codebase changes.
## 2024-06-25 - False Positive on AntennaType Import
**Learning:** The static analysis scanner incorrectly flagged `type AntennaType` in `src/components/Panel/GeometryControl.tsx` as an unused import. However, manual inspection verified it was used as a type parameter in definitions like `Record<AntennaType, string>`. Removing valid, in-use imports causes build failures and is an anti-pattern.
**Action:** Closed the task without making changes to the codebase, strictly adhering to the Code Health Refactoring Pattern which dictates preserving valid code when confronted with false positives.
## 2024-05-19 - [False Positive on Unused Type Import: SwrBand]
**Learning:** A static analysis tool incorrectly flagged a valid type import (`SwrBand` in `src/physics/nec2Engine.ts`) as unused, when it was actually being used as a type annotation for function parameters (`bands: readonly SwrBand[]` and `b: SwrBand`). Removing it causes `tsc` build errors.
**Action:** When investigating reported unused type imports, carefully examine the file to ensure the type isn't used within type signatures or interfaces. If verified as a false positive, do not remove the import, and instead note the false positive in the journal and close the task without making codebase changes.

## 2024-05-19 - Removed unused OrientationPreset import and re-export in antennaStore.ts
**Learning:** Found that `type OrientationPreset` was imported in `src/store/antennaStore.ts` just to be re-exported, causing an unused import warning by standard code health checks since it isn't used internally.
**Action:** Removed the import and re-export of `OrientationPreset` in `src/store/antennaStore.ts` and updated the `GeometryControl.tsx` component to import it directly from `../../store/antennaGeometry` where it is defined, improving clarity and maintainability.

## 2025-02-13 - [Safely Resolving False Positive Unused Type Imports]
**Learning:** A static analysis tool incorrectly flagged a valid type import (`AntennaState` in `src/hooks/usePhysicsEngine.ts`) as unused, when it was actually being used as a type annotation for a local function parameter. While it is a false positive, leaving it unresolved is messy. Simply dropping the type annotation or using an inline type `ReturnType<>` hurts readability. The safest way to cleanly remove the dependency on the imported type while preserving strict type safety is applying the Interface Segregation Principle: defining a localized interface (`TransformerState`) that models only the properties actually needed by the function.
**Action:** Resolved the static analysis warning by removing the `AntennaState` import and defining a local `TransformerState` interface to type the function parameter, verifying safety with `tsc --noEmit` and tests.

## 2024-10-24 - False Positive on AntennaWireProps Import
**Learning:** The static analysis scanner incorrectly flagged `type AntennaWireProps` in `src/components/Scene/AntennaWire.tsx` as an unused import. Manual inspection verified it was used as the type for the `props` argument in `export function AntennaWire(props: AntennaWireProps)`.
**Action:** Closed the task without making changes to the codebase, preserving valid code.

## 2024-06-17 - Complex function refactor PropagationRadar
**Learning:** We refactored `PropagationRadar` in `src/components/Charts/PropagationRadar.tsx` by extracting complex logic into smaller helper functions (`calculateMaxRangeKm` and `buildAzimuthalWedges`), improving code readability and maintainability without changing behavior.
**Action:** Identified the logic that could be extracted, created the pure helper functions, and verified no regressions by running tests.

## 2024-06-17 - Extract PolarPlotPanel to Reduce Component Complexity
**Learning:** Large React components rendering multiple instances of heavily configured sub-components (like Chart.js instances) can obscure their core structure. Extracting these configurations into a stateless sub-component locally within the same file dramatically improves readability while preserving scope and minimizing hook overhead.
**Action:** Refactored the `PolarPlots` component by extracting the repetitive Chart.js `<Radar />` setup into a local `PolarPlotPanel` sub-component.
## 2025-02-13 - Complex Component Refactoring (FeedlineControl)
**Learning:** Large React components handling multiple inputs with complex state logic can be safely refactored by extracting focused UI fragments into local, stateless (or localized state) components within the same file. This keeps the file self-contained while dramatically reducing the cognitive load of the main exported component.
**Action:** Extracted `SyncedLengthInput`, `DipoleOffsetControl`, and `AtuSection` as local sub-components within `FeedlineControl.tsx` to handle specific domains of state and UI, significantly flattening the main `FeedlineControl` component render function.
## 2024-06-17 - [Extract SWRChart Stats Component]
**Learning:** Extracting complex presentation sections of a component into smaller functional components improves overall code health and maintainability. In `SWRChart`, abstracting the statistics out into `SWRChartStats` with reusable UI patterns like `StatRow` significantly reduces the primary component size and isolates rendering responsibilities.
**Action:** Created `StatRow` standard UI component and refactored `SWRChart` to utilize it within an extracted `SWRChartStats` component.
## 2026-06-17 - Refactored complex GeometryControl component
**Learning:** Refactoring a 500-line React component with complex, intertwined state requires isolating discrete functional blocks (like length, termination, and orientation controls) into separate local sub-components. By extracting these and using \`useShallow\` within each sub-component to select only the required global state, we not only improve readability and maintainability but also reduce unnecessary re-renders when unrelated state changes.
**Action:** Identified distinct functional areas in \`GeometryControl.tsx\` and extracted them into \`LengthControl\`, \`TerminationControl\`, and \`OrientationControl\` components within the same file. Cleaned up unused variables and verified with test and lint passes.
## 2026-06-17 - Component Refactoring Duplication
**Learning:** When refactoring a large React component by extracting inline sections into separate functional components within the same file, be careful to look out for duplicated constant definitions (e.g., `resonateTitles`) and duplicated computations (e.g., `tfdZ0` calculation) that might have been copied directly into each new sub-component.
**Action:** Always hoist shared constants and logic computations to the module scope (outside the component functions) to eliminate duplication. Also, use conditional properties inside `useShallow` when subscribing to Zustand stores to avoid unnecessary subscriptions that fire when the parent component isn't even active or using the data.

## 2026-06-17 - Extracted Sub-hooks for Complex React Hooks
**Learning:** Massive generic hooks covering multiple disparate responsibilities (like `useAntennaGeometry` which previously handled layout calculations, topology detection, and termination dimension logic simultaneously) are brittle and unreadable. Grouping the internal `useMemo` calls into explicit, specialized internal hooks allows the main exported hook to act purely as an orchestrator. This significantly boosts type safety and reasoning.
**Action:** Refactored `src/components/Scene/useAntennaGeometry.ts` into three focused sub-hooks (`useRenderedWires`, `useFeedpointAndShield`, `useTerminatedDeltaSplit`) and added typed interfaces.
## 2026-06-17 - Extracted safeSegs and Refactored buildFoldedAntennaWires
**Learning:** `safeSegs` was defined locally inside `buildInvertedLWires` but is a globally applicable constraint for NEC-2 stability (segment length >= 4 * wire radius). Complex functions like `buildFoldedAntennaWires` returning arrays of similar objects can be greatly simplified with local factory helpers like `createWire`.
**Action:** Extracted `safeSegs` to an exported top-level utility in `src/store/antennaGeometry.ts`, updated all call sites to pass `wireRadius`, and refactored `buildFoldedAntennaWires` to use `safeSegs` and a local `createWire` helper, drastically reducing verbosity.
## 2024-06-17 - [Extract Reusable StatRow Component]
**Learning:** For displaying statistical readouts, use the reusable `StatRow` component from `src/components/UI/StatRow.tsx` instead of hardcoding `<div className="stat">` blocks. Extracted complex ternary logic into isolated helper functions to dramatically reduce React component complexity.
**Action:** Created `<StatRow>`, replaced all static div blocks in `StatsReadout.tsx`, and migrated tooltip logic into `getImpedanceTitle`, `getSwrTitle`, and `getRealizedGainTitle`.

## 2024-05-18 - [TransformerControl Refactoring]
**Learning:** Extracting complex inline logic, especially IIFEs and blocks containing multiple local `useState` declarations, into separate, pure sub-components (`TransformerRatioInput`) and pure helper functions (`calculateOptimalRatio`) dramatically improves readability, reduces line count in the parent component, and adheres closely to React's compositional nature without altering functionality.
**Action:** Refactored `TransformerControl.tsx` to separate stateful input rendering and pure math logic from the main layout wrapper.

## 2026-06-20 - False Positive Bug Report Comment
**Learning:** Found a comment `// The 1.5λ dipole from the bug report: high gain, severe mismatch.` in `tests/impedance.test.ts:25`. The comment refers to a "bug report" for context on a test case, it is not an active bug or TODO marker that needs fixing in the code.
**Action:** Closed the task without making changes to the source codebase, strictly adhering to the Code Health Refactoring Pattern which dictates preserving valid code when confronted with false positives.
## 2025-02-13 - Removed unused exports from usePhysicsEngine
**Learning:** Functions that are only used internally within their module should not be exported, as it bloats the public API and triggers unused export warnings in static analysis tools (like Knip).
**Action:** Removed the `export` keyword from `handleWorkerMessage`, `buildWorkerRequest`, `useWorkerLifecycle`, and `usePhysicsScheduler` in `src/hooks/usePhysicsEngine.ts` to keep them local to the module.
## 2024-06-11 - Extract Helpers from Large Functions
**Learning:** Extracting coordinate point calculations and segment logic from massive configuration functions (like `buildFoldedAntennaWires`) into localized, pure helper functions vastly reduces cyclomatic complexity, shortens function length to reasonable levels, and makes the core logic much more readable while preserving all complex math constraints.
**Action:** Created `calcFoldedAntennaPoints` and `calcFoldedAntennaSegments` to decompose `buildFoldedAntennaWires`.
## 2024-06-29 - React Refactoring Pattern
**Learning:** Functions over 100 lines inside a complex React component (like `SceneContents`) can be heavily refactored and cleaned up without introducing new files. By extracting massive, multi-variable block assignments and store reads into localized custom hooks (like `useSceneConfiguration`) living in the same file, the core view component becomes much more declarative and simpler to manage.
**Action:** Created `useSceneConfiguration` in `src/components/Scene/AntennaScene.tsx` and moved all store state pulling and computed property logic inside it.
>> ## 2025-02-28 - Extract Antenna Termination Logic
>> **What:** The `buildTerminationElements` function in `src/store/antennaStore.ts` exceeded 100 lines and combined three separate logic branches (`sloping-v`, `terminated-delta`, and `folded-dipole`).
>> **Why:** Splitting this high-complexity function into three smaller, focused helper functions and delegating logic via a `switch` statement makes the codebase significantly easier to read, maintain, and unit test in isolation.
>> **Verification:** Fully verified via unit tests (`npm run test -- --run`) and static analysis (`npm run lint`), ensuring all behavior perfectly matches the original implementation.
## 2024-05-18 - Refactored calcFoldedAntennaSegments
**Action:** Extracted `calcFoldedTargetSegLen` and `calcFoldedLegSegs` from `calcFoldedAntennaSegments` to reduce complexity and improve modularity. Preserved the explanatory block comment above the extracted length calculation function.
## 2024-07-07 - [Unused Exports Cleanup]
**Learning:** Tools like `knip` often flag internal utility functions (like `safeSegs` or `buildPlugins`) as unused exports when they are only consumed locally within the same module.
**Action:** Always check if a flagged unused export is being used internally before completely deleting the function. If it is used locally, merely strip the `export` keyword to restrict its scope rather than removing the code entirely, then recalculate and enforce Vitest coverage thresholds to prevent CI regressions.
## 2025-03-02 - Removed unused oddRound export
**Learning:** `knip` will correctly flag functions that are exported but only used within the file they are defined in. In `src/store/antennaGeometry.ts`, `oddRound` was exported despite only being consumed locally.
**Action:** Un-export functions that are strictly internal helpers. This reduces the public API surface area and eliminates false-positive static analysis warnings without deleting necessary code.
## 2026-07-22 - Un-export internal types to fix Knip warnings\n**Learning:** When Knip flags types as unused exports, merely un-exporting them can break the TypeScript build if those types are still used inside other exported interfaces (TS4023). However, if carefully done for types that don't leak into the public API, it clears technical debt.\n**Action:** Un-exported HopStatus, LinkQuality, Vec3, GroundType, Excitation, and FeedlineShield since they were only used internally.
## 2026-07-26 - [Remove duplicate TERMINATED_DELTA_CENTRE_GAP_M export]\n**Learning:** When Knip flags duplicate exports that are simply aliases of each other, they should be cleaned up by keeping only the canonical constant and removing the alias. Also, removing imports without removing their usage causes AST parsing errors (), so it's critical to ensure tests pass after modifying both the export and the consuming files.\n**Action:** Use a regex or simple find-and-replace to migrate consuming files to use the canonical name before deleting the alias.
## 2025-03-02 - [Remove duplicate TERMINATED_DELTA_CENTRE_GAP_M export]
**Learning:** When Knip flags duplicate exports that are simply aliases of each other, they should be cleaned up by keeping only the canonical constant and removing the alias. Also, removing imports without removing their usage causes AST parsing errors (`[PARSE_ERROR] Identifier X has already been declared`), so it's critical to ensure tests pass after modifying both the export and the consuming files.
**Action:** Use a regex or simple find-and-replace to migrate consuming files to use the canonical name before deleting the alias.
## 2024-05-30 - False Positives in Knip Analysis
**Learning:** Knip static analysis might falsely flag exports that are actively used if it doesn't parse dynamically or if it's explicitly run with `--production`, which ignores usages inside test files. Wait to use `grep` everywhere to verify.
**Action:** Always verify a Knip suggestion via a global text search (`grep -rn`) before including its deletion in the execution plan.
## 2025-03-02 - Removed unused parseNtLine
**Learning:** Functions that parse NEC output formats (like `parseNtLine`) might be written defensively or for future use, but if they are never actually invoked by the main codebase or tests (other than their own isolated unit test), they are dead code. Tools like `knip --production` might miss this if they ignore test directories, while standard `knip` correctly flags them.
**Action:** Always cross-reference Knip's unused export findings with `grep` to ensure they are genuinely unused in all workflows before removing them entirely (including their tests).
