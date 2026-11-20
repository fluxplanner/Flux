import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('cite.html', /Flux Cite/);

test('a journal article in all four styles, in-text, and the list', async ({ page }) => {
  await page.goto('/cite.html');
  await page.fill('#ciQuick', 'https://doi.org/10.1038/nature12373.');
  await page.press('#ciQuick', 'Tab');
  await expect(page.locator('#ciType')).toHaveValue('journal');
  await expect(page.locator('#ciDoi')).toHaveValue('10.1038/nature12373');
  await page.fill('#ciAuthors', 'Smith, Jane Ann\nDoe, John');
  await page.fill('#ciTitle', 'Cells <script>');
  await page.fill('#ciContainer', 'Nature');
  await page.fill('#ciYear', '2013'); await page.fill('#ciVol', '500'); await page.fill('#ciIssue', '7460'); await page.fill('#ciPages', '54–58');
  await page.selectOption('#ciStyle', 'apa');
  await expect(page.locator('#ciPreview')).toHaveText('Smith, J. A., & Doe, J. (2013). Cells <script>. Nature, 500(7460), 54–58. https://doi.org/10.1038/nature12373');
  await expect(page.locator('#ciPreview i').first()).toHaveText('Nature');
  await expect(page.locator('#ciIntext')).toHaveText('(Smith & Doe, 2013, p. 54)');
  await page.selectOption('#ciStyle', 'mla');
  await expect(page.locator('#ciPreview')).toContainText('Smith, Jane Ann, and John Doe. “Cells <script>.” Nature, vol. 500, no. 7460, 2013, pp. 54–58');
  await page.click('#ciForm button[type=submit]');
  await expect(page.locator('#ciList li')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#ciList li')).toHaveCount(1);
  const dl = page.waitForEvent('download');
  await page.click('#ciBib');
  expect((await dl).suggestedFilename()).toBe('bibliography.bib');
});
