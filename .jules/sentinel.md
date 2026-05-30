## 2025-02-14 - Prevent Unsafe Dynamic Imports

**Learning:** Dynamic imports (`import(url)`) using unsanitized or insufficiently validated inputs can lead to arbitrary code execution if an attacker supplies a `data:` or `blob:` URI. Constructing URLs with `new URL()` does not inherently prevent this if the base origin is dynamically determined and the result is not checked.
**Action:** When working with dynamic module loading, always parse the final constructed URL string using `new URL(url, 'http://localhost/')` (to handle relative paths gracefully) and explicitly validate that the `protocol` is in an allowed set (e.g., `['http:', 'https:', 'file:']`) before passing it to `import()`.
## 2025-02-14 - Prevent Unsafe Protocols in Asset Resolution
**Vulnerability:** The `resolveAsset` method in `Nec2Engine` dynamically constructed absolute URLs for assets but lacked validation, potentially allowing arbitrary protocol execution (e.g., `data:` or `blob:`) if `baseUrl` or `path` were manipulated.
**Learning:** Even internal utility functions that dynamically construct resource URLs must explicitly validate protocols to prevent SSRF or unsafe code execution, ensuring defense in depth.
**Prevention:** Always validate the `protocol` of dynamically generated `URL` objects against a strict allowlist (e.g., `['http:', 'https:', 'file:']`) before returning or using them for asset fetching.
