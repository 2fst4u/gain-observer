1. **Optimize `getColormapCssGradient` in `src/utils/colormap.ts`**
   - Replace the `table.map()` call with a pre-allocated array and a standard `for` loop.
   - This avoids intermediate array allocations and callback execution overhead as per the performance pattern.
   - Add a comment explaining the `⚡ Bolt` optimization.

2. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run tests and linters to verify the change.

3. **Submit the change**
   - Create a PR with title "⚡ Bolt: Optimize getColormapCssGradient to use pre-allocated array and for loop".
