## 2024-05-03 - Missing Button Group Roles and Form Associations in Sidebar Panels
**Learning:** Found a recurring pattern in the sidebar panels where `div`s with `className="button-group"` lacked the explicit `role="group"` and `aria-label`/`aria-labelledby` attributes, meaning screen readers wouldn't announce the options as part of a coherent group. Additionally, several inputs and dropdowns lacked proper implicit or explicit labels (`aria-label`, `htmlFor`).
**Action:** Always ensure that visually grouped toggle buttons have a `role="group"` and `aria-pressed` states. Ensure standalone inputs without text labels have `aria-label`s, and ensure label tags properly associate with their inputs via `htmlFor` and `id`.

## 2024-05-03 - Always Append to Journals
**Learning:** Found that when writing to journal files like `.jules/palette.md` using shell commands (e.g., `cat << 'EOF' > ...`), it is crucial to use the append operator (`>>`) instead of the overwrite operator (`>`). Overwriting destroys historical context and previous critical learnings.
**Action:** Always verify the existence of a journal file and explicitly use the append redirection operator (`>>`) when adding new entries to preserve history.

## 2024-05-04 - Keyboard Navigation Focus Indicators
**Learning:** Found that keyboard navigation was lacking explicit visual feedback (`:focus-visible`) across the UI, particularly for interactive elements like buttons, inputs, and selects. Adding global `:focus-visible` styles with a high-contrast accent color greatly improves keyboard accessibility without negatively impacting mouse users.
**Action:** Always verify keyboard accessibility and add clear `:focus-visible` styles to interactive elements when building out new UIs or auditing existing ones.

## 2024-05-05 - Propagation Control ARIA Additions
**Learning:** In complex control panels, async UI state (like geolocation requesting) requires explicit `aria-live` and `aria-busy` announcements so screen readers know a background action is pending and eventually completed. Furthermore, supplementary help text near inputs must be explicitly linked via `aria-describedby` so it isn't skipped when users tab directly to the input field.
**Action:** Always verify `aria-busy` and `aria-live` are present for async button interactions, and link form hints to their associated inputs using matching `id` and `aria-describedby` attributes.
## 2024-05-06 - Dynamic Form Hints and ARIA describedby
**Learning:** Adding dynamic, contextual helper text below form controls (like `<select>` dropdowns or `<input>` ranges) is a common pattern in the side panels. However, without an explicit `aria-describedby` mapping, screen reader users miss this critical context when they navigate directly to the input via keyboard tabbing.
**Action:** Always wrap supplementary helper text in a `div` or `span` with a unique `id`, and link it to the associated interactive control using the `aria-describedby` attribute. This ensures screen readers announce the helper text alongside the input label.
## 2024-05-08 - Dynamic Tooltips for Disabled States
**Learning:** In dense control panels (like this app), disabling utility buttons without explanation causes user friction. Users often cannot tell why an action (like "Capture Reference" or "Centre Feedline") is unavailable. Providing dynamic tooltips on disabled buttons significantly improves discoverability and clarifies system state.
**Action:** Always add dynamic `title` or `aria-label` properties that change when a button is `disabled`, clearly explaining the constraint.

## 2024-05-18 - Missing Button Group Roles
**Learning:** The `ComparisonControl.tsx` had a `.button-group` component lacking the `role="group"` and `aria-label` attribute, which prevented screen readers from correctly announcing the options as part of a coherent group.
**Action:** Always ensure `.button-group` elements have the required ARIA grouping attributes.

## 2024-05-24 - Resolving WCAG 2.5.3 Label in Name Violations
**Learning:** Using an `aria-label` that completely overrides the visible text of a button (like `aria-label="Meters"` for a button showing "m") violates WCAG 2.5.3 (Label in Name). Speech recognition users might say "Click m" which won't work if the accessible name doesn't contain "m".
**Action:** Always ensure the visible text is included within the `aria-label` (e.g., `aria-label="m (Meters)"`), and use the `title` attribute to provide the expanded tooltip for mouse users.

## 2024-05-25 - ARIA Roles for Loading and Error Overlays
**Learning:** Global application states like "Loading WebAssembly" or solver errors use custom overlay divs (`.loading-overlay`, `.error-banner`). Without explicit ARIA roles and live regions, screen readers are unaware when the application transitions between these states. This leads to a confusing experience where the UI appears frozen to assistive technologies.
**Action:** Always add `role="status"` and `aria-live="polite"` to loading overlays, and add `role="alert"` and `aria-live="assertive"` to error banners. Additionally, mark purely decorative animation elements like spinners with `aria-hidden="true"`.
## 2026-05-13 - Loading Spinner Alignment
**Learning:** Adding a spinner to a button with text requires adjusting the display properties to `flex` and aligning items to the center, along with a gap, to prevent the spinner from sitting awkwardly above or below the text.
**Action:** When adding inline spinners to buttons, ensure the button has `display: 'flex', alignItems: 'center', gap: '6px'` to maintain visual balance and layout.

## 2024-05-26 - Exposing Keyboard Shortcuts
**Learning:** Hidden keyboard shortcuts are great for power users, but they lack discoverability. Additionally, screen readers are not aware of custom JavaScript-based keybindings unless explicitly told.
**Action:** When adding global keyboard shortcuts (like `T` for theme toggle, `U` for unit toggle, or `M`/`N`/`C` for mode switching), always append the shortcut to the visual `title` tooltip (e.g. `(T)`) and add the `aria-keyshortcuts` attribute to the corresponding interactive element.

## 2024-05-27 - Inline Constraint Warnings (Geometry Status)
**Learning:** Found that when a user's requested numeric input (e.g., Sloping V angle) is silently clamped by the system to satisfy physical constraints (e.g., minimum tip height), visual warnings alone are insufficient for accessibility. Without proper ARIA announcements, screen reader users miss the fact that their requested input was overridden by the system, leading to confusion about the actual state of the simulation.
**Action:** When creating inline warning components that display dynamic constraint violations or system overrides (like `GeometryStatus`), always wrap the notification in a container with `role="status"` and `aria-live="polite"` so screen readers are audibly notified of the clamp.
