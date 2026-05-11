## 2025-05-11 - [Inline Styles for SEO Semantics Overriding CSS]
**Learning:** When upgrading a generic `<div>` to a semantic `<h2>` tag, attempting to fully clear browser default styles using inline styles (e.g. `style={{ fontSize: 'inherit' }}`) can inadvertently create a CSS specificity issue where the inline style aggressively overrides the component's actual target CSS class rules.
**Action:** Only use inline styles to reset properties you know aren't governed by a local CSS class (e.g. `margin: 0`), and leave properties like `fontSize` alone so the `.class` rules can apply normally.
