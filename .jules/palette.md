## 2024-05-15 - ARIA Labels and Tooltips
**Learning:** Initial scan reveals many interactive elements and form controls missing accessible labels (e.g. `<button>`, `<input>`).
**Action:** Add appropriate `aria-label`s to icon buttons and `htmlFor`/`id` associations to form labels.

## 2024-05-20 - Discrete External Links
**Learning:** External links should be visually secondary to primary app controls to avoid cluttering the interface.
**Action:** Place external links like GitHub source at the bottom of the control panel with muted colors and a subtle separator.

## 2024-05-23 - Linking Labels and Inputs
**Learning:** Orphaned labels and inputs in React components can cause screen readers to fail to announce the purpose of form controls.
**Action:** Always link labels and inputs using explicit `htmlFor` and `id` attributes, even if they're visually adjacent, to ensure maximum compatibility with screen readers.
