## 2024-05-03 - Missing Button Group Roles and Form Associations in Sidebar Panels
**Learning:** Found a recurring pattern in the sidebar panels where `div`s with `className="button-group"` lacked the explicit `role="group"` and `aria-label`/`aria-labelledby` attributes, meaning screen readers wouldn't announce the options as part of a coherent group. Additionally, several inputs and dropdowns lacked proper implicit or explicit labels (`aria-label`, `htmlFor`).
**Action:** Always ensure that visually grouped toggle buttons have a `role="group"` and `aria-pressed` states. Ensure standalone inputs without text labels have `aria-label`s, and ensure label tags properly associate with their inputs via `htmlFor` and `id`.

## 2024-05-03 - Always Append to Journals
**Learning:** Found that when writing to journal files like `.jules/palette.md` using shell commands (e.g., `cat << 'EOF' > ...`), it is crucial to use the append operator (`>>`) instead of the overwrite operator (`>`). Overwriting destroys historical context and previous critical learnings.
**Action:** Always verify the existence of a journal file and explicitly use the append redirection operator (`>>`) when adding new entries to preserve history.
