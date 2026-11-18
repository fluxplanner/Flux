import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('lab.html', /Flux Lab/);

test('propagates an uncertainty with the working, and keeps the report', async ({ page }) => {
  await page.goto('/lab.html');
  await page.fill('#lbExpr', 'm / V');
  await page.locator('tr[data-v="m"] [data-k="x"]').fill('10.0');
  await page.locator('tr[data-v="m"] [data-k="d"]').fill('0.1');
  await page.locator('tr[data-v="V"] [data-k="x"]').fill('4.0');
  await page.locator('tr[data-v="V"] [data-k="d"]').fill('0.2');
  // 1% + 5% = 6% of 2.5 = 0.15 → 2.5 ± 0.2
  await expect(page.locator('#lbResult')).toHaveText('2.5 ± 0.2');
  await expect(page.locator('#lbOut')).toContainText('(6%)');
  await page.click('#tab-rep');
  await page.selectOption('#rpKind', 'myp');
  await expect(page.locator('#rpBody h2').first()).toHaveText('Criterion B: Inquiring and designing');
  await page.locator('#rpBody textarea').first().fill('Does temperature change the rate?');
  await page.reload();
  await expect(page.locator('#rpBody textarea').first()).toHaveValue('Does temperature change the rate?');
});
