import { test, expect } from '@playwright/test';

/**
 * The part of moderation that runs in the planner for everyone: the lock screen.
 * The owner's tools moved to Owner Controls (e2e/owner-app.spec.ts). Bans
 * themselves are enforced by the database and tested there.
 */
test('a banned response shows the lock screen', async ({ page }) => {
  await page.goto('/?e2e=1&scenario=guest');
  await page.waitForFunction(() => !!(window as any).FluxOwnerModeration);
  await page.evaluate(() => {
    (window as any).getSB = () => ({
      rpc: async () => ({ data: null, error: { code: 'PT403', message: 'flux_banned' } }),
    });
    (window as any).FluxOwnerModeration.checkIn();
  });
  await expect(page.locator('#fluxBanLock')).toContainText('Access to Flux has been removed');
});
