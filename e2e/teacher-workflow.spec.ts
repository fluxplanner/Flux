import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

test.describe('Teacher workflow path', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'teacher-workflow');
  });

  test('teacher nav and dashboard shell load', async ({ page }) => {
    await expect(page.locator('[data-teacher-nav]').first()).toBeVisible();
    await expect(page.locator('#teacherDashboard.panel.active')).toBeVisible();
    await expect(page.locator('#teacherDashboardBody')).toContainText(/E2E Teacher|No classes yet/i);
  });

  test('teacher can open classes action', async ({ page }) => {
    const newClass = page.locator('#teacherDashboardBody [data-action="new-class"]').first();
    await expect(newClass).toBeVisible();
    await newClass.click();
    await expect(page.locator('#createClassModal, [id*="ClassModal"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
