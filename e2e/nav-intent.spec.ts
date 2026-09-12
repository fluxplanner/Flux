import { expect, test } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Post-auth routing runs behind `await FluxRole.load()`. On a plain refresh that
 * resolves a few hundred ms after the shell is already clickable, so anyone who
 * opened a tab in the meantime was silently thrown back to their home panel —
 * "some refreshes undo the planner travelling".
 *
 * fluxRouteAfterAuth() now goes through fluxNavHome(), which stands down once a
 * real click on a nav control has been seen. These tests drive the routing
 * directly rather than racing the network, so they are deterministic.
 */
test.describe('boot routing respects where the user navigated', () => {
  test('late post-auth routing leaves a user-chosen tab alone', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');

    // A real click — this is what marks navigation intent.
    await openSidebarTab(page, 'settings');

    // Now fire the routing that a refresh would run once the role load resolves.
    await page.evaluate(async () => {
      await (window as any).fluxRouteAfterAuth('sign-in');
    });

    // nav() hands the panel swap to FluxAppleMotion, so the switch lands a few
    // frames later. Without this wait the assertion reads the pre-swap DOM and
    // passes even when routing did steal the panel.
    await page.waitForTimeout(1200);

    await expect(page.locator('#settings.panel.active')).toBeVisible();
    await expect(page.locator('#teacherDashboard.panel.active')).toHaveCount(0);
  });

  test('routing still lands on the role home when the user has not navigated', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');

    // No click: clear the flag to model a fresh load, then route.
    await page.evaluate(async () => {
      const w = window as any;
      w.fluxClearUserNavIntent();
      w.nav('calendar');
      await w.fluxRouteAfterAuth('sign-in');
    });

    await page.waitForTimeout(1200);
    await expect(page.locator('#teacherDashboard.panel.active')).toBeVisible();
  });

  test('switching Work/Personal still moves you, even after navigating', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');

    await openSidebarTab(page, 'settings');

    // The mode toggle is a deliberate request for that mode's home, so it must
    // override the earlier tab choice rather than appearing dead.
    await page.evaluate(() => {
      (window as any).FluxRole.setMode('work');
    });

    await page.waitForTimeout(1200);
    await expect(page.locator('#teacherDashboard.panel.active')).toBeVisible();
  });
});
