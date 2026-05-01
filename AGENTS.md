# AI Agent Instructions

These instructions are intended for AI tools and agents working on this repository.

## CRITICAL: Licensing and Modifications (GPL v3)

This project statically links and depends on the `nec2c` engine, which is licensed under the **GNU General Public License, version 3 (GPL v3)**. Due to the copyleft nature of this license, the entire combined project (the React application and the compiled WebAssembly engine) must be distributed under the GPL v3.

When making modifications to the project or the `nec2c` prediction engine (located in `nec2-build/nec2c-src/`), you **must** adhere to the following rules:

1. **Retain All Attributions:** Do not delete, remove, or obscure any original copyright notices, license headers, or author-attribution files within the `nec2c` source code.
2. **Mark Modifications:** If you modify any source files within `nec2-build/nec2c-src/`, the GPL v3 requires that the modified files carry prominent notices stating that they have been modified, along with a relevant date.
3. **No License Changes:** Do not change the overall license of the repository to anything other than GPL v3. Do not attempt to re-license the software or add constraints that conflict with the GPL v3.
4. **Source Code Availability:** Ensure that the repository structure continues to support the free distribution of the source code for both the frontend application and the engine.

Failure to adhere to these rules violates the GPL v3 license.
