import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('balance.html', /Flux Balance/);

test('balances an ionic equation with the check', async ({ page }) => {
  await page.goto('/balance.html');
  await page.fill('#eqIn', 'MnO4^- + Fe^2+ + H^+ -> Mn^2+ + Fe^3+ + H2O');
  await page.click('#eqForm button');
  await expect(page.locator('#eqOut .ft-big')).toHaveText('MnO₄⁻ + 5Fe²⁺ + 8H⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O');
  await page.fill('#eqIn', 'Fe + -> ');
  await page.click('#eqForm button');
  await expect(page.locator('#eqOut .ft-err')).toBeVisible();
});

test('molar mass of a hydrate, empirical formula, limiting reagent', async ({ page }) => {
  await page.goto('/balance.html');
  await page.click('#tab-mm');
  await page.fill('#mmIn', 'CuSO4.5H2O');
  await page.click('#mmForm button');
  await expect(page.locator('#mmOut .ft-big')).toContainText('249.68 g/mol');
  await page.click('#tab-emp');
  await page.fill('#empM', '180');
  await page.click('#empForm button[type=submit]');
  await expect(page.locator('#empOut')).toContainText('Empirical formula: CH₂O');
  await expect(page.locator('#empOut')).toContainText('Molecular formula: C₆H₁₂O₆');
  await page.click('#tab-lim');
  await page.fill('#limMasses [data-i="0"]', '28');
  await page.fill('#limMasses [data-i="1"]', '2');
  await page.click('#limForm button[type=submit]');
  await expect(page.locator('#limOut .ft-big')).toHaveText('Limiting reagent: H₂');
});
