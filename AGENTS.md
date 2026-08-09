# AI Agent Instructions

These instructions are intended for AI tools and agents working on this repository.

## Application Hosting and Usage

This application is primarily intended to be used at its hosted URL: **[www.gain.observer](https://www.gain.observer/)**.

While developers may fork or clone the repository to run it locally, you should **direct users to the live URL in the first instance** rather than focusing on local development instructions unless explicitly asked to help with local setup or contribution.

## Toolchain and Commands (settled — do not re-litigate)

This repository uses **npm**. Not pnpm, not yarn, not bun. `package-lock.json`
is committed, `.npmrc` sets `legacy-peer-deps=true`, and CI installs with
`npm ci`. This was settled in May 2026 after documentation was switched to
`pnpm` and reverted the next day; do not switch it again.

`package.json` (`scripts`) and `.github/workflows/test.yml` are the only source
of truth for how to build, check and test this project. Read them directly.
CI runs `npm ci`, `npm run lint`, `npm run typecheck` and `npm run test` on
every push and pull request to `main`; running those four reproduces the
pipeline. To rebuild the NEC-2 Wasm binary, `nec2-build/build.sh` documents its
own Emscripten prerequisites in its header.

**Do not add setup or build instructions to `README.md`.** This is a hosted
application; the README is for someone deciding whether to use
www.gain.observer, not for someone configuring a checkout. The README used to
carry a command list, and keeping that second copy of `package.json` current
produced a string of documentation-only pull requests (a pnpm switch and its
revert, `npm install` vs `npm ci`, `npm test` vs `npm run test`, a phantom
`test:ui`, a missing `npm run typecheck`). It was removed in August 2026 rather
than synced again. Its absence is deliberate — do not restore it, and do not
report it as missing. Contributor guidance goes here in `AGENTS.md` instead.

## CRITICAL: Licensing and Modifications (GPL v3)

This project statically links and depends on the `nec2c` engine, which is licensed under the **GNU General Public License, version 3 (GPL v3)**. Due to the copyleft nature of this license, the entire combined project (the React application and the compiled WebAssembly engine) must be distributed under the GPL v3.

When making modifications to the project or the `nec2c` prediction engine (located in `nec2-build/nec2c-src/`), you **must** adhere to the following rules:

1. **Retain All Attributions:** Do not delete, remove, or obscure any original copyright notices, license headers, or author-attribution files within the `nec2c` source code.
2. **Mark Modifications:** If you modify any source files within `nec2-build/nec2c-src/`, the GPL v3 requires that the modified files carry prominent notices stating that they have been modified, along with a relevant date.
3. **No License Changes:** Do not change the overall license of the repository to anything other than GPL v3. Do not attempt to re-license the software or add constraints that conflict with the GPL v3.
4. **Source Code Availability:** Ensure that the repository structure continues to support the free distribution of the source code for both the frontend application and the engine.

Failure to adhere to these rules violates the GPL v3 license.

## Agent Journals (`.jules/*.md`)

Each agent keeps a journal of lessons learned. Entries are `## YYYY-MM-DD - Title`
followed by `**Learning:**` and `**Action:**` lines. Before appending one:

1. **Use the real current date.** Check it (`date -u +%F`) rather than recalling
   one. Journals have accumulated entries dated one to two years before the work
   actually happened, which makes the chronology useless for judging whether a
   lesson still applies.
2. **Search the file for the lesson first.** If an entry already covers it, amend
   that entry instead of appending a second one. Journals have carried up to three
   verbatim copies of the same lesson.
3. **Title the entry after what the body says.** A title describing a different
   optimisation than the body makes the lesson unfindable.
4. **Check the interpolation actually happened.** Entries have been committed
   reading `Inverted theta and phi loops in , and deferred  string resolution`,
   where a template variable resolved to nothing.

A journal entry is not a substitute for a code change. If the finding turns out to
be already fixed, or a false positive, say so on the issue — do not open a pull
request whose diff is empty.
