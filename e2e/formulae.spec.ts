import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('formulae.html', /Flux Formulae/);

test('search finds a formula and the pad solves for the blank', async ({ page }) => {
  await page.goto('/formulae.html');
  await page.fill('#fmQ', 'momentum');
  await expect(page.locator('#fmList [data-use]').first()).toBeVisible();
  await page.fill('#fmQ', 'zzzz-none');
  await expect(page.locator('#fmList')).toContainText('No formula matches');
  await page.fill('#fmQ', 'F = ma');
  await page.locator('#fmList [data-use="F = ma"]').click();
  await expect(page.locator('#fmEq')).toHaveValue('F = m*a');
  await page.fill('#fmVars [data-v="F"]', '');
  await page.fill('#fmVars [data-v="m"]', '3');
  await page.fill('#fmVars [data-v="a"]', '4');
  await expect(page.locator('#fmOut .ft-big')).toHaveText('F = 12');
  await page.fill('#fmEq', 'v = u + a*t');
  await page.fill('#fmVars [data-v="v"]', '20');
  await page.fill('#fmVars [data-v="u"]', '4');
  await page.fill('#fmVars [data-v="a"]', '');
  await page.fill('#fmVars [data-v="t"]', '8');
  await expect(page.locator('#fmOut .ft-big')).toHaveText('a = 2');
  await page.fill('#fmEq', 'v = u + ');
  await expect(page.locator('#fmOut .ft-err')).toBeVisible();
});
