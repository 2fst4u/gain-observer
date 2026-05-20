# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/repro_frontend.spec.ts >> Delta Loop presets rendering
- Location: tests/repro_frontend.spec.ts:3:1

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  [[SyntaxError: Cannot use import statement outside a module]]
```

# Page snapshot

```yaml
- main [ref=e3]:
  - region "Radiation Pattern" [ref=e5]:
    - generic [ref=e6]:
      - heading "Radiation Pattern" [level=2] [ref=e7]
      - generic [ref=e8]: Live view
    - status [ref=e12]: Loading NEC-2 WebAssembly…
    - alert [ref=e14]:
      - strong [ref=e15]: "Solver error:"
      - text: "Worker error: Uncaught SyntaxError: Cannot use import statement outside a module"
  - complementary [ref=e16]:
    - generic [ref=e17]:
      - generic [ref=e18]:
        - heading "HF GAIN VISUALIZER" [level=1] [ref=e19]
        - generic [ref=e20]: NEC-2 · WebAssembly
      - generic [ref=e21]:
        - group "Unit system" [ref=e22]:
          - button "m (Meters)" [pressed] [ref=e23] [cursor=pointer]: m
          - button "ft (Feet)" [ref=e24] [cursor=pointer]: ft
        - button "Switch to light mode" [ref=e25] [cursor=pointer]: ☀
    - generic [ref=e26]:
      - heading "Mode" [level=2] [ref=e27]
      - group "Mode" [ref=e28]:
        - button "Normal" [pressed] [ref=e29] [cursor=pointer]
        - button "NVIS" [ref=e30] [cursor=pointer]
        - button "Compare" [ref=e31] [cursor=pointer]
      - generic [ref=e32]: Standard DX pattern view
    - generic [ref=e33]:
      - heading "Frequency 1.900 MHz" [level=2] [ref=e34]:
        - text: Frequency
        - generic [ref=e35]: 1.900 MHz
      - spinbutton "Frequency in MHz" [ref=e37]: "1.900"
      - group "Amateur Radio Bands" [ref=e38]:
        - button "160m" [active] [pressed] [ref=e39] [cursor=pointer]
        - button "80m" [ref=e40] [cursor=pointer]
        - button "60m" [ref=e41] [cursor=pointer]
        - button "40m" [ref=e42] [cursor=pointer]
        - button "30m" [ref=e43] [cursor=pointer]
        - button "20m" [ref=e44] [cursor=pointer]
        - button "17m" [ref=e45] [cursor=pointer]
        - button "15m" [ref=e46] [cursor=pointer]
        - button "12m" [ref=e47] [cursor=pointer]
        - button "10m" [ref=e48] [cursor=pointer]
    - generic [ref=e49]:
      - heading "Antenna" [level=2] [ref=e50]
      - generic [ref=e51]: Type
      - combobox "Type" [ref=e52]:
        - option "Horizontal Dipole"
        - option "Inverted V"
        - option "Sloping V"
        - option "Delta Loop" [selected]
        - option "Terminated Delta"
      - generic [ref=e53]: Length (m)
      - generic [ref=e54]:
        - spinbutton "Length (m)" [ref=e55]: "157.79"
        - button "1λ (Resonate antenna length)" [ref=e56] [cursor=pointer]: 1λ
      - generic [ref=e57]: Height above ground (m) — 10.0
      - slider "Height above ground (m) — 10.0" [ref=e58]: "10"
      - generic [ref=e59]: Termination resistance (Ω)
      - generic [ref=e60]:
        - spinbutton "Termination resistance (Ω)" [ref=e61]: "0"
        - button "Turn off termination resistor" [disabled] [ref=e62]: "Off"
      - generic [ref=e63]: "Unterminated: travelling wave reflects, creating a standing-wave pattern. Use this mode to check whether the antenna structure resonates at the design frequency."
      - generic [ref=e64]: Orientation (°)
      - spinbutton "Orientation (°)" [ref=e66]: "90"
      - group "Orientation presets" [ref=e67]:
        - button "NS" [ref=e68] [cursor=pointer]
        - button "EW" [pressed] [ref=e69] [cursor=pointer]
        - button "NE-SW" [ref=e70] [cursor=pointer]
        - button "NW-SE" [ref=e71] [cursor=pointer]
      - region "Transformer at feedpoint" [ref=e72]:
        - heading "Transformer at feedpoint" [level=3] [ref=e73]
        - generic [ref=e74]:
          - checkbox "Fit transformer / balun at the antenna" [ref=e75]
          - text: Fit transformer / balun at the antenna
        - generic [ref=e76]: No transformer fitted — the feedline shield carries common-mode current and contributes to radiation (often skewing the pattern for off-centre or unbalanced feeds).
    - generic [ref=e77]:
      - 'heading "Ground Custom: Show custom ground settings" [level=2] [ref=e78]':
        - text: Ground
        - 'button "Custom: Show custom ground settings" [ref=e79] [cursor=pointer]': Custom
      - combobox "Ground preset" [ref=e80]:
        - option "Free space"
        - option "Perfect conductor"
        - option "Sea water"
        - option "Fresh water"
        - option "Pastoral (avg)" [selected]
        - option "Dry rocky"
        - option "Urban / industrial"
        - option "Custom…"
      - generic [ref=e81]: UK/EU farmland, default
    - generic [ref=e82]:
      - heading "Feedline" [level=2] [ref=e83]
      - generic [ref=e84]: Cable
      - combobox "Cable" [ref=e85]:
        - option "No feedline"
        - option "RG-58 (50 Ω, ~5 mm)" [selected]
        - option "RG-213 (50 Ω, ~10 mm)"
        - option "LMR-400 (50 Ω, ~10 mm)"
        - option "RG-8X (50 Ω, ~6 mm)"
        - option "Ladder line (450 Ω)"
      - generic [ref=e86]: Common thin coax. Higher loss; flexible.
      - generic [ref=e87]: Length (m)
      - spinbutton "Length (m)" [ref=e88]: "10.00"
      - generic [ref=e89]:
        - generic [ref=e90]: Z₀ / VF
        - generic [ref=e91]: 50 Ω · 0.66
      - generic [ref=e92]:
        - generic [ref=e93]: Cable loss @ 1.90 MHz
        - generic [ref=e94]: 0.19 dB
    - generic [ref=e95]:
      - heading "Results" [level=2] [ref=e96]
      - generic [ref=e97]: Computing…
    - generic [ref=e98]:
      - heading "SWR sweep" [level=2] [ref=e99]
      - status [ref=e100]: Computing frequency sweep…
    - generic [ref=e102]:
      - heading "Propagation T = 30" [level=2] [ref=e103]:
        - text: Propagation
        - generic [ref=e104]: T = 30
      - generic [ref=e105]: T-index
      - spinbutton "Ionospheric T-index" [ref=e107]: "30"
      - paragraph [ref=e108]: Australian IPS T-index. ~30 = quiet, ~100 = active. Look up today's value from your usual space-weather source.
      - generic [ref=e109]: Latitude
      - generic [ref=e110]:
        - spinbutton "Latitude in degrees" [ref=e111]
        - button "Use my location" [ref=e112] [cursor=pointer]
      - paragraph [ref=e113]: Defaults to 0° (equator) until set. Type a value or click "Use my location".
      - generic [ref=e114]: Month
      - combobox "Month override" [ref=e116]:
        - option "Auto (May)" [selected]
        - option "Jan"
        - option "Feb"
        - option "Mar"
        - option "Apr"
        - option "May"
        - option "Jun"
        - option "Jul"
        - option "Aug"
        - option "Sep"
        - option "Oct"
        - option "Nov"
        - option "Dec"
      - generic [ref=e117]: UTC Hour
      - generic [ref=e118]:
        - textbox "UTC hour override" [ref=e119]:
          - /placeholder: HH:mm
          - text: 01:33
        - button "Auto" [disabled] [ref=e120]
      - separator [ref=e121]
      - generic [ref=e122]:
        - generic [ref=e123]: foF2
        - generic [ref=e124]: 3.88 MHz
      - generic [ref=e125]:
        - generic [ref=e126]: hmF2
        - generic [ref=e127]: 342 km
      - generic [ref=e128]:
        - generic [ref=e129]: MUF (selected ray)
        - generic [ref=e130]: 6.81 MHz
      - generic [ref=e131]:
        - generic [ref=e132]: Selected elevation
        - generic [ref=e133]: 30°
      - 'generic "Lower usable frequency: D-layer absorption estimate. Least reliable part of the model — see assumptions." [ref=e134]':
        - generic [ref=e135]: LUF ⓘ
        - generic [ref=e136]: 1.80 MHz
      - separator [ref=e137]
      - status [ref=e138]: Computing antenna pattern…
      - generic [ref=e140]:
        - generic [ref=e141]:
          - generic [ref=e142]: 1× hop
          - generic "within 10% of LUF" [ref=e143]: 1049 km · marginal · usable signal
        - generic [ref=e144]:
          - generic [ref=e145]: 2× hop
          - generic "within 10% of LUF" [ref=e146]: 2098 km · marginal · usable signal
        - generic [ref=e147]:
          - generic [ref=e148]: 3× hop
          - generic "within 10% of LUF" [ref=e149]: 3148 km · marginal · usable signal
      - button "Model & assumptions" [ref=e150] [cursor=pointer]
    - generic [ref=e151]:
      - heading "Display" [level=2] [ref=e152]
      - generic [ref=e153]: Colormap
      - group "Colormap" [ref=e154]:
        - button "viridis" [pressed] [ref=e155] [cursor=pointer]
        - button "turbo" [ref=e156] [cursor=pointer]
        - button "jet" [ref=e157] [cursor=pointer]
      - generic [ref=e158]: Dynamic range — 30 dB
      - slider "Dynamic range — 30 dB" [ref=e159]: "30"
      - generic [ref=e160]: Color max — 10 dBi
      - slider "Color max — 10 dBi" [ref=e161]: "10"
      - generic [ref=e162]: Pattern scale — 1.00×
      - slider "Pattern scale — 1.00×" [ref=e163]: "1"
      - generic [ref=e164]:
        - generic [ref=e165]:
          - checkbox "Ground grid" [checked] [ref=e166]
          - text: Ground grid
        - generic [ref=e167]:
          - checkbox "Axes helper" [checked] [ref=e168]
          - text: Axes helper
        - generic [ref=e169]:
          - checkbox "Polar plots" [checked] [ref=e170]
          - text: Polar plots
    - link "View source on GitHub" [ref=e172] [cursor=pointer]:
      - /url: https://github.com/2fst4u/gain-observer
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  |
  3  | test('Delta Loop presets rendering', async ({ page }) => {
  4  |   const errors: Error[] = [];
  5  |   page.on('pageerror', err => errors.push(err));
  6  |
  7  |   await page.goto('http://localhost:5173');
  8  |
  9  |   // Wait for engine to be ready
  10 |   await page.waitForSelector('text=Solving…', { state: 'detached' });
  11 |
  12 |   // Select Delta Loop
  13 |   await page.selectOption('#antenna-type', 'delta-loop');
  14 |
  15 |   const bands = ['160m', '80m', '60m'];
  16 |   for (const band of bands) {
  17 |     console.log(`Checking band ${band}`);
  18 |     await page.click(`button:has-text("${band}")`);
  19 |
  20 |     // Wait for solve
  21 |     await page.waitForSelector('text=Solving…', { state: 'detached' });
  22 |
  23 |     // Check for errors
  24 |     if (errors.length > 0) {
  25 |       console.error(`Errors found in band ${band}:`, errors);
  26 |     }
> 27 |     expect(errors).toHaveLength(0);
     |                    ^ Error: expect(received).toHaveLength(expected)
  28 |
  29 |     // Check if the 3D canvas is still there
  30 |     const canvas = await page.locator('canvas');
  31 |     await expect(canvas).toBeVisible();
  32 |
  33 |     // Check for any error banner
  34 |     const errorBanner = page.locator('.error-banner');
  35 |     if (await errorBanner.isVisible()) {
  36 |       const text = await errorBanner.innerText();
  37 |       console.error(`Error banner visible in band ${band}: ${text}`);
  38 |     }
  39 |     await expect(errorBanner).not.toBeVisible();
  40 |   }
  41 | });
  42 |
```