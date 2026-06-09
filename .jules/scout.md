## 2025-05-11 - [Inline Styles for SEO Semantics Overriding CSS]

**Learning:** When upgrading a generic `<div>` to a semantic `<h2>` tag, attempting to fully clear browser default styles using inline styles (e.g. `style={{ fontSize: 'inherit' }}`) can inadvertently create a CSS specificity issue where the inline style aggressively overrides the component's actual target CSS class rules.
**Action:** Only use inline styles to reset properties you know aren't governed by a local CSS class (e.g. `margin: 0`), and leave properties like `fontSize` alone so the `.class` rules can apply normally.

## 2025-05-13 - [Semantic HTML Structure]

**Learning:** Upgrading generic `<div>` wrappers to `<section>` tags provides excellent semantic document outlining without requiring changes to CSS styles (assuming classes are applied correctly on the new tags), making it a highly effective and safe SEO boost.
**Action:** Always verify with `git diff` that the correct opening and closing tags were updated and no CSS classes were lost during the replacement.

## 2025-05-18 - [Dynamic Document Title in SPAs]

**Learning:** Adding a dynamic `<title>` update based on user state (e.g., selected antenna and frequency) via `useEffect` in a top-level component (`App.tsx`) is a highly effective, <50-line SEO boost for single-page applications. It improves indexability and SERP snippets without altering visual design.
**Action:** When working as Scout on SPAs without SSR, look for opportunities to dynamically update `document.title` based on the core application state to create unique titles for different configurations.

## 2025-05-18 - [Semantic Upgrades and Rejections]

**Learning:** Adding dynamic document titles to SPAs is not always a desirable SEO change, possibly due to specific project content strategies or avoiding excessive JavaScript-driven metadata updates.
**Action:** Always verify if dynamic metadata generation is aligned with the project's specific SEO strategy before implementing.

## 2026-05-19 - [Preserving visual layout with Semantic Header Upgrades]

**Learning:** When upgrading a generic `<div>` title to a semantic header like `<h3>` to establish a proper document outline for crawlers, you can preserve the exact original visual design by applying `style={{ fontSize: 'inherit', margin: 0 }}`. This prevents the browser's default block margins and larger font sizes for header tags from breaking the UI.
**Action:** When working as Scout, utilize this inline style pattern safely when promoting pseudo-headers into actual semantic heading tags.

## 2026-05-20 - [Execution Plan Constraints for Scout]

**Learning:** When generating a plan as Scout, do not include conditional logic or exploratory tasks in the final execution plan. Also ensure that testing and linting steps are explicitly listed before the pre-commit step, and that the pre-commit step itself strictly follows the required format.
**Action:** Always fully explore the codebase first, identify the specific DOM element and file to edit, and then formulate a plan with exact steps, including a dedicated test/lint verification step before the pre-commit step.
## 2024-05-27 - Upgrading Fragments to Semantic Sections

**Learning:** When React components return fragments (`<>...</>`) containing headings (like `<h3>`), these structures are rendered as "div soup" or flat content blocks in the DOM, which obscures the document outline for search engines and screen readers.
**Action:** When a fragment conceptually represents a distinct section of content with a heading, upgrade the fragment to a `<section>` tag and use `aria-labelledby` linked to the heading's `id`. This provides clear semantic landmarks without altering visual styling.
## 2024-05-28 - React Three Fiber `<Canvas>` SEO
**Learning:** The R3F `<Canvas>` component renders an opaque WebGL context that is inherently invisible to search engines and screen readers.
**Action:** Apply `role="img"` and a descriptive `aria-label` directly to the `<Canvas>` element to provide semantic context.
## 2026-06-09 - Semantics for Colormap Legend\n**Learning:** Using `<figure>` and `<figcaption>` to group related content, instead of generic `<div>`s, adds semantic value without fundamentally modifying the rendering logic or user interaction. Testing confirmed this structural change integrates cleanly with existing styles and React components.\n**Action:** Look for generic containers acting as labels or grouped elements (like legends) and upgrade them to HTML5 semantic structural tags.
