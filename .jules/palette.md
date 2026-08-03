## 2024-05-15 - ARIA Region on Loading States
**Learning:** In React components that render placeholder text (like "Computing…") during async operations, failing to include `role="status"` and `aria-live="polite"` means screen readers remain completely silent during long calculations, leading to confusion.
**Action:** Always add `role="status"` and `aria-live="polite"` to loading/computing placeholder `<div>` elements.
## 2024-05-16 - aria-valuetext on Range Inputs
**Learning:** Range inputs (`<input type="range">`) announce only their raw numeric value to screen readers by default. In a highly technical app with mixed units (meters, feet, degrees, dB), this lacks context.
**Action:** Always provide an `aria-valuetext` attribute on range sliders that includes both the formatted value and its specific unit (e.g., `aria-valuetext="10.0 m"`).
## 2024-07-05 - Keyboard Toggles and Form Labels
**Learning:** Keyboard shortcuts for toggling app modes (like 'm' for Mode) should genuinely toggle between available states rather than just resetting to the default state, as users expect a toggle behavior. Additionally, primary control headings (like "Frequency" and "Ground") should act as `<label>`s linked to their respective inputs via `htmlFor` to provide a larger click target and improve screen reader context.
**Action:** Always implement shortcuts as true toggles when alternating between two distinct states, and explicitly bind section headings to primary inputs when the heading acts as the de facto visual label.
## 2026-07-08 - Bind Headings to Inputs
**Learning:** Headings that conceptually label a section's primary input (like "Antenna" or "Feedline") should act as explicit `<label>` elements bound to the input via `htmlFor`. This prevents screen readers from encountering redundant, unhelpful labels (like "Type" under "Antenna") and increases the click target size.
**Action:** Always wrap the section heading text in a `<label htmlFor="...">` when it naturally acts as the visual label for a primary control, and remove the visually redundant inner label.
## 2026-07-11 - Semantic Group Labels\n**Learning:** Using `<label>` elements without an associated form control (via `htmlFor` or nesting) for labeling non-standard groups like `role="group"` button collections is an accessibility anti-pattern and invalid HTML semantics. \n**Action:** Use a generic element like `<div className="stat-label">` styled appropriately when acting as a label for an `aria-labelledby` container instead of a true `<label>`.
## 2025-07-15 - Accessible Tooltips for Disabled Buttons
**Learning:** Native `disabled` attributes on buttons completely remove them from the keyboard focus order and swallow mouse hover events in most browsers, making `title` tooltips explaining the disabled state invisible to both mouse and keyboard users.
**Action:** Use `aria-disabled="true"` with conditional `onClick` handlers and matching CSS styles (`button[aria-disabled="true"]`) instead of native `disabled` when a button requires an explanatory tooltip.
## 2024-07-23 - Prevent layout shift with persistent disabled action buttons
**Learning:** Disappearing action buttons (like "Match ratio") after being clicked cause jarring layout shifts and remove the indication that the feature exists. They also disrupt screen reader focus.
**Action:** Use `aria-disabled="true"` with an updated `title` explaining the disabled state instead of conditionally rendering the button out of the DOM. This provides consistent UI and reassures users their setting is optimal.
## 2026-07-24 - Added aria-controls to Ground Settings toggle
**Learning:** When using `aria-expanded` on a toggle button to reveal conditionally rendered React content, ensure the target content is wrapped in a container element with an explicit ID, and link the button via `aria-controls` to maintain strict accessibility semantics.
**Action:** Always check that toggle buttons with `aria-expanded` also have a matching `aria-controls` attribute, and refactor React fragments to `div`s if an ID anchor is missing.

## 2025-02-26 - Add animated chevron to disclosure widget
**Learning:** Disclosure widgets (like the "Model & assumptions" button) benefit greatly from a visual indicator showing their state. An animated chevron provides clear visual affordance and smooth feedback, improving discoverability and making it obvious that the component is an accordion/disclosure.
**Action:** Use inline SVG chevrons with `transform: rotate()` transitions tied to `aria-expanded` state on disclosure buttons.
## 2026-07-30 - Prevent layout shift with persistent disabled action buttons\n**Learning:** Disappearing action buttons (like "Match ratio") after being clicked cause jarring layout shifts and remove the indication that the feature exists. They also disrupt screen reader focus.\n**Action:** Use `aria-disabled="true"` with an updated `title` explaining the disabled state instead of conditionally rendering the button out of the DOM. This provides consistent UI and reassures users their setting is optimal.
## 2024-07-31 - Semantic feedback on custom input validation
**Learning:** In custom text inputs that accept parsed formats (like a UTC hour "HH:mm" input), when an invalid format is typed, the internal parser naturally returns null. If the input silently ignores it, screen readers receive no feedback that the value is invalid.
**Action:** Always dynamically bind `aria-invalid` to the result of the validation/parsing function (e.g., `aria-invalid={parse(value) === null}`) to provide immediate semantic feedback to screen readers for custom inputs.
## 2025-02-09 - Fix invalid aria-controls references for disclosure widgets
**Learning:** React conditional rendering (`{expanded && <div id="panel">}`) breaks `aria-controls` because the target ID must remain in the DOM even when the panel is collapsed, otherwise screen readers report a broken reference.
**Action:** Use the HTML `hidden` attribute (e.g., `<div id="panel" hidden={!expanded}>`) for the content container of any disclosure widget instead of unmounting the element from the DOM entirely.
