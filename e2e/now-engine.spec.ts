import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C1 — FluxNow happy path: flag on, timed classes around "now", the strip
 * renders one calm sentence under the topbar and tapping it opens the
 * calendar timeline. Flag off leaves no residue.
 */

test.describe('FluxNow bell-aware strip', () => {
  test('flag off: no strip in the DOM', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.waitForTimeout(1600);
    const strip = page.locator('#fluxNowStrip');
    // Either never created, or created hidden — no visible residue.
    expect(await strip.count()).toBeLessThanOrEqual(1);
    if (await strip.count()) await expect(strip).toBeHidden();
  });

  test('flag on: strip shows the current period and opens the timeline', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_now_engine: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      // A class that is in session RIGHT NOW (resolveNow only weekend-gates
      // on the real clock; the weekend branch is asserted below instead).
      const now = new Date();
      const hm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const start = new Date(now.getTime() - 10 * 60000);
      const end = new Date(now.getTime() + 30 * 60000);
      w.classes.length = 0;
      w.classes.push({ id: 1, period: 1, name: 'AP Biology', room: '204', days: '', timeStart: hm(start), timeEnd: hm(end) });
      w.save('flux_classes', w.classes);
      w.FluxNow.renderStrip();
    });
    const isWeekend = [0, 6].includes(new Date().getDay());
    const strip = page.locator('#fluxNowStrip');
    await expect(strip).toBeVisible();
    if (isWeekend) {
      await expect(strip).toContainText(/weekend/i);
    } else {
      await expect(strip).toContainText('AP Biology');
      await expect(strip).toContainText(/left/);
      const state = await strip.getAttribute('data-state');
      expect(state).toBe('period');
    }
    await strip.click();
    await expect(page.locator('#calendar.panel.active')).toBeVisible();
  });

  test('flag on: AI context carries the school-time line', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const line = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_now_engine: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      const now = new Date();
      const hm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      w.classes.length = 0;
      w.classes.push({ id: 1, period: 1, name: 'AP Biology', days: '', timeStart: hm(new Date(now.getTime() - 5 * 60000)), timeEnd: hm(new Date(now.getTime() + 20 * 60000)) });
      return w.FluxNow.aiContext();
    });
    const isWeekend = [0, 6].includes(new Date().getDay());
    expect(line).toContain('School time right now:');
    if (!isWeekend) expect(line).toContain('AP Biology');
  });
});
