import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C7 — Web Push happy path (client contract).
 *
 * Real subscription + delivery needs VAPID keys and a push service (manual
 * QA rows); sending policy (quiet hours, overnight) is server-side in
 * notify-push. Here we pin the opt-in surface: card renders behind the
 * flag with honest copy, unsupported browsers get a graceful message,
 * and subscribe() fails cleanly (no throw) without keys/permission.
 */

test.describe('Web push opt-in (client contract)', () => {
  test('flag on: card renders with honest quiet-hours copy', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_web_push: true };
      await w.FluxFeatureFlags.load({ force: true });
      const host = document.createElement('div');
      host.id = 'wpTestHost';
      document.body.appendChild(host);
      w.FluxWebPush.renderCard(host, { supported: true, subscribed: false });
    });
    const host = page.locator('#wpTestHost');
    await expect(host).toContainText('Due-soon reminders');
    await expect(host).toContainText('Honors your quiet hours');
    await expect(host).toContainText('nothing sends overnight');
    await expect(host.locator('#fluxPushToggle')).not.toBeChecked();
  });

  test('unsupported browser gets a graceful message, no toggle', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => {
      const w = window as any;
      const host = document.createElement('div');
      host.id = 'wpUnsupported';
      document.body.appendChild(host);
      w.FluxWebPush.renderCard(host, { supported: false, subscribed: false });
    });
    const host = page.locator('#wpUnsupported');
    await expect(host).toContainText('does not support push');
    await expect(host.locator('#fluxPushToggle')).toHaveCount(0);
  });

  test('subscribe() without VAPID key fails cleanly with a human error', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_VAPID_PUBLIC_KEY = '';
      return w.FluxWebPush.subscribe();
    });
    expect(r.ok).toBe(false);
    expect(String(r.error)).toMatch(/not configured|not supported|Sign in/i);
  });

  test('flag off: no card injected on settings', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_web_push: false };
      await w.FluxFeatureFlags.load({ force: true });
      await w.FluxWebPush.injectCard();
    });
    await expect(page.locator('#fluxWebPushCard')).toHaveCount(0);
  });
});
