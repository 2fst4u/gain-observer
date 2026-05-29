## 2024-05-28 - Double announcement on range sliders
**Learning:** `<input type="range">` elements with visible `<label>` text that displays the current value will cause screen readers to announce the value twice (once for the label, once for the input native value).
**Action:** When a visible label includes dynamic state text for a slider, always explicitly add a static `aria-label` to the `<input type="range">` so it overrides the visible label association and prevents redundant value announcements.
## 2024-05-28 - Missing `aria-describedby` for complex type select element
**Learning:** `DipoleControl.tsx` has a `<select>` for antenna type, but no `aria-describedby` link to the helper hint text about how to set up the selected antenna. This makes the interface less intuitive for screen reader users as they miss context.
**Action:** Always link `<select>` elements with complex options to a hint text element via `aria-describedby` when context changes based on selection.
