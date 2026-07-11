## 2025-02-14 - Prevent Unsafe Dynamic Imports

**Learning:** Dynamic imports (`import(url)`) using unsanitized or insufficiently validated inputs can lead to arbitrary code execution if an attacker supplies a `data:` or `blob:` URI. Constructing URLs with `new URL()` does not inherently prevent this if the base origin is dynamically determined and the result is not checked.
**Action:** When working with dynamic module loading, always parse the final constructed URL string using `new URL(url, 'http://localhost/')` (to handle relative paths gracefully) and explicitly validate that the `protocol` is in an allowed set (e.g., `['http:', 'https:', 'file:']`) before passing it to `import()`.
## 2025-02-14 - Prevent Unsafe Protocols in Asset Resolution
**Vulnerability:** The `resolveAsset` method in `Nec2Engine` dynamically constructed absolute URLs for assets but lacked validation, potentially allowing arbitrary protocol execution (e.g., `data:` or `blob:`) if `baseUrl` or `path` were manipulated.
**Learning:** Even internal utility functions that dynamically construct resource URLs must explicitly validate protocols to prevent SSRF or unsafe code execution, ensuring defense in depth.
**Prevention:** Always validate the `protocol` of dynamically generated `URL` objects against a strict allowlist (e.g., `['http:', 'https:', 'file:']`) before returning or using them for asset fetching.
## 2025-02-14 - Remove Unsafe Inline Styles in CSP
**Vulnerability:** The `style-src` directive in the Content-Security-Policy included `'unsafe-inline'`, which could allow attackers to inject malicious CSS or exploit cross-site scripting (XSS) vulnerabilities.
**Learning:** Vite relies on injecting `<style>` tags during development (`npm run dev`), which necessitates `'unsafe-inline'` to prevent CSP violations. However, the production build (`npm run build`) correctly extracts CSS into separate files and React's inline styles apply via CSSOM, which complies with `style-src 'self'`.
**Prevention:** Remove `'unsafe-inline'` from `style-src` in production headers (e.g., `public/_headers` and `index.html`) to maintain strict CSP and enforce secure style delivery, relying on Vite's asset extraction for production.
## 2025-02-14 - Fix Unsafe Regex Replace for Numbers
**Vulnerability:** The `HHmmToHour` function previously used an unsafe regular expression (`/[^0-9]/g`) to strip non-numeric characters from a time string. While currently constrained by UI length limits, a maliciously long input could cause catastrophic backtracking or excessive CPU consumption, leading to a Denial of Service (ReDoS).
**Learning:** Avoid using global regex replacements on unbounded or large input strings, especially when simple character code checks can achieve the same result more safely and deterministically.
**Prevention:** Replace global regex replacements with explicit `for` loop iterations that validate character codes (e.g., `charCode >= 48 && charCode <= 57`), and always enforce a maximum input string length at the start of the function.
## 2026-07-11 - Fix URL parser differential vulnerability
**Vulnerability:** The code validated a URL's protocol using `new URL()`, but subsequently passed the original, unvalidated string into a dynamic `import()`. A parser differential (e.g., how leading spaces or malformed file/data prefixes are handled between `new URL` and `import`) could allow a malicious URL (like a `data:` URI with payload) to bypass the protocol allowlist.
**Learning:** Always use the `href` property of the *validated* URL object (`parsedUrl.href`) instead of the original raw string when passing it to the final execution sink. This eliminates Time-of-Check to Time-of-Use (TOCTOU) issues caused by parser discrepancies.
**Action:** Changed `import(url)` to `import(parsedUrl.href)` in `nec2Engine.ts`.
