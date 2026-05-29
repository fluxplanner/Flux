import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

test.describe('Student semester path', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
  });

  test('dashboard shows seeded semester tasks', async ({ page }) => {
    await expect(page.locator('#dashboard.panel.active')).toBeVisible();
    await expect(page.locator('#taskList')).toContainText('E2E Algebra homework');
    await expect(page.locator('#taskList')).toContainText('E2E History essay draft');
    await expect(page.locator('#taskList')).toContainText('E2E Semester review');
  });

  test('calendar tab opens from dashboard', async ({ page }) => {
    await openSidebarTab(page, 'calendar');
    await expect(page.locator('#calendar')).toBeVisible();
  });

  test('can complete a seeded task', async ({ page }) => {
    const row = page.locator('#taskList .task-item').filter({ hasText: 'E2E Algebra homework' });
    await expect(row).toBeVisible();
    await row.locator('.check').first().click({ force: true });
    await page.locator('#filterChips button', { hasText: 'All' }).click({ force: true });
    const doneRow = page.locator('#taskList .task-item').filter({ hasText: 'E2E Algebra homework' });
    await expect(doneRow.locator('.check')).toHaveClass(/done/, { timeout: 10_000 });
  });
});
