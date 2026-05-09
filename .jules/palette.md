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
