## 2024-05-03 - Package Manager Drift
**Learning:** The documentation originally instructed users to use `pnpm`, but the repository strictly uses `npm` (as evidenced by `package-lock.json`, `.npmrc` with `legacy-peer-deps=true`, and the GitHub Actions test workflow which runs `npm ci`). The `README.md` likely drifted from the actual toolchain over time or inherited an old template.
**Action:** The `README.md` was updated to accurately reflect `npm` commands to prevent setup failures and confusion.
## 2025-02-12 - Phantom UI Test Command
**Learning:** `package.json` included a phantom command `"test:ui": "vitest --ui"` which fails out-of-the-box because `@vitest/ui` is deliberately excluded from `devDependencies`. Adding dependencies to fix phantom commands violates strict boundaries on modifying project architecture/configs unnecessarily.
**Action:** When finding phantom scripts in `package.json`, carefully remove the script to align with the actual project state rather than artificially installing dependencies to "make the documentation work".
## 2025-05-10 - Canonical Domain URL Drift
**Learning:** The documentation and agent guidelines referenced the root domain `https://gain.observer` as the hosted URL, but the site's metadata (`index.html` canonical/og links) strictly enforces the `www` subdomain (`https://www.gain.observer/`). Inconsistent domain documentation can cause SEO confusion and duplicate indexing.
**Action:** Ensure all documentation links pointing to the production application match the exact `rel="canonical"` URL defined in the application's main HTML entry point.
## 2024-05-17 - README Scope Drift
**Learning:** The `README.md` file listed only "horizontal dipoles" under its current scope, while the application actually supports multiple other topologies (e.g., inverted-v, sloping-v, delta-loop), leading to an inaccurate representation of the tool's capabilities.
**Action:** Regularly audit the capabilities listed in the README against the actual codebase features to prevent scope drift and ensure the documented features accurately reflect the product's true capabilities.
