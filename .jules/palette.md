## 2024-05-22 - Add ARIA label to dynamic range input
**Learning:** Range inputs (`<input type="range">`) often lack intrinsic accessible names if they are only associated with visual text but not explicitly linked via `htmlFor` or `aria-labelledby`, or when the label contains dynamic text that may be confusing when announced.
**Action:** Always explicitly verify that custom or generic range inputs have an `aria-label` or are tightly coupled with a clean `<label htmlFor="...">` string to ensure screen reader users understand the control's purpose.

## 2024-05-24 - Avoid 'c' as keyboard shortcut
**Learning:** Do not use 'c' as a global keyboard shortcut as it intercepts and interferes with the native system 'copy' command (Ctrl+C / Cmd+C).
**Action:** Avoid assigning 'c' to application-level keyboard shortcuts in `useKeyboardShortcuts` to preserve native browser functionality.
