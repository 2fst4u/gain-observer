## 2024-05-15 - ARIA Region on Loading States
**Learning:** In React components that render placeholder text (like "Computing…") during async operations, failing to include `role="status"` and `aria-live="polite"` means screen readers remain completely silent during long calculations, leading to confusion.
**Action:** Always add `role="status"` and `aria-live="polite"` to loading/computing placeholder `<div>` elements.
## 2024-05-16 - aria-valuetext on Range Inputs
**Learning:** Range inputs (`<input type="range">`) announce only their raw numeric value to screen readers by default. In a highly technical app with mixed units (meters, feet, degrees, dB), this lacks context.
**Action:** Always provide an `aria-valuetext` attribute on range sliders that includes both the formatted value and its specific unit (e.g., `aria-valuetext="10.0 m"`).
