import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * C5 — Accommodation Cards happy path (client contract).
 *
 * The privacy enforcement itself is server-side (RLS + SECURITY DEFINER
 * RPCs — probes in docs/RLS_AUDIT.md §14). Here we pin the client contract:
 * aggregate chips render with counts and NO names, the detail modal shows
 * consented rows or the ask-counselor CTA, the student transparency panel
 * labels sharing states, and flag-off renders nothing.
 */

test.describe('Accommodation cards (client contract)', () => {
  test('teacher chips: counts only, no names; tap opens detail modal', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_accommodation_cards: true };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      const host = document.createElement('div');
      host.id = 'facTestHost';
      document.body.appendChild(host);
      w.FluxAccommodations.renderTeacherChips(host, 'TEST-CODE', [
        { kind: 'Extended time', n: 2 },
        { kind: 'Preferential seating', n: 1 },
      ]);
    });
    const host = page.locator('#facTestHost');
    await expect(host).toContainText('2 students: extended time');
    await expect(host).toContainText('1 student: preferential seating');
    // No student names anywhere in the chip surface.
    expect(await host.textContent()).not.toMatch(/Jordan|Priya|Alex/);
  });

  test('detail modal renders consented rows with audit notice', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(() => {
      (window as any).FluxAccommodations.openDetailModal([
        { student: 'Jordan P.', kind: 'Extended time', note: '1.5x on assessments' },
      ]);
    });
    const modal = page.locator('#facDetailModal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Jordan P.');
    await expect(modal).toContainText('1.5x on assessments');
    await expect(modal).toContainText(/audited/i);
    await modal.locator('[data-act="close"]').click();
    await expect(modal).toHaveCount(0);
  });

  test('no consented rows → ask-counselor CTA, never a name leak', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(() => (window as any).FluxAccommodations.openDetailModal([]));
    const modal = page.locator('#facDetailModal');
    await expect(modal).toContainText(/ask their counselor/i);
    await expect(modal).toContainText(/aggregate only/i);
  });

  test('student transparency panel labels shared vs private', async ({ page }) => {
    await gotoScenario(page, 'guest');
    await page.evaluate(() => {
      const w = window as any;
      const host = document.createElement('div');
      host.id = 'facStudentHost';
      document.body.appendChild(host);
      w.FluxAccommodations.renderStudentPanel(host, [
        { kind: 'Extended time', note: '1.5x on assessments', consent_state: 'staff_visible' },
        { kind: 'Breaks as needed', note: '', consent_state: 'private' },
      ], 3);
    });
    const host = page.locator('#facStudentHost');
    await expect(host).toContainText('What staff can see about me');
    await expect(host).toContainText('shared with my teachers');
    await expect(host).toContainText('private — count only');
    await expect(host).toContainText('Staff viewed your shared details 3 times');
    await expect(host).toContainText(/sharing is always your call/i);
  });

  test('flag off: no cards injected on any panel', async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
    await page.evaluate(async () => {
      const w = window as any;
      w.FLUX_EXPERIMENTS = { ...(w.FLUX_EXPERIMENTS || {}), enable_accommodation_cards: false };
      if (w.FluxFeatureFlags?.load) await w.FluxFeatureFlags.load({ force: true });
      await w.FluxAccommodations.injectTeacherCard();
      await w.FluxAccommodations.injectCounselorCard();
      await w.FluxAccommodations.injectStudentPanel();
    });
    await expect(page.locator('#fluxAccomTeacher')).toHaveCount(0);
    await expect(page.locator('#fluxAccomCounselor')).toHaveCount(0);
    await expect(page.locator('#fluxAccomStudent')).toHaveCount(0);
  });
});
