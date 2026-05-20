import { test, expect } from '@playwright/test';

test('Delta Loop presets rendering', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', err => errors.push(err));

  await page.goto('http://localhost:5173');

  // Wait for engine to be ready
  await page.waitForSelector('text=Solving…', { state: 'detached' });

  // Select Delta Loop
  await page.selectOption('#antenna-type', 'delta-loop');

  const bands = ['160m', '80m', '60m'];
  for (const band of bands) {
    console.log(`Checking band ${band}`);
    await page.click(`button:has-text("${band}")`);

    // Wait for solve
    await page.waitForSelector('text=Solving…', { state: 'detached' });

    // Check for errors
    if (errors.length > 0) {
      console.error(`Errors found in band ${band}:`, errors);
    }
    expect(errors).toHaveLength(0);

    // Check if the 3D canvas is still there
    const canvas = await page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check for any error banner
    const errorBanner = page.locator('.error-banner');
    if (await errorBanner.isVisible()) {
      const text = await errorBanner.innerText();
      console.error(`Error banner visible in band ${band}: ${text}`);
    }
    await expect(errorBanner).not.toBeVisible();
  }
});
