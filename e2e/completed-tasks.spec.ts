import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Finished tasks (Azfer, 2026-10-23): the dashboard is for what is left to do,
 * so it has no Completed list; the calendar keeps showing a finished task on
 * its day, ticked and struck through, and it can be unticked there. Because
 * the calendar keeps them, finished tasks are no longer deleted after two
 * weeks.
 *
 * The page clock is installed (and keeps running, so the list's rebuild
 * timers fire) so the dates here never drift (see the wall-clock fixtures memory).
 */

const DAY = 864e5;

test.describe('Completed tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-20T12:00:00') });
    await gotoScenario(page, 'student-semester');
    await page.evaluate((d) => {
      const w = window as any;
      const now = Date.now();
      w.tasks.push(
        { id: 9001, name: 'Finished yesterday', done: true, completedAt: now - d, priority: 'med', date: '2026-10-19' },
        { id: 9002, name: 'Finished a month ago', done: true, completedAt: now - 30 * d, priority: 'med', date: '2026-10-21' },
        { id: 9003, name: 'Still to do', done: false, priority: 'med', date: '2026-10-21' },
      );
      w.save('tasks', w.tasks);
      w.renderTasks();
    }, DAY);
  });

  test('the dashboard lists no finished tasks, under any filter', async ({ page }) => {
    await expect(page.locator('#filterChips .tmode-btn', { hasText: 'Completed' })).toHaveCount(0);
    for (const chip of ['Active', 'Today', 'Overdue']) {
      await page.locator('#filterChips .tmode-btn', { hasText: chip }).click();
      await expect(page.locator('#taskList .task-item', { hasText: 'Finished' })).toHaveCount(0);
      await expect(page.locator('.completed-toggle, #completedTasksWrap')).toHaveCount(0);
    }
    // A filter saved from before (the old Completed chip) falls back to Active.
    await page.evaluate(() => (window as any).setFilter('done'));
    await expect(page.locator('#taskList .task-item', { hasText: 'Still to do' })).toHaveCount(1);
  });

  test('ticking a task takes it off the dashboard but keeps it, done, in the calendar', async ({ page }) => {
    const row = page.locator('#taskList .task-item', { hasText: 'Still to do' });
    await row.locator('.check').click();
    await expect(row).toHaveCount(0);
    await page.evaluate(() => (window as any).nav('calendar'));
    await page.waitForTimeout(700);
    const cell = page.locator('.cal-day[data-cal-date="2026-10-21"]');
    const bar = cell.locator('.cal-task-bar', { hasText: 'Still to do' });
    await expect(bar).toHaveCount(1);
    await expect(bar).toHaveCSS('text-decoration-line', 'line-through');
    // The day panel shows it ticked, and unticking it there brings it back.
    await cell.click();
    const item = page.locator('.task-item', { hasText: 'Still to do' }).locator('.check.done');
    await expect(item).toHaveCount(1);
    await item.click();
    await page.evaluate(() => (window as any).nav('dashboard'));
    await expect(page.locator('#taskList .task-item', { hasText: 'Still to do' })).toHaveCount(1);
  });

  test('finished tasks are kept, however long ago they were finished', async ({ page }) => {
    // The hourly sweep that deleted them is gone; an hour on, the month-old one is still saved.
    await page.clock.fastForward(61 * 60 * 1000);
    const kept = await page.evaluate(() => {
      const w = window as any;
      return [typeof w.fluxPurgeOldCompleted, w.load('tasks', []).filter((t: any) => t.id === 9002).length];
    });
    expect(kept).toEqual(['undefined', 1]);
  });
});
