# NEC-2 artifact provenance

The exact source revision, local patches and Emscripten toolchain used to produce
the currently committed loader and Wasm are **not recorded in this checkout**.
The expected `nec2c-src` directory is absent. The former build script's hardcoded
`1.7.7` package string does not establish the binary's source version.

The existing artifacts were inspected without modification. Their SHA-256 hashes
are:

| Artifact | SHA-256 |
|---|---|
| `public/nec2.js` | `99c1000929a0f1b6abb431a8d204bbce915236824109205c11edf1a4c644d228` |
| `public/nec2.wasm` | `30f9445b7678931ae3fba2b3c71ecbc60d4131038e3450fb57152bf0d850ba4d` |

These hashes identify the existing artifacts; they do not verify their source or
physics implementation. No replacement binary was built during the accuracy
repair: `emcc` is unavailable in the execution environment, and no exact upstream
source pin was established. Recovering or replacing the original engine remains
an explicit reproducibility limitation.

## Requirements for the next engine build

Before rebuilding, obtain an independently verified NEC source revision and
retain its complete GPL license, authorship and attribution files. Record the
upstream URL, immutable revision, package version and SHA-256 of every source-tree
file in `nec2-build/source-manifest.json`, using this structure:

```json
{
  "schema_version": 1,
  "source": {
    "url": "https://the-verified-upstream/source",
    "revision": "the-immutable-revision-or-release-archive-sha256",
    "version": "the-verified-version"
  },
  "files": {
    "main.c": "the-file-sha256",
    "COPYING": "the-file-sha256"
  }
}
```

The illustrative entries above are not a usable manifest. The real manifest must
list **every** regular file under `nec2c-src`, including headers and attribution
files. Source modifications require dated notices and updated checksums. Review
the manifest against the independently obtained upstream material; a checksum
manifest alone does not authenticate its own claimed upstream origin.

`build.sh` now verifies this manifest before checking for a compiler or compiling.
It refuses a missing source tree, missing manifest, unpinned source, changed
checksums, unlisted files or symlinks. It derives the package version from the
verified manifest rather than guessing one. A successful build writes
`nec2-build/build-manifest.json` containing source checksums, Emscripten version,
compile flags and output hashes. Review and retain that manifest alongside the
new artifacts, then rerun the real-NEC physical regression suite.

This creates an auditable path for future builds. It does not retroactively prove
that the existing Wasm was compiled from a subsequently recovered source tree.
