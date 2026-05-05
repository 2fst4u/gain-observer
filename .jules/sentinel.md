## 2025-02-20 - [Security Headers via Cloudflare Pages _headers File]
**Vulnerability:** Missing fundamental HTTP security headers (e.g., HSTS, X-Frame-Options, X-Content-Type-Options) in the production deployment.
**Learning:** For Cloudflare Pages deployments built with Vite, security headers must be defined in `public/_headers` so they are copied to `dist/_headers` and served by Cloudflare.
**Prevention:** Ensure any new security headers are appended to the `public/_headers` file.
## 2025-02-21 - [NPM Audit Vulnerabilities Resolution]
**Vulnerability:** Found 3 high-severity vulnerabilities in a transitive development dependency (`serialize-javascript` via `vite-plugin-pwa`).
**Learning:** `npm audit fix` successfully resolves transitively vulnerable packages without requiring overrides, by correctly bumping the lockfile entries for the dependents (`@rollup/plugin-terser` -> `workbox-build`). This emphasizes that build-time dependencies should also be kept secure to maintain a healthy project state.
**Prevention:** Regularly run `npm audit` and use `npm audit fix` to maintain lockfile security, confirming success via tests before submission.
