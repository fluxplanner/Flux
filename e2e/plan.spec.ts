import { test, expect } from '@playwright/test';
import { toolPageBasics } from './tool-page';

toolPageBasics('plan.html', /Flux Plan/);

test('spreads an essay before its deadline and lists what cannot fit', async ({ page }) => {
  // A fixed Monday, so the days are known (wall-clock-test-fixtures memory).
  await page.clock.setFixedTime(new Date('2026-03-09T12:00:00'));
  await page.goto('/plan.html');
  await page.fill('#plName', 'History essay');
  await page.fill('#plDue', '2026-03-16');
  await page.fill('#plHours', '4');
  await page.click('#plForm button[type=submit]');
  await expect(page.locator('#plOut li').first()).toContainText('History essay');
  const minutes = await page.locator('#plOut li .ft-muted').allTextContents();
  const total = minutes.reduce((a, t) => a + parseInt(t.match(/\((\d+) min/)![1], 10), 0);
  expect(total).toBe(240);
  await expect(page.locator('#plOut')).not.toContainText('Mon, Mar 16');
  await expect(page.locator('#plMiss')).toBeEmpty();
  await page.fill('#plName', 'Huge project');
  await page.fill('#plDue', '2026-03-11');
  await page.fill('#plHours', '10');
  await page.click('#plForm button[type=submit]');
  await expect(page.locator('#plMiss')).toContainText('Huge project');
  const dl = page.waitForEvent('download');
  await page.click('#plIcs');
  expect((await dl).suggestedFilename()).toBe('flux-plan.ics');
});
