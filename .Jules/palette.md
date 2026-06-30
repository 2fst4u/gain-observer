## 2024-05-28 - Double announcement on range sliders
**Learning:** `<input type="range">` elements with visible `<label>` text that displays the current value will cause screen readers to announce the value twice (once for the label, once for the input native value).
**Action:** When a visible label includes dynamic state text for a slider, always explicitly add a static `aria-label` to the `<input type="range">` so it overrides the visible label association and prevents redundant value announcements.
## 2024-05-28 - Missing `aria-describedby` for complex type select element
**Learning:** `DipoleControl.tsx` has a `<select>` for antenna type, but no `aria-describedby` link to the helper hint text about how to set up the selected antenna. This makes the interface less intuitive for screen reader users as they miss context.
**Action:** Always link `<select>` elements with complex options to a hint text element via `aria-describedby` when context changes based on selection.
## 2024-05-28 - Missing ARIA alert on global error boundary
**Learning:** React ErrorBoundary fallback UIs for rendering app crashes do not natively announce themselves to screen readers because they replace the current DOM without a page reload or focus shift.
**Action:** Always add `role="alert"` and `aria-live="assertive"` to the container of critical error messages or crash fallbacks so screen reader users are immediately notified.
## 2024-05-28 - Dynamic hint text accessibility
**Learning:** Even when a dynamic hint text is linked to an input via `aria-describedby`, screen readers may not reliably announce changes to the hint text if focus remains on the input while the hint changes (e.g. using arrow keys in a `<select>` or adjusting a `<input type="range">`).
**Action:** Always add `aria-live="polite"` to dynamic hint text containers (like `#feedline-hint` or `#whip-counterpoise-hint`) so screen reader users are notified immediately when the contextual guidance updates.
## 2026-06-07 - Add aria-live to dynamic ARIA descriptions\n**Learning:** When linking an `<input>` (like a slider or dropdown) to a hint `<div>` via `aria-describedby` where the hint's text updates dynamically as the input changes, adding `aria-live="polite"` to the hint `<div>` ensures screen readers announce the state change without stealing focus.\n**Action:** Add `aria-live="polite"` to all dynamic hint containers targeted by `aria-describedby`.
## 2024-06-10 - Static vs Dynamic aria-live
**Learning:** `aria-live="polite"` should only be used for DOM nodes whose text updates dynamically after the initial render. Adding it to static hint text containers is unnecessary, as `aria-describedby` will reliably handle the reading of the description when the linked input is focused.
**Action:** Do not apply `aria-live="polite"` to purely static helper text elements.
## 2024-08-01 - Missing advertised keyboard shortcuts
**Learning:** Keyboard shortcuts advertised visually in the UI (like "Compare (C)") may not actually be implemented in the central event listener, leading to a broken and confusing user experience.
**Action:** When adding or verifying keyboard shortcuts, ensure both the UI hint (e.g., `aria-keyshortcuts`) and the actual keydown event handler (e.g., `useKeyboardShortcuts` hook) are kept in sync.
## 2024-08-01 - Avoid bare letter C for shortcuts
**Learning:** Using the bare letter `C` (or `c`) as a global keyboard shortcut can interfere with standard operating system and browser commands, such as `Ctrl+C` or `Cmd+C` for copying text.
**Action:** Always verify that proposed keyboard shortcuts do not conflict with common user expectations or essential browser functionality. If a shortcut conflicts, it must be removed or modified to include modifier keys (like Alt or Shift), and the UI documentation must reflect this.
