import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('score.html', /Flux Score/);

test('weighted grade, what-if, target and GPA', async ({ page }) => {
  await page.goto('/score.html');
  // Tests 50%, Homework 30%, Labs 20% by default.
  const row = (i: number, k: string) => page.locator(`#scRows [data-r="${i}"][data-k="${k}"]`);
  await row(0, 's').fill('80'); await row(0, 's').press('Tab');
  await page.click('#scAddRow');
  await row(1, 'cat').selectOption('1');
  await row(1, 's').fill('100'); await row(1, 's').press('Tab');
  // (80×50 + 100×30) / 80 = 87.5
  await expect(page.locator('#scGrade')).toHaveText('87.50%');
  await page.click('#scAddRow');
  await row(2, 's').fill('100'); await row(2, 's').press('Tab');
  await row(2, 'wi').check();
  await expect(page.locator('#scGrade')).toHaveText('87.50%');
  await expect(page.locator('#scWhatIf')).toHaveText('93.75%');
  await page.fill('#tgGoal', '90');
  await expect(page.locator('#tgOut .ft-big')).toContainText('You need');
  await page.click('#tab-gpa');
  await page.locator('#gpRows [data-k="g"]').first().fill('A-');
  await page.locator('#gpRows [data-k="g"]').first().press('Tab');
  await page.click('#gpAdd');
  await page.locator('#gpRows [data-k="g"]').nth(1).fill('85');
  await page.locator('#gpRows [data-k="g"]').nth(1).press('Tab');
  await expect(page.locator('#gpValue')).toHaveText('GPA 3.35 / 4.0');
  await page.reload();
  await expect(page.locator('#gpValue')).toHaveText('GPA 3.35 / 4.0');
});
