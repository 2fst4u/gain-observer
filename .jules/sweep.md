## 2024-05-13 - Knip Unused Export Removal
**Learning:** `knip` correctly identifies types that are unused outside of the file they are defined in, but removing the `export` keyword can break TypeScript builds if the types are referenced internally by other *exported* interfaces in the same file. I need to be careful when removing `export` from types and verify that they aren't part of an exported interface's signature.
**Action:** Always check internal usages of a type within the file, especially if it's used in the signature of other exported entities, before deciding to drop the `export` keyword. Run `npm run build` to guarantee safety.
## 2024-05-22 - [Kept for compatibility]
**Learning:** Code Cleanup Safety Pattern: Never remove exported constants or variables that are explicitly marked in comments as 'kept for compatibility' (e.g., DELTA_LOOP_RIGHT_LEG_TAG), even if they appear completely unused in the current repository, to avoid breaking external systems or legacy data parsing.
**Action:** Always read the inline comments of a variable or function before removing it to ensure it is not kept for compatibility reasons.
