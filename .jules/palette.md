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
