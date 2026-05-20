import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Counselor path', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'counselor-path');
  });

  test('counselor nav and dashboard load', async ({ page }) => {
    await expect(page.locator('[data-counselor-nav]').first()).toBeVisible();
    await expect(page.locator('#counselorDashboard.panel.active')).toBeVisible();
    await expect(page.locator('#counselorDashboardBody')).not.toContainText('Counselor record not found');
  });

  test('counselor dashboard shows schedule sections', async ({ page }) => {
    const body = page.locator('#counselorDashboardBody');
    await expect(body).toContainText(/Today|Appointments|Upcoming|Messages/i);
  });
});
