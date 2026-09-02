import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C1 — FluxNow happy path: flag on, timed classes around "now", the strip
 * renders one calm sentence under the topbar and tapping it opens the
 * calendar timeline. Flag off leaves no residue.
 */

/*
 * Monday 2026-03-09, midday. Pinned for two reasons.
 *
 * The classes below were seeded at `now ± minutes` but stored as bare HH:MM,
 * so between 23:30 and 23:59 the end time wrapped into the small hours, came
 * out lower than the start, and the class stopped reading as in session. The
 * same arithmetic in teacher-classes.spec.ts took main red at 23:30.
 *
 * It also retires the weekend branch. resolveNow weekend-gates on the real
 * clock, so on a Saturday or Sunday this file asserted only "the strip says
 * weekend" and skipped everything it exists to check — two days in seven where
 * the real assertions never ran at all.
 */
const SCHOOL_DAY = new Date('2026-03-09T12:00:00');

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
    await page.clock.setFixedTime(SCHOOL_DAY);
    await page.evaluate(async (baseIso: string) => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_now_engine: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      // A class in session at the pinned instant, which resolveNow reads as
      // "now" — a weekday midday, so the weekend gate never trips.
      const base = new Date(baseIso);
      const hm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const start = new Date(base.getTime() - 10 * 60000);
      const end = new Date(base.getTime() + 30 * 60000);
      w.classes.length = 0;
      w.classes.push({ id: 1, period: 1, name: 'AP Biology', room: '204', days: '', timeStart: hm(start), timeEnd: hm(end) });
      w.save('flux_classes', w.classes);
      w.FluxNow.renderStrip();
    }, SCHOOL_DAY.toISOString());
    const strip = page.locator('#fluxNowStrip');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('AP Biology');
    await expect(strip).toContainText(/left/);
    expect(await strip.getAttribute('data-state')).toBe('period');
    await strip.click();
    await expect(page.locator('#calendar.panel.active')).toBeVisible();
  });

  test('flag on: AI context carries the school-time line', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.clock.setFixedTime(SCHOOL_DAY);
    const line = await page.evaluate(async (baseIso: string) => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_now_engine: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      const base = new Date(baseIso);
      const hm = (d: Date) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      w.classes.length = 0;
      w.classes.push({ id: 1, period: 1, name: 'AP Biology', days: '', timeStart: hm(new Date(base.getTime() - 5 * 60000)), timeEnd: hm(new Date(base.getTime() + 20 * 60000)) });
      return w.FluxNow.aiContext();
    }, SCHOOL_DAY.toISOString());
    expect(line).toContain('School time right now:');
    expect(line).toContain('AP Biology');
  });
});
