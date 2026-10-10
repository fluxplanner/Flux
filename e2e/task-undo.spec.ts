import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * "It's impossible to find and undo it. Do completed tasks in completed
 * order, not due date order."
 *
 * The Completed filter already sorted by completion time; the Completed
 * section under Today / Overdue / a smart list took the open tasks' order
 * instead. Every completion shows the Undo snackbar (now naming the task),
 * Ctrl+Z undoes it, and an undo never rolls back what a cloud pull brought in
 * since — that used to delete another device's new task everywhere.
 */

const today = () => new Date().toISOString().slice(0, 10);

async function seedToday(page: Page) {
  await page.evaluate((d) => {
    const w = window as any;
    const mk = (id: number, name: string, priority: string, urgencyScore: number) => ({
      id, name, date: d, priority, type: 'hw', estTime: 0, done: false, subtasks: [], createdAt: Date.now(), urgencyScore,
    });
    w.tasks.splice(0, w.tasks.length, mk(9301, 'Read chapter 4', 'high', 9), mk(9302, 'Maths sheet', 'med', 5), mk(9303, 'Spanish vocab', 'low', 1));
    w.save('tasks', w.tasks);
    w.renderTasks();
  }, today());
}

test.describe('Finding and undoing a completed task', () => {
  test('the Completed section lists the most recently finished first', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seedToday(page);
    await page.locator('#filterChips .tmode-btn', { hasText: 'Today' }).click();
    // Finish them out of their list order: the high-priority one first.
    for (const id of [9301, 9303, 9302]) {
      await page.locator(`#taskList .task-item[data-task-id="${id}"] .check`).click();
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(900);
    const wrap = page.locator('#completedTasksWrap');
    if (!(await wrap.isVisible())) await page.locator('.completed-toggle').click();
    const names = await wrap.locator('.task-item .task-text').allTextContents();
    expect(names.map((n) => n.trim())).toEqual(['Maths sheet', 'Spanish vocab', 'Read chapter 4']);
  });

  test('the snackbar names the task, and Undo brings it back', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seedToday(page);
    await page.locator('#taskList .task-item[data-task-id="9302"] .check').click();
    const bar = page.locator('#undoSnackbar');
    await expect(bar).toHaveAttribute('role', 'status');
    await expect(bar).toContainText('Maths sheet');
    await bar.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 9302).done)).toBe(false);
    await expect(page.locator('#taskList .task-item[data-task-id="9302"]')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tasks') || '[]').find((t: any) => t.id === 9302).done)).toBe(false);
  });

  test('Ctrl+Z undoes a completion', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seedToday(page);
    await page.locator('#taskList .task-item[data-task-id="9301"] .check').click();
    await page.waitForTimeout(700);
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press('Control+z');
    await expect.poll(() => page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 9301).done)).toBe(false);
  });

  test('undo keeps a task another device added in the meantime', async ({ page }) => {
    // teacher-workflow has a signed-in user; the stub stands in for Supabase.
    await gotoScenario(page, 'teacher-workflow');
    const res = await page.evaluate(async () => {
      const w = window as any;
      let row = JSON.parse(JSON.stringify(w.getCloudPayload()));
      w.getSB = () => ({
        from: () => ({
          select: () => ({ eq: () => ({ single: async () => ({ data: { data: JSON.parse(JSON.stringify(row)) }, error: null }) }) }),
          upsert: async (o: any) => { row = JSON.parse(JSON.stringify(o.data)); return { error: null }; },
        }),
      });
      w.tasks.push({ id: 9401, name: 'Lab write-up', date: '', priority: 'med', done: false, subtasks: [], createdAt: Date.now() });
      w.save('tasks', w.tasks);
      await w.syncFromCloud();          // agree with the stub first
      await w.syncToCloud();
      w.toggleTask(9401);               // the change to undo
      // Meanwhile, on a phone:
      row = JSON.parse(JSON.stringify(row));
      row.tasks.unshift({ id: 9402, name: 'Added on my phone', date: '', priority: 'med', done: false, subtasks: [], createdAt: Date.now(), updatedAt: Date.now() });
      w._fluxLastCloudFingerprint = undefined;
      await w.syncFromCloud();
      const arrived = w.tasks.some((t: any) => t.id === 9402);
      w.undoLastChange();
      const tomb = JSON.parse(localStorage.getItem(w.fluxNamespacedKey('flux_list_tombstones_v1')) || '{}').tasks || {};
      return {
        arrived,
        undone: w.tasks.find((t: any) => t.id === 9401)?.done,
        kept: w.tasks.some((t: any) => t.id === 9402),
        tombstoned: Object.keys(tomb).includes('9402'),
      };
    });
    expect(res).toEqual({ arrived: true, undone: false, kept: true, tombstoned: false });
  });
});
