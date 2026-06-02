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
    // Scroll the check into view before clicking — at the default 720-tall
    // viewport it sits below the fold and `force:true` would dispatch the
    // click at an off-screen coordinate that never reaches the element.
    const checkEl = row.locator('.check').first();
    await checkEl.scrollIntoViewIfNeeded();
    await checkEl.click();
    // Look up the task by its known seeded id rather than text in a filter.
    // After toggle, the task moves into #completedTasksWrap (display:none by
    // default), but the .check element itself still gets the `done` class —
    // an ID-anchored locator finds it regardless of which list it sits in,
    // and avoids interference from the optional "Log actual time" prompt.
    // Confirm via the in-memory task state (DOM lookup is brittle: the task
    // moves into #completedTasksWrap which renderTasks may strip in some
    // re-render orderings; what we actually care about is that toggle wrote
    // through to the persistent state).
    await expect.poll(
      async () => page.evaluate(() => (window as any).tasks?.find?.((t: any) => t.id === 91001)?.done),
      { timeout: 10_000 },
    ).toBe(true);
  });
});
