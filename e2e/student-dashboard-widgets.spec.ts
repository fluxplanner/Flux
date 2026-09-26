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
    // The countdown lives in the top bar now; hiding the section hides the pill.
    await expect(page.locator('#topbarCountdown')).toBeHidden();
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
   * The countdown can point at anything, not just the next test. It lives in
   * the top bar as a pill ("⏳ Trip to Spain · 40 days") so the task list is
   * not pushed down the dashboard; its panel shows the detail and the form.
   *
   * The interesting case is the time. Without one it counts days and weeks;
   * with one it switches to days/hours/minutes, because "3 days" is the wrong
   * unit for something happening at nine tomorrow morning.
   */
  test('the countdown pill can target any date, counts hours once given a time, and falls back', async ({ page }) => {
    const pill = page.locator('#topbarCountdown');
    const pop = page.locator('#countdownPop');
    await pill.click();
    await expect(pop.locator('.tcd-kicker').first(), 'baseline is the next test').toContainText(/next test/i);

    const iso = await page.evaluate(() => {
      const w = window as any;
      const d = new Date();
      d.setDate(d.getDate() + 40);
      const iso = w.fluxLocalYMD(d);
      w.fluxToggleCountdownForm(true);
      (document.getElementById('countdownName') as HTMLInputElement).value = 'Trip to Spain';
      (document.getElementById('countdownDate') as HTMLInputElement).value = iso;
      w.fluxSaveCountdown();
      return iso;
    });
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(pill).toContainText('Trip to Spain');
    await expect(pill).toContainText('40');
    await expect(pop.locator('.tcd-title')).toHaveText('Trip to Spain');
    await expect(pop, 'date-only counts days and weeks').toContainText(/weeks/i);

    await page.evaluate(() => {
      const w = window as any;
      w.fluxToggleCountdownForm(true);
      (document.getElementById('countdownTime') as HTMLInputElement).value = '09:00';
      w.fluxSaveCountdown();
    });
    await expect(pop, 'a time switches it to hours').toContainText(/hours?/i);
    await expect(pop, 'and minutes').toContainText(/mins?/i);

    // A target with no date is refused rather than saved half-formed.
    const msg = await page.evaluate(() => {
      const w = window as any;
      w.fluxToggleCountdownForm(true);
      (document.getElementById('countdownDate') as HTMLInputElement).value = '';
      w.fluxSaveCountdown();
      return document.getElementById('countdownFormMsg')?.textContent || '';
    });
    expect(msg).toMatch(/pick a date/i);

    await page.evaluate(() => (window as any).fluxClearCountdown());
    await expect(pill, 'clearing hands the pill back to the next test').not.toContainText('Trip to Spain');
    await expect(pop.locator('.tcd-kicker').first()).toContainText(/next test/i);
  });

  test('the dashboard no longer has the 7-day bars, so the tasks start higher', async ({ page }) => {
    await expect(page.locator('#dashWeekStrip')).toHaveCount(0);
    await expect(page.locator('[data-flux-section="pulse"]')).toHaveCount(0);
  });
});
