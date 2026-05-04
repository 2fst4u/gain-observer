import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');

  // Wait for the app to load and the simulation to complete
  await page.waitForSelector('.stat-value');

  // Take a screenshot of the whole page
  await page.screenshot({ path: 'screenshot-normal.png', fullPage: true });

  // Try to find a scenario with high SWR to test scaling
  // We can do this by changing the frequency to something off-resonance
  // The frequency input is in FrequencyControl.tsx
  const freqInput = await page.locator('input[aria-label="Frequency"]');
  await freqInput.fill('1.8'); // Very low frequency for a 40m dipole
  await page.keyboard.press('Enter');

  // Wait for update
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-high-swr.png', fullPage: true });

  await browser.close();
})();
