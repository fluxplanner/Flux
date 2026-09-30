import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The dashboard's Completed filter, and the rule behind it (Azfer,
 * 2026-09-30): a finished task is deleted two weeks after it was completed.
 * The clock runs from the later of completion and 30 Sep 2026, so tasks
 * finished long before the rule arrived get the full two weeks' notice
 * instead of vanishing on the first load after the update.
 *
 * The page clock is pinned so the dates here never drift into the rule's
 * grace window by themselves (see the wall-clock-fixtures memory).
 */

const DAY = 864e5;

test.describe('Completed tasks', () => {
  test('the Completed button lists finished tasks, newest first, with the two-week notice', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-20T12:00:00'));
    await gotoScenario(page, 'student-semester');
    await page.evaluate((d) => {
      const w = window as any;
      const now = Date.now();
      w.tasks.push(
        { id: 9001, name: 'Finished yesterday', done: true, completedAt: now - d, priority: 'med', date: '' },
        { id: 9002, name: 'Finished a week ago', done: true, completedAt: now - 7 * d, priority: 'med', date: '' },
      );
      w.renderTasks();
    }, DAY);
    const btn = page.locator('#filterChips .tmode-btn', { hasText: 'Completed' });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(btn).toHaveClass(/active/);
    await expect(page.locator('.flux-done-notice')).toContainText('deleted 2 weeks after you complete them');
    const names = page.locator('#taskList .task-item .task-text');
    await expect(names).toHaveCount(2);
    await expect(names.nth(0)).toContainText('Finished yesterday');
    await expect(names.nth(1)).toContainText('Finished a week ago');
    await expect(page.locator('#taskList .task-chip-expiry').first()).toContainText('Deletes');
    // Active still shows only what is left to do.
    await page.locator('#filterChips .tmode-btn', { hasText: 'Active' }).click();
    await expect(page.locator('#taskList .task-item', { hasText: 'Finished yesterday' })).toHaveCount(0);
  });

  test('a task finished more than two weeks ago is deleted; recent and unfinished ones stay', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-20T12:00:00'));
    await gotoScenario(page, 'student-semester');
    const left = await page.evaluate((d) => {
      const w = window as any;
      const now = Date.now();
      w.tasks.push(
        { id: 9101, name: 'Old finished', done: true, completedAt: now - 15 * d, priority: 'med', date: '' },
        { id: 9102, name: 'Recent finished', done: true, completedAt: now - 13 * d, priority: 'med', date: '' },
        { id: 9103, name: 'Old but not done', done: false, priority: 'med', date: '' },
        { id: 9104, name: 'Old finished, date as text', done: true, completedAt: new Date(now - 20 * d).toISOString(), priority: 'med', date: '' },
      );
      const removed = w.fluxPurgeOldCompleted();
      return { removed, names: w.tasks.filter((t: any) => t.id >= 9101 && t.id <= 9104).map((t: any) => t.name) };
    }, DAY);
    expect(left.removed).toBe(2);
    expect(left.names).toEqual(['Recent finished', 'Old but not done']);
  });

  test('tasks finished long before the rule arrived get the full two weeks from 30 September', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-05T12:00:00'));
    await gotoScenario(page, 'student-semester');
    const r = await page.evaluate(() => {
      const w = window as any;
      w.tasks.push({ id: 9201, name: 'Finished in June', done: true, completedAt: new Date('2026-06-01T12:00:00').getTime(), priority: 'med', date: '' });
      const removed = w.fluxPurgeOldCompleted();
      return { removed, still: w.tasks.some((t: any) => t.id === 9201) };
    });
    expect(r).toEqual({ removed: 0, still: true });
  });
});
