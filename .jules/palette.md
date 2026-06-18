## 2024-05-15 - ARIA Region on Loading States
**Learning:** In React components that render placeholder text (like "Computing…") during async operations, failing to include `role="status"` and `aria-live="polite"` means screen readers remain completely silent during long calculations, leading to confusion.
**Action:** Always add `role="status"` and `aria-live="polite"` to loading/computing placeholder `<div>` elements.
