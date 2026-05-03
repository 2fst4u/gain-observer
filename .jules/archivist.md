## 2024-05-03 - Package Manager Drift
**Learning:** The documentation originally instructed users to use `pnpm`, but the repository strictly uses `npm` (as evidenced by `package-lock.json`, `.npmrc` with `legacy-peer-deps=true`, and the GitHub Actions test workflow which runs `npm ci`). The `README.md` likely drifted from the actual toolchain over time or inherited an old template.
**Action:** The `README.md` was updated to accurately reflect `npm` commands to prevent setup failures and confusion.
