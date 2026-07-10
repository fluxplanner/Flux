import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C3 — Sub-Plan Generator happy path (client side).
 *
 * Publish → RPC fetch → 48h expiry runs against live Supabase (RLS_AUDIT
 * §13 probes + the D-phase share-code-expiry check). Here we drive the
 * client contract: the payload builder pulls today's Lesson Hub notes, the
 * composer modal renders behind the flag, the read-only viewer renders a
 * payload, and flag-off leaves the legacy clipboard button untouched.
 */

test.describe('Sub-Plan Generator (client contract)', () => {
  test('payload builder pulls classes + lesson notes into template sections', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    const p = await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_sub_plans: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      w.classes.length = 0;
      w.classes.push({ id: 1, period: 1, periodLabel: 'A1', name: 'AP Biology', room: '204', timeStart: '08:15', timeEnd: '09:05' });
      const today = w.todayStr();
      const state: any = {};
      state[today + '__P1'] = { notes: 'Ch 7 photosynthesis lab, pp. 120-124', attendance: '', materials: ['Lab sheets'] };
      w.save('flux_lesson_state_v1', state);
      return w.FluxSubPlans.buildPayload();
    });
    expect(p.sections).toHaveLength(1);
    expect(p.sections[0].period).toBe('A1');
    expect(p.sections[0].plan).toContain('photosynthesis');
    expect(p.sections[0].materials).toContain('Lab sheets');
    expect(p.finishEarly).toBeTruthy();
    expect(p.emergency).toBeTruthy();
    expect(p.contact).toBeTruthy();
  });

  test('composer modal opens from the payload and offers print/publish', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_sub_plans: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      w.classes.push({ id: 2, period: 2, name: 'Chemistry', room: '110', timeStart: '09:15', timeEnd: '10:05' });
      w.FluxSubPlans.openComposer();
    });
    const modal = page.locator('#fluxSubPlanModal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Chemistry');
    await expect(modal.locator('[data-act="publish"]')).toBeVisible();
    await expect(modal.locator('[data-act="print"]')).toBeVisible();
    await modal.locator('[data-act="close"]').click();
    await expect(modal).toHaveCount(0);
  });

  test('read-only viewer renders a payload with all template sections', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => {
      (window as any).FluxSubPlans.renderViewer({
        ok: true,
        payload: {
          teacher: 'Ms. Rivera', date: '2026-07-10',
          sections: [{ period: 'A1', name: 'AP Biology', room: '204', time: '08:15 – 09:05', plan: 'Lab day', materials: ['Goggles'] }],
          finishEarly: 'Silent reading.', emergency: 'Red folder by the door.', contact: 'Front office.',
        },
      });
    });
    const v = page.locator('#fluxSubPlanViewer');
    await expect(v).toBeVisible();
    await expect(v).toContainText('Ms. Rivera');
    await expect(v).toContainText('AP Biology');
    await expect(v).toContainText('If you finish early');
    await expect(v).toContainText('Emergency info');
  });

  test('expired code shows the expiry message', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => (window as any).FluxSubPlans.renderViewer({ ok: false, error: 'expired' }));
    await expect(page.locator('#fluxSubPlanViewer')).toContainText(/expired/i);
  });

  test('flag off: Lesson Hub button keeps legacy clipboard behavior', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(() => (window as any).nav('lessonHub'));
    const btn = page.locator('#lhSubPlanBtn');
    await expect(btn).toBeVisible();
    await btn.click();
    // Legacy path: no composer modal appears.
    await expect(page.locator('#fluxSubPlanModal')).toHaveCount(0);
  });
});
