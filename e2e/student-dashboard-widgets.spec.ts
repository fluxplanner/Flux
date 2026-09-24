import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

test.describe('Dashboard widget picker', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-dashboard-widgets');
    await expect(page.locator('#dashboard.panel.active')).toBeVisible();
  });

  test('can hide exam countdown section', async ({ page }) => {
    const hidden = await page.evaluate(async () => {
      window.FLUX_EXPERIMENTS = { enable_dashboard_widget_picker: true };
      if (window.FluxFeatureFlags?.load) await window.FluxFeatureFlags.load({ force: true });
      if (!window.FluxPersonal?.setDashboardHidden) return { error: 'FluxPersonal missing' };
      window.FluxPersonal.setDashboardHidden(['countdown']);
      const el = document.querySelector('[data-flux-section="countdown"]');
      const stored = window.FluxStorage?.load('flux_dashboard_hidden_sections_v1', []) || [];
      return {
        stored,
        hasClass: el?.classList.contains('flux-dash-user-hidden') ?? false,
      };
    });
    expect(hidden.error).toBeUndefined();
    expect(hidden.stored).toContain('countdown');
    expect(hidden.hasClass).toBe(true);
    await expect(page.locator('[data-flux-section="countdown"]')).toHaveClass(/flux-dash-user-hidden/);
  });

  test('appearance panel lists dashboard section toggles', async ({ page }) => {
    await openSidebarTab(page, 'settings');
    /* Open Layout explicitly. #spane-appearance used to be the section
       Settings landed on; it is the third one now, and an inactive .spane is
       display:none — so the locator still resolves and simply reads hidden.
       The id itself is unchanged on purpose: six modules inject their settings
       card into this pane and none of them throw when it is missing. */
    await page.evaluate(() =>
      (window as unknown as { switchStab: (id: string) => void }).switchStab('appearance'));
    await expect(page.locator('#spane-appearance')).toBeVisible();
    await page.evaluate(() => {
      window.FluxPersonal?.renderPanelLayoutSettings?.();
    });
    await expect(page.locator('#fluxPanelLayoutSettings')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#fluxPanelLayoutSettings label').filter({ hasText: /countdown/i }).first()).toBeVisible();
  });

  /*
   * The countdown can point at anything, not just the next test.
   *
   * It tracked the next unfinished test and hid the whole card when there
   * wasn't one — which also removed the only place a countdown could be set
   * from, so the empty state is part of the fix rather than decoration.
   *
   * The interesting case is the time. Without one it counts days and weeks as
   * before; with one it switches to days/hours/minutes, because "3 days" is
   * the wrong unit for something happening at nine tomorrow morning.
   */
  test('the countdown can target any date, counts hours once given a time, and falls back', async ({ page }) => {
    const read = () => page.evaluate(() => ({
      kicker: document.getElementById('countdownKicker')?.textContent || '',
      heading: document.getElementById('countdownHeading')?.textContent || '',
      cells: [...document.querySelectorAll('#countdownGrid > div')]
        .map((d) => (d.textContent || '').trim()),
    }));

    const before = await read();
    expect(before.kicker, 'baseline should be the auto-picked exam').toBe('Assessment');

    await page.evaluate(() => {
      const w = window as any;
      w.fluxToggleCountdownForm();
      (document.getElementById('countdownName') as HTMLInputElement).value = 'Trip to Spain';
      (document.getElementById('countdownDate') as HTMLInputElement).value = '2026-12-25';
      w.fluxSaveCountdown();
    });
    await page.waitForTimeout(400);
    const dated = await read();
    expect(dated.kicker, 'a saved target should take over the card').toBe('Counting down');
    expect(dated.heading).toBe('Trip to Spain');
    expect(dated.cells.some((c) => /Weeks$/.test(c)), 'date-only should still count weeks').toBe(true);

    await page.evaluate(() => {
      const w = window as any;
      w.fluxToggleCountdownForm();
      (document.getElementById('countdownTime') as HTMLInputElement).value = '09:00';
      w.fluxSaveCountdown();
    });
    await page.waitForTimeout(400);
    const timed = await read();
    expect(timed.cells.some((c) => /Hours$/.test(c)), 'a time should switch it to hours').toBe(true);
    expect(timed.cells.some((c) => /Mins$/.test(c)), 'a time should switch it to minutes').toBe(true);

    // A target with no date is refused rather than saved half-formed.
    const msg = await page.evaluate(() => {
      const w = window as any;
      w.fluxToggleCountdownForm();
      (document.getElementById('countdownDate') as HTMLInputElement).value = '';
      w.fluxSaveCountdown();
      return document.getElementById('countdownFormMsg')?.textContent || '';
    });
    expect(msg).toMatch(/pick a date/i);

    await page.evaluate(() => (window as any).fluxClearCountdown());
    await page.waitForTimeout(400);
    const cleared = await read();
    expect(cleared.kicker, 'clearing should hand the card back to the next test').toBe('Assessment');
    expect(cleared.heading).toBe('Next exam countdown');
  });
});
