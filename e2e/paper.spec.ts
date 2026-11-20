import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('paper.html', /Flux Graph Paper/);

test('each paper draws, and the settings change the drawing', async ({ page }) => {
  await page.goto('/paper.html');
  for (const kind of ['grid', 'dot', 'iso', 'semilog', 'polar', 'staves', 'hand']) {
    await page.selectOption('#ppKind', kind);
    const n = await page.locator('#ppPreview svg line, #ppPreview svg circle').count();
    expect(n, kind).toBeGreaterThan(10);
  }
  await page.selectOption('#ppKind', 'grid');
  const before = await page.locator('#ppPreview line').count();
  await page.fill('#ppStep', '10');
  expect(await page.locator('#ppPreview line').count()).toBeLessThan(before);
  await page.check('#ppTitle');
  await page.fill('#ppTitleText', 'Lab <b>3</b>');
  await expect(page.locator('#ppPreview text')).toContainText('Lab <b>3</b>');
});

test('Save PNG downloads a picture', async ({ page }) => {
  await page.goto('/paper.html');
  const dl = page.waitForEvent('download');
  await page.click('#ppPng');
  expect((await dl).suggestedFilename()).toBe('flux-graph-paper.png');
});
