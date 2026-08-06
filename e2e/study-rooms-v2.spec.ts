import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C8 — Study Rooms v2 happy path (client contract).
 *
 * The registry RLS + study-hall RPC boundaries are covered by
 * docs/RLS_AUDIT.md §17 probes. Here we pin the client contract: the name
 * guard blocks unkind labels with kind copy, class templates render and
 * route to co-work (or a helpful toast when no task exists), the teacher
 * study-hall card shows counts only, and flag-off leaves v1 untouched.
 */

test.describe('Study Rooms v2 (client contract)', () => {
  test('name guard: blocks profanity/unkindness with kind copy, passes normal labels', async ({ page }) => {
    await gotoScenario(page, 'guest');
    const r = await page.evaluate(() => {
      const g = (window as any).FluxStudyRoomsV2.guardRoomLabel;
      return {
        ok: g('AP Bio study room'),
        spaced: g('k y s squad'),
        leet: g('sh!t show'),
        mean: g('losers only club'),
        empty: g(''),
        long: g('x'.repeat(80)),
      };
    });
    expect(r.ok.ok).toBe(true);
    expect(r.ok.label).toBe('AP Bio study room');
    expect(r.spaced.ok).toBe(false);
    expect(r.leet.ok).toBe(false);
    expect(r.mean.ok).toBe(false);
    expect(r.spaced.reason).toMatch(/kinder/i);
    expect(r.empty.ok).toBe(false);
    expect(r.long.ok).toBe(false);
  });

  test('class templates render and a template with no task shows a helpful toast', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_study_rooms_v2: true };
      await w.FluxFeatureFlags.load({ force: true });
      w.classes.length = 0;
      w.classes.push({ id: 9, period: 1, name: 'AP Biology', teacherClassCode: 'BIO-1', days: '' });
      w.nav('school');
      w.FluxStudyRoomsV2.injectTemplates();
    });
    const card = page.locator('#fluxStudyRoomTemplates');
    await expect(card).toBeVisible();
    await expect(card).toContainText('AP Biology');
    // No open task for the class → helpful toast, no room modal.
    await page.evaluate(() => {
      const w = window as any;
      w.tasks.length = 0;
      w.FluxStudyRoomsV2.startClassRoom(9);
    });
    await expect(page.locator('#toastLive, .toast').first()).toContainText(/Add a task for AP Biology/i);
  });

  test('study-hall renderer shows counts only — no codes, no content', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => {
      const w = window as any;
      const host = document.createElement('div');
      host.id = 'shTestHost';
      document.body.appendChild(host);
      w.FluxStudyRoomsV2.renderStudyHall(host, [
        { name: 'AP Biology (P1)', rooms: [{ label: 'AP Bio study room', participants: 3, started_at: '2026-07-11T14:00:00Z' }] },
        { name: 'Chemistry (P2)', rooms: [] },
      ]);
    });
    const host = page.locator('#shTestHost');
    await expect(host).toContainText('Study hall');
    await expect(host).toContainText('AP Bio study room — 3 studying');
    await expect(host).toContainText('counts only, never the room content');
    // Chemistry has no rooms — its header is omitted entirely.
    expect(await host.textContent()).not.toContain('Chemistry');
  });

  test('flag off: no templates card, cowork v1 untouched', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_study_rooms_v2: false };
      await w.FluxFeatureFlags.load({ force: true });
      w.classes.push({ id: 10, period: 2, name: 'Chemistry', days: '' });
      w.FluxStudyRoomsV2.injectTemplates();
    });
    await expect(page.locator('#fluxStudyRoomTemplates')).toHaveCount(0);
    const coworkIntact = await page.evaluate(() => typeof (window as any).FluxCowork?.openForTask === 'function');
    expect(coworkIntact).toBe(true);
  });
});
