import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('data.html', /Flux Data/);

test('summary, regression and chi-squared on a pasted table', async ({ page }) => {
  await page.goto('/data.html');
  await page.fill('#dtIn', 'x,y\n1,2\n2,4\n3,6\n4,8');
  await expect(page.locator('#dtSum')).toContainText('2.5');
  await page.click('#tab-reg');
  await expect(page.locator('#dtEq')).toHaveText('y = 2x + 0');
  await expect(page.locator('#dtR2')).toHaveText('1');
  // A textbook case: observed 50/30/20 against 40/40/20 → χ² = 5, df 2, p ≈ 0.082.
  await page.fill('#dtIn', 'Observed\tExpected\n50\t40\n30\t40\n20\t20');
  await page.click('#tab-chi');
  await expect(page.locator('#dtX2')).toHaveText('5');
  await expect(page.locator('#dtP')).toHaveText('0.0821');
  const dl = page.waitForEvent('download');
  await page.click('#tab-sum'); await page.click('#dtSumCsv');
  expect((await dl).suggestedFilename()).toBe('flux-data-summary.csv');
});
