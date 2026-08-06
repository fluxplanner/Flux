import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C2 — District Schedule Authority happy path (client side).
 *
 * Live admin-publish → RLS-scoped fetch needs a live Supabase admin session
 * (covered by the RLS probe rows in docs/RLS_AUDIT.md §12 and the
 * rls-boundary pattern). Here we drive the CLIENT contract: a published
 * closure in the cache must (1) flow through isBreak() exactly like a rest
 * day, (2) surface in FluxNow as a holiday with the closure note, and
 * (3) leave zero effect with the flag off.
 */

const seedClosure = async (page: import('@playwright/test').Page, on: boolean) => {
  return page.evaluate(async (flagOn) => {
    const w = window as any;
    w.FLUX_EXPERIMENTS = {
      ...(w.FLUX_EXPERIMENTS || {}),
      enable_school_schedules: flagOn,
      enable_now_engine: flagOn,
    };
    if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
    const today = w.todayStr();
    w.save(w.FluxSchoolSchedules._cacheKey, {
      fetchedAt: Date.now(),
      days: { [today]: { closed: true, note: 'Snow day', scheduleId: null } },
      variants: [],
    });
    return {
      today,
      isBreak: w.isBreak(today),
      dayInfo: w.FluxSchoolSchedules.dayInfo(today),
      override: w.FluxSchoolSchedules.todayOverride(today),
    };
  }, on);
};

test.describe('District Schedule Authority (client contract)', () => {
  test('published closure behaves like a rest day and reaches FluxNow', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await seedClosure(page, true);
    expect(r.isBreak).toBe(true);
    expect(r.dayInfo?.closed).toBe(true);
    expect(r.override?.closed).toBe(true);
    expect(r.override?.note).toContain('Snow day');
    // FluxNow renders the closure as a calm holiday sentence.
    const now = await page.evaluate(() => (window as any).FluxNow.resolveLive());
    const isWeekend = [0, 6].includes(new Date().getDay());
    if (!isWeekend) {
      expect(now.state).toBe('holiday');
      expect(now.sentence).toContain('Snow day');
    }
  });

  test('flag off: closure cache is inert (no rest-day effect, no residue)', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await seedClosure(page, false);
    expect(r.isBreak).toBe(false);
    expect(r.dayInfo).toBeNull();
    expect(r.override).toBeNull();
  });

  test('admin card does not render for students', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_school_schedules: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      w.FluxSchoolSchedules.renderAdminCard();
    });
    await expect(page.locator('#fluxSchedAuthority')).toHaveCount(0);
  });
});
