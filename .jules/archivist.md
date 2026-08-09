## 2026-05-03 - Package Manager Drift (closed 2026-08-09)

**Learning:** The documentation instructed users to use `pnpm`, but the repository strictly uses `npm` (as evidenced by `package-lock.json`, `.npmrc` with `legacy-peer-deps=true`, and the GitHub Actions test workflow which runs `npm ci`). The `README.md` had been switched from `npm` to `pnpm` the previous day (PR #14) on the mistaken belief that pnpm matched the repository's package management.
**Action:** The `README.md` was updated back to `npm` commands to prevent setup failures and confusion. This is the only time the package manager has flapped — `npm` has been the documented and actual toolchain continuously since 2026-05-03. Do not revisit it.

**Follow-up (2026-08-09):** The *package manager* stopped flapping here, but the *command list* kept drifting by omission, costing one documentation-only pull request each time: `npm install` → `npm ci` (PR #99), `npm test` → `npm run test`, a phantom `test:ui` script, and a missing `npm run typecheck` (PR #630). All four shared a root cause — the README's code block was a second, hand-curated copy of `package.json` with nothing keeping it honest.

The fix was not to sync the copy but to delete it. This is a hosted application; the README addresses someone deciding whether to use www.gain.observer, and build instructions never belonged there. Setup commands are gone from `README.md`, contributor and toolchain guidance lives in `AGENTS.md`, and `nec2-build/build.sh` documents its own prerequisites. **The lesson generalises: when documentation keeps drifting from code, ask whether that documentation should exist at all before syncing it again.** A second copy of machine-readable truth is a maintenance liability, and prose that restates `package.json` has no independent readership. The README's lack of setup instructions is deliberate: do not restore them, and do not report them as missing.

## 2026-05-06 - Phantom UI Test Command

**Learning:** `package.json` included a phantom command `"test:ui": "vitest --ui"` which fails out-of-the-box because `@vitest/ui` is deliberately excluded from `devDependencies`. Adding dependencies to fix phantom commands violates strict boundaries on modifying project architecture/configs unnecessarily.
**Action:** When finding phantom scripts in `package.json`, carefully remove the script to align with the actual project state rather than artificially installing dependencies to "make the documentation work".

## 2025-05-10 - Canonical Domain URL Drift

**Learning:** The documentation and agent guidelines referenced the root domain `https://gain.observer` as the hosted URL, but the site's metadata (`index.html` canonical/og links) strictly enforces the `www` subdomain (`https://www.gain.observer/`). Inconsistent domain documentation can cause SEO confusion and duplicate indexing.
**Action:** Ensure all documentation links pointing to the production application match the exact `rel="canonical"` URL defined in the application's main HTML entry point.

## 2026-05-17 - README Scope Drift

**Learning:** The `README.md` file listed only "horizontal dipoles" under its current scope, while the application actually supports multiple other topologies (e.g., inverted-v, sloping-v, delta-loop), leading to an inaccurate representation of the tool's capabilities.
**Action:** Regularly audit the capabilities listed in the README against the actual codebase features to prevent scope drift and ensure the documented features accurately reflect the product's true capabilities. This has recurred five times (PRs #164, #184, #285, #288, #357) — when adding or removing an `AntennaType`, update the README in the same change rather than leaving it for a later audit.

## 2026-05-19 - Sloping V Termination Topology Drift

**Learning:** The documentation for the Sloping V antenna claimed its termination was modeled as a differential resistor across the two tips without a path to ground. However, the engine (`src/store/antennaStore.ts`) actually creates short vertical stub wires from each tip down to near-ground to model realistic shunt-to-earth current paths. The docs had drifted from the active implementation physics.
**Action:** The `docs/antenna-spec.md` was updated to accurately reflect the per-leg-to-ground stub topology.

## 2026-05-20 - Terminated Delta Antenna Documentation Drift

**Learning:** The "Terminated Delta" antenna topology, which splits the bottom wire of a delta loop and terminates it to ground, is fully implemented in the engine (`src/store/antennaGeometry.ts` via `buildTerminatedDeltaWires`) and physics types, but it was completely undocumented in `docs/antenna-spec.md`, `docs/antenna-model-spec.md`, and the `README.md` scope section.
**Action:** The specifications were updated to explicitly include the geometry, feedpoint, termination, and segmentation rules for the Terminated Delta topology to match the actual implemented codebase.

## 2026-05-23 - V-Beam Terminology Drift

**Learning:** The terms "Sloping V" and "V-Beam" refer to the same underlying topology generated by the `buildSlopingVWires` function in `src/store/antennaGeometry.ts` (as noted by its inline comment). However, the documentation only referred to it as "Sloping V", which could cause confusion for users specifically looking for "V-Beam" modeling capabilities.
**Action:** The documentation in `docs/antenna-model-spec.md` and `docs/antenna-spec.md` was updated to explicitly include the "V-Beam" synonym alongside "Sloping V" to improve clarity and searchability without modifying the engine logic.

## 2026-05-24 - V-Beam Terminology Removal

**Learning:** The "V-Beam" terminology was previously added to the "Sloping V" documentation to clarify that they use the same geometry function. However, the user clarified that V-beam antennas are not actually used anymore in the project.
**Action:** All references to "V-Beam" have been entirely removed from the documentation (`docs/antenna-model-spec.md`, `docs/antenna-spec.md`) and the codebase (`src/store/antennaGeometry.ts`) to avoid confusion and properly reflect the current state of the application.

## 2026-05-26 - README phase 1 scope is outdated
**Learning:** The `README.md` listed phase 1 scope and did not include `vertical-whip`, `inverted-l`, and `folded-dipole` which are supported in `AntennaType` type now.
**Action:** Always verify `AntennaType` against `README.md` or other files that hardcode supported types (e.g. `docs/antenna-spec.md`).

## 2025-05-27 - Antenna Model Spec Drift
**Learning:** `docs/antenna-model-spec.md` drifted and omitted several supported antenna types (Vertical Whip, Inverted-L, Folded Dipole) under "2. Antenna Type Definitions". These types were already documented in the codebase, `README.md`, and `docs/antenna-spec.md`, leading to an incomplete representation of the physics model.
**Action:** The missing topologies (Vertical Whip, Inverted-L, Folded Dipole) were added to `docs/antenna-model-spec.md` to accurately match reality.
## 2024-05-28 - Syncing terminology
**Learning:** The README.md still refers to "terminated delta loops", but in the app and the `antenna-spec.md` they are referred to as `Terminated Delta`.
**Action:** Need to update README.md to be more precise about the actual application state.

## 2026-05-28 - Unified Terminology for Terminated Delta
**Learning:** Some files (like `TODO.md` and `tests/useDipoleGeometry.test.tsx`) still referred to the "terminated delta" antenna type as "terminated delta loop". The official and unified term across UI, types, and documentation (`antenna-spec.md`) is strictly "Terminated Delta".
**Action:** Replaced instances of "terminated delta loop" with "terminated delta" to ensure consistency and prevent ambiguity for developers and users referencing the codebase.

## 2026-06-04 - Folded Dipole Termination Topology Drift
**Learning:** The `docs/antenna-spec.md` incorrectly stated that the terminated folded dipole's termination resistor sits on an odd-numbered centre segment of a single opposite conductor. In reality, the codebase (`src/store/antennaGeometry.ts`) splits the opposite conductor into two symmetric halves and uses a separate short horizontal bridge wire (`FOLDED_DIPOLE_TERM_BRIDGE_TAG`) to house the resistor, mirroring the terminated delta topology.
**Action:** Updated `docs/antenna-spec.md` sections 7.3 and 7.5 to correctly document the split opposite conductor, the termination bridge wire, and the correct total wire count.

## 2026-06-05 - Undiscoverable Keyboard Shortcuts
**Learning:** Global keyboard shortcuts (`t` for Theme, `u` for Units, `m` for Mode) were fully implemented in the root `App.tsx` component via `useKeyboardShortcuts` but were not documented anywhere. This leaves powerful application features completely undiscoverable to users.
**Action:** Always audit for global event listeners (like `keydown` on `window`) when verifying documentation completeness. Added a `## Keyboard Shortcuts` section to `README.md` to expose these features.

## 2026-06-08 - Vertical Whip Height Drift
**Learning:** The documentation assumed the vertical whip antenna defaults to a physically typical ground-mounted height (0m). However, the engine (`src/store/antennaStore.ts`) was enforcing a generic default height (`INITIAL_HEIGHT` = 8m) for the vertical whip, incorrectly treating it as an elevated monopole rather than a ground-mounted radiator. The application logic drifted from the correct, documented physical intention.
**Action:** The documentation was kept as-is, and the application logic in `src/store/antennaStore.ts` was updated to explicitly default the vertical whip to a height of 0m when selected.

## 2026-06-09 - Delta Loop Feedpoint Topology Drift
**Learning:** The documentation for the Delta Loop claimed it was fed at the center of the bottom horizontal wire (or 1/4 λ from the apex for vertical polarization) and could be configured apex-down. However, the codebase (`src/store/antennaGeometry.ts`) strictly constructs the delta loop as apex-up and apex-fed (excitation on the last segment of the left leg, nearest the apex). The documentation drifted from the implemented physics model.
**Action:** The documentation in `docs/antenna-model-spec.md` and `docs/antenna-spec.md` was updated to correctly reflect the apex-up, apex-fed geometry, removing inaccurate claims about base-feeding and vertical polarization.

## 2026-06-11 - Dipole Offset Feedpoint Documentation Drift
**Learning:** The documentation for the Center-Fed Dipole in `docs/antenna-spec.md` implied it only supported a center feed segment. However, the `buildWires` fallback logic in `src/store/antennaStore.ts` explicitly supports calculating offset feedpoints (e.g., for an Off-Center Fed Dipole) by splitting the dipole into a left and right leg around a shifted `FEED_BRIDGE_TAG`. The documentation had drifted and failed to reflect this implemented capability.
**Action:** Updated `docs/antenna-spec.md` to explicitly note that offset feedpoints are supported for the dipole topology.

## 2026-06-12 - Dipole Model Spec Documentation Drift
**Learning:** The documentation for the Dipole in `docs/antenna-model-spec.md` implied its feedpoint was strictly "Center-fed (split at the midpoint)." However, the application engine supports asymmetric/offset feedpoints (e.g., Off-Center Fed Dipoles). The documentation had drifted and failed to reflect this capability in the modeling spec, though it was noted in the implementation spec.
**Action:** Updated `docs/antenna-model-spec.md` to accurately reflect that while center-fed by default, offset feedpoints are fully supported via asymmetric wire splitting.

## 2026-06-13 - Delta Loop and Terminated Delta Reference Length Drift
**Learning:** The documentation listed delta loop reference length as 1.03λ and terminated delta as 1.0λ, but the engine (`src/physics/constants.ts`) uses 1.02λ for both, based on the ARRL formula for full-wave HF loops.
**Action:** `docs/antenna-spec.md` was updated to accurately reflect 1.02λ.
## 2026-06-15 - Terminated Folded Dipole Drift
**Learning:** The Terminated Folded Dipole (TFD) termination topology was incorrectly described in `docs/antenna-spec.md` as a horizontal bridge wire, and it was entirely missing from the termination types overview in `docs/antenna-model-spec.md`. It actually uses a vertical bridge wire spanning the aperture between the top and bottom conductors.
**Action:** Updated the specifications to accurately describe the TFD topology and its vertical termination bridge to match the implementation in `src/physics/constants.ts` and `src/store/antennaGeometry.ts`.

## 2026-06-16 - Terminated Folded Dipole Bridge Orientation Drift
**Learning:** The `docs/antenna-spec.md` and `docs/antenna-model-spec.md` incorrectly stated that the terminated folded dipole's termination resistor sits on a *vertical* bridge wire spanning the aperture between the center of the top (un-fed) conductor and the center of the bottom (fed) conductor. In reality, the codebase (`src/store/antennaGeometry.ts` and `src/store/antennaStore.ts`) constructs this as a short *horizontal* bridge wire spanning the gap specifically between the two inner ends of the split top (un-fed) conductor, exactly mirroring the terminated delta topology.
**Action:** Updated both specification files to correctly document the termination as a single resistor on a short horizontal bridge wire spanning the gap at the center of the top conductor.

## 2026-06-19 - Delta Loop Geometry Documentation Drift
**Learning:** The documentation for the Delta Loop claimed it was simply a "triangular loop" or strictly an "Equilateral triangle" without additional context. However, the application engine (`src/store/antennaGeometry.ts`) constructs it as an apex-up, isosceles triangular loop that flattens into an isosceles triangle when the mast height is below the equilateral height (preserving perimeter). The documentation was missing this critical nuance, leaving ambiguity about how the loop's shape behaves under height constraints.
**Action:** Updated `docs/antenna-model-spec.md` and `docs/antenna-spec.md` to accurately describe the Delta Loop as an apex-up, isosceles triangular loop, and added the detail that it flattens to isosceles under height constraints.
## 2026-06-22 - Vertical Whip Base Height Calculation Drift
**Learning:** The documentation for the Vertical Whip antenna stated that the base starts at `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) "above `height`" (implying `height + 0.01`). However, the actual logic in `src/store/antennaGeometry.ts` uses `Math.max(VERTICAL_WHIP_BASE_GAP_M, height)`, meaning it starts at whichever value is greater, rather than adding them together.
**Action:** Updated `docs/antenna-spec.md` to clarify that the base starts at the maximum of `VERTICAL_WHIP_BASE_GAP_M` and `height` to properly reflect the implementation.
## 2026-06-27 - Inverted-L Base Height Accuracy

**Learning:** The documentation for the Inverted-L antenna stated that its base starts at `VERTICAL_WHIP_BASE_GAP_M` (0.01 m) above ground, while earlier lines incorrectly implied the vertical whip base started at `height`. Additionally, `buildInvertedLWires` actually hardcodes the base start to exactly `VERTICAL_WHIP_BASE_GAP_M` regardless of `height`. The `docs/antenna-spec.md` needs to reflect this behavior properly across all monopole antennas.
**Action:** Updated the vertical whip documentation to clarify that its base starts at the maximum of `height` and `VERTICAL_WHIP_BASE_GAP_M`, accurately reflecting how the gap ensures electrical isolation and making the comparison for the Inverted-L accurate.

## 2026-06-28 - Minimum Tip Height Documentation Drift
**Learning:** The documentation for Inverted-V, Sloping V, Delta Loop, and Terminated Delta antennas claimed the minimum tip/bottom wire height was `0.1` m. However, the codebase (`src/store/antennaGeometry.ts` and `src/physics/constants.ts`) enforces a minimum height of `SLOPING_V_MIN_TIP_Z_M` (`0.5` m) for these topologies to prevent unphysical results or NEC wire-touching-ground warnings.
**Action:** Updated `docs/antenna-spec.md` to accurately reflect the `0.5` m minimum tip/bottom wire height limit enforced by the geometry builders for these antenna types.
## 2026-06-29 - Terminated Delta and T2FD Terminology Drift
**Learning:** `docs/antenna-spec.md` incorrectly referred to the Terminated Delta as a T2FD (Terminated Tilted Folded Dipole). A Terminated Delta is an aperiodic loop, but the T2FD designation specifically applies to a Terminated Folded Dipole.
**Action:** Removed references to T2FD in the Terminated Delta documentation and properly attributed T2FD to the Terminated Folded Dipole section, referring to the Terminated Delta as its "triangular cousin".

## 2026-06-30 - Horizontal Antenna Min Height Constraint Drift
**Learning:** The `docs/antenna-spec.md` falsely claimed that horizontal antennas like the Center-Fed Dipole and Terminated Folded Dipole have a strict minimum height constraint of `z >= 0.1 m` to avoid NEC-2 `GE 1` instability. In reality, the engine (`src/store/antennaStore.ts`) fully supports modeling these antennas at `height = 0` (or `height <= 0`) by seamlessly switching to a free space environment without ground. The documentation drifted from the implemented physics model, unnecessarily restricting perceived capabilities.
**Action:** The documentation in `docs/antenna-spec.md` was updated for the Dipole and Folded Dipole to remove the false `0.1 m` constraint and explicitly clarify that they support `height <= 0` by switching to free space.
## 2026-07-01 - Delta Loop Reference Length Documentation Drift
**Learning:** The documentation listed the delta loop and terminated delta reference lengths as 1.02λ, likely assuming the use of the ARRL formula. However, the `calculateDefaultLength` function in `src/store/antennaStore.ts` explicitly overrides this and returns exactly 1.0λ for these antenna types as the default starting point.
**Action:** `docs/antenna-spec.md` was updated to accurately reflect 1.0λ to match the implemented default length logic.

## 2026-07-09 - Vertical Whip Default Length Drift
**Learning:** The documentation for the Vertical Whip antenna failed to mention its default length. In the codebase (`src/store/antennaStore.ts`), it defaults to `DEFAULT_WHIP_LENGTH_M` (32 ft / 9.75 m) rather than calculating a resonant length by default, unlike other antennas. This omitted detail obscures the initial application state from the user.
**Action:** Appended the 32 ft (9.75 m) default behavior to the `length` parameter description in `docs/antenna-spec.md`.
## 2026-07-11 - Toggle Mode Shortcut Documentation Drift
**Learning:** The documentation for the 'm' keyboard shortcut in README.md incorrectly stated that it "Return to normal mode", while the application logic (in src/App.tsx and src/store/antennaStore.ts) implements it as a toggle between 'normal' and 'comparison' modes. The documentation drifted and failed to reflect the toggle functionality.
**Action:** Edited README.md to clarify that the 'm' shortcut toggles between normal and comparison modes.

## 2026-07-12 - Monopole Reference Length End-Effect Drift
**Learning:** The documentation listed the reference length for the Vertical Whip and Inverted-L simply as "¼λ", omitting the 0.95 end-effect multiplier that is explicitly applied in `calculateDefaultLength` (`lambda * 0.25 * 0.95`). This was inconsistent with the Dipole documentation, which correctly noted its end-effect (0.475λ).
**Action:** Updated `docs/antenna-spec.md` to explicitly state the reference length as 0.2375λ (¼λ with 0.95 end-effect) for both monopole antennas to match the implemented physics logic.
## 2026-07-16 - Inverted-V Reference Length End-Effect Drift\n**Learning:** The documentation listed the reference length for the Inverted-V simply as "0.485λ (Resonance)", omitting the explicit 0.97 end-effect multiplier that is applied in `calculateDefaultLength` (`lambda * 0.5 * 0.97`). This detail clarifies exactly how the 0.485 multiplier is derived, matching the detail provided for the dipole.\n**Action:** Updated `docs/antenna-spec.md` to explicitly state the reference length as "0.485λ total (0.5λ with 0.97 end-effect)" to match the implemented physics logic.

## 2026-07-17 - Delta Loop Reference Length Constants Implementation
**Learning:** In a previous PR, I mistakenly updated the documentation to state the reference length for Delta Loop and Terminated Delta was 1.0λ based on the `calculateDefaultLength` fallback, while ignoring that the actual physics constant `REFERENCE_LENGTH_STRATEGIES` in `src/physics/constants.ts` was using 1.02λ. This created a mismatch where the doc claimed one thing, the fallback did another, and the constants did a third. Documentation updates must ensure that the core physics engine is consistent with the claims.
**Action:** Realigned `src/physics/constants.ts` to use exactly 1.0λ for both loops to match the default behavior, fixing the documentation drift and standardizing the loop reference length across the codebase.
## 2026-07-28 - Inverted-L Base Height Documentation Drift
**Learning:** The documentation claimed the Inverted-L vertical wire started at `VERTICAL_WHIP_BASE_GAP_M` above ground, comparing it to the vertical whip for "same electrical isolation". However, `buildVerticalWhipWires` uses `Math.max(VERTICAL_WHIP_BASE_GAP_M, height)` while `buildInvertedLWires` hardcodes it to exactly `VERTICAL_WHIP_BASE_GAP_M` regardless of height. The comparison was inaccurate.
**Action:** Updated `docs/antenna-spec.md` to state the Inverted-L base starts exactly at `VERTICAL_WHIP_BASE_GAP_M` regardless of height, removing the false comparison to the vertical whip.
## 2026-07-29 - Sloping V leg slope calculation
**Learning:** The documentation for the Sloping V antenna listed a user-configurable slope angle $\theta$ (below horizontal) under "Angle/Slope". However, the application engine ignores any input `legSlope` parameter and calculates the downward slope to force the tips to precisely rest at the ground floor (`SLOPING_V_MIN_TIP_Z_M` or $0.5$ m) to ensure termination to the ground.
**Action:** Updated `docs/antenna-spec.md` to clarify that the downward slope of the legs is automatically calculated, eliminating confusion about a user-configurable slope setting.
## 2026-07-26 - Sloping V Length Parameter Documentation Contradiction
**Learning:** The documentation for the Sloping V antenna contained a contradiction regarding the `length` parameter. The "Leg Count & Length" bullet incorrectly stated "length L per leg (Total radiating wire 2L)", while the immediately following "Reference Length" bullet correctly stated that the `length` parameter is the total radiating wire, split into two legs (`(L - bridge)/2`). The geometry builder (`src/store/antennaGeometry.ts`) confirms that `params.length` is treated as the total radiating length.
**Action:** Updated `docs/antenna-spec.md` to resolve the contradiction by correcting the "Leg Count & Length" bullet to read "2 legs, total radiating length $L$ (sum of both legs)", matching the code implementation and the format used for the Inverted-V.
## 2026-07-31 - Inverted-V Angle and Tip Height Documentation Drift
**Learning:** The documentation for the Inverted-V antenna claimed the user-defined included angle $\alpha$ directly dictated the tip height using $(L/2) \cdot \cos(\alpha/2)$. However, the `calcInvertedVPoints` logic correctly uses the per-leg length $(L - \text{bridge})/2$ and automatically bounds the effective slope (flattening the angle) to prevent the tips from penetrating below the 0.5 m minimum ground threshold (`SLOPING_V_MIN_TIP_Z_M`). The documentation failed to reflect this automatic enforcement.
**Action:** Updated `docs/antenna-spec.md` to accurately define the tip height calculation incorporating the feed bridge dimension and clarifying that the included angle automatically flattens if necessary to maintain minimum tip clearance.
## 2025-03-02 - [Markdown Drift from Code Cleanup]
**Learning:** Static analysis tools (like Knip) only search source code. When developers rename or consolidate duplicate exported constants (e.g., `TERMINATED_DELTA_CENTRE_GAP_M` to `FEED_BRIDGE_LENGTH_M`), Markdown documentation goes out of sync because these tools don't flag string occurrences in `docs/`.
**Action:** When performing or verifying codebase cleanups (especially removing/renaming variables), always run a global search (e.g., `grep -r "VARIABLE_NAME" .`) to ensure technical documentation is updated alongside the codebase.
## 2026-08-01 - Folded Dipole Feedline Support Documentation Drift
**Learning:** The `docs/antenna-spec.md` falsely claimed that feedline support was "Not currently modelled" for the Folded Dipole. However, the codebase (`src/store/antennaStore.ts`) explicitly includes `folded-dipole` in `FEEDLINE_SUPPORTED_TYPES`, and the geometry engine fully generates the feedline shield layout for it just like standard dipoles. The documentation drifted from the implemented physics model.
**Action:** The documentation in `docs/antenna-spec.md` was updated for the Folded Dipole to remove the false claim and explicitly clarify that feedline support is implemented using the standard radiating shield and NEC TL card at the centre bridge.

## 2026-08-02 - Folded Dipole Tag Documentation Drift
**Learning:** The documentation for the Folded Dipole claimed that the bottom (fed) conductor was split into two halves carrying `DIPOLE_LEFT_TAG` / `DIPOLE_RIGHT_TAG`. However, the codebase uses the standard split-fed convention tags `LEFT_LEG_TAG` / `RIGHT_LEG_TAG` for these halves, consistent with the standard dipole. The documentation drifted from the implemented physics constants.
**Action:** Updated `docs/antenna-spec.md` to accurately reflect the use of `LEFT_LEG_TAG` and `RIGHT_LEG_TAG` for the fed conductor halves of the Folded Dipole.
