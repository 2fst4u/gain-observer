import { test, expect } from '@playwright/test';

test('capture swr chart clipped', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Wait for loading to finish
  await page.waitForSelector('.canvas-container');

  // Set frequency to 1.8 MHz
  const freqInput = page.locator('label:has-text("FREQUENCY (MHZ)") + input, input[aria-label="Frequency (MHz)"]');
  await freqInput.fill('1.8');
  await freqInput.press('Enter');

  // Set wire orientation to NS to change resonance if needed, or just adjust length
  // Default length is 20m for 7.1MHz. For 1.8MHz it should be around 80m.
  // If we leave it at 20m, SWR will be high (already tested).

  // Let's set it to 75m to be near resonance at 1.8MHz
  const lengthInput = page.locator('label:has-text("LENGTH (M)") + input, input[aria-label="Length (m)"]');
  await lengthInput.fill('75');
  await lengthInput.press('Enter');

  // Wait for physics to update
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/home/jules/verification/swr-chart-clipped.png' });

  // Check if we can see the ">" in the stats
  const bwText = await page.locator('.stat:has-text("2:1 BW") .stat-value').textContent();
  console.log('Bandwidth text:', bwText);
});
