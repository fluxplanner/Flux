import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/* "Watch how" opens a video with the same steps written out beneath it. The
   test browser may not decode H.264, so the file is checked by its response. */

async function expectGuide(page: Page, title: string, file: string) {
  await expect(page.getByRole('dialog', { name: title })).toBeVisible();
  await expect(page.locator('#fluxHowToVideo')).toHaveAttribute('src', file);
  expect(await page.locator('#fluxHowToModal li').count()).toBeGreaterThan(3);
  const res = await page.request.get(file);
  expect(res.status()).toBe(200);
  expect((await res.body()).length).toBeGreaterThan(50000);
  await page.keyboard.press('Escape');
  await expect(page.locator('#fluxHowToModal')).toHaveCount(0);
}

test('Schoology and Canvas each offer a how-to video', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoScenario(page, 'student-semester');

  await page.locator('#sidebar .nav-item[data-tab="schoology"]').click();
  await page.locator('#schoology.active').getByRole('button', { name: 'Watch how' }).click();
  await expectGuide(page, 'How to connect Schoology', 'public/videos/connect-schoology.mp4');

  await page.evaluate(() => (window as any).nav('canvas'));
  await page.locator('#canvas.active').getByRole('button', { name: 'Watch how' }).click();
  await expectGuide(page, 'How to connect Canvas', 'public/videos/connect-canvas.mp4');
});
