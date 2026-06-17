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
## $(date +%Y-%m-%d) - Un-exporting Internal Utilities and Constants
**Learning:** `knip` correctly flagged `reflectionCoefficientMag`, `INITIAL_HEIGHT`, and `FEED_BRIDGE_LENGTH_M` (re-export) as unused outside their declaring files. When a function or constant is only used internally, it should not be exported, improving module encapsulation.
**Action:** When cleaning up unused exports, simply remove the `export` keyword if the symbol is used locally. If it was re-exported in a centralized `export { ... }` block but unused outside, remove it from that block while keeping its import intact if it's used within the aggregator file. Always verify with `npm run build` and `npm run test` afterward.
## 2024-05-18 - [False Positive on Unused Type Import]
**Learning:** A static analysis tool incorrectly flagged a valid type import (`ComparisonSnapshot` in `src/components/Scene/AntennaScene.tsx`) as unused, when it was actually being used as a type for a property in an interface definition (`interface AntennaSceneProps`).
**Action:** When investigating reported unused type imports, carefully examine the file to ensure the type isn't used within type signatures or interfaces. If verified as a false positive, do not remove the import, and instead note the false positive in the journal and close the task without making codebase changes.
## 2024-06-25 - False Positive on AntennaType Import
**Learning:** The static analysis scanner incorrectly flagged `type AntennaType` in `src/components/Panel/GeometryControl.tsx` as an unused import. However, manual inspection verified it was used as a type parameter in definitions like `Record<AntennaType, string>`. Removing valid, in-use imports causes build failures and is an anti-pattern.
**Action:** Closed the task without making changes to the codebase, strictly adhering to the Code Health Refactoring Pattern which dictates preserving valid code when confronted with false positives.
## 2024-05-19 - [False Positive on Unused Type Import]
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
