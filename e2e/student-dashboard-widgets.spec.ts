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
    await expect(page.locator('#spane-appearance')).toBeVisible();
    await page.evaluate(() => {
      window.FluxPersonal?.renderPanelLayoutSettings?.();
    });
    await expect(page.locator('#fluxPanelLayoutSettings')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#fluxPanelLayoutSettings label').filter({ hasText: /countdown/i }).first()).toBeVisible();
  });
});
