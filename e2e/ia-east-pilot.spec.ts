import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('IA East pilot (harness)', () => {
  test('teacher work dashboard shows staff widget grid', async ({ page }) => {
    await gotoScenario(page, 'ia-east-teacher');
    await expect(page.locator('#teacherDashboard.panel.active, #teacherDashboardBody').first()).toBeVisible({
      timeout: 15_000,
    });
    const grid = page.locator('#fluxWidgetGrid_teacherDashboard');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(grid.getByText('Quick-Grade buckets')).toBeVisible();
  });

  test('counselor dashboard loads with harness flags', async ({ page }) => {
    await gotoScenario(page, 'ia-east-counselor');
    await expect(page.locator('#counselorDashboard.panel.active, #counselorDashboardBody').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).not.toContainText(/record not found/i);
    await page.locator('[data-tab="counselorWorkspace"]').first().click();
    await expect(page.locator('#counselorWorkspace.panel.active')).toBeVisible();
    const grid = page.locator('#counselorWorkspaceBody .flux-widget-grid').first();
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });
});
