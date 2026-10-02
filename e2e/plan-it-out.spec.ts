import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Plan it out (Azfer, 2026-10-01): a big task spread over the days before it
 * is due, one session a day, each a task of its own tied to the parent.
 * The scheduling itself is unit-tested in test/unit/task-plan.test.mjs; this
 * checks the planner a student uses. The clock is installed (and keeps
 * running) at Monday 5 October 2026, so the days never drift.
 */

async function setup(page: Page) {
  await page.clock.install({ time: new Date('2026-10-05T10:00:00') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => {
    const w = window as any;
    w.tasks.unshift({ id: 777001, name: 'History essay', date: '2026-10-12', subject: '', priority: 'high', type: 'essay', estTime: 0, difficulty: 3, done: false, subtasks: [], createdAt: Date.now() });
    w.renderTasks();
  });
}
const pieces = (page: Page) => page.evaluate(() => (window as any).tasks
  .filter((t: any) => t.planOf === 777001)
  .map((t: any) => ({ date: t.date, min: t.estTime, name: t.name, done: !!t.done, part: t.planPart, of: t.planParts, notes: t.notes })));

test.describe('Plan it out', () => {
  test('from Edit task: a goal, the days shown first, then one session a day before it is due', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).openEdit(777001));
    await page.locator('.plan-entry button').click();
    const modal = page.locator('#planItOutModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.plan-task')).toContainText('History essay');
    await modal.locator('#planGoal').fill('1,500 words, three sources');
    await modal.locator('#planSkipWk').check();
    await expect(modal.locator('.plan-list li')).toHaveCount(5);
    await expect(modal.locator('.plan-sum')).toContainText('the day before it’s due');
    await expect(modal.locator('#planGo')).toHaveText('Add 5 sessions to my planner');
    await modal.locator('#planGo').click();
    await expect(modal).toHaveCount(0);

    const p = await pieces(page);
    expect(p.map((x) => x.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
    expect(p.reduce((s, x) => s + x.min, 0)).toBe(240);
    expect(p[0].name).toBe('History essay · Research and notes');
    expect(p.every((x) => x.notes === 'Goal: 1,500 words, three sources')).toBe(true);
    // The parent says how far along it is; each session says which step it is.
    await expect(page.locator('.task-item[data-task-id="777001"] .task-chip-plan')).toHaveText('Planned · 0/5');
    await expect(page.locator('.task-item .task-chip-plan', { hasText: 'Step 1 of 5' })).toHaveCount(1);
  });

  test('planning again keeps the sessions already done and replans the rest', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).openPlanItOut(777001));
    await page.locator('#planGo').click();
    await page.evaluate(() => { const w = window as any; const first = w.tasks.find((t: any) => t.planOf === 777001 && t.planPart === 1); first.done = true; first.completedAt = Date.now(); w.renderTasks(); });
    const doneMin = (await pieces(page)).find((x) => x.done)!.min;
    // The chip opens the plan again.
    await page.locator('.task-item[data-task-id="777001"] .task-chip-plan').click();
    await expect(page.locator('#planItOutModal .plan-note')).toContainText('1 session done already');
    await page.locator('#planMax').fill('120');
    await page.locator('#planGo').click();
    const p = await pieces(page);
    expect(p.filter((x) => x.done)).toHaveLength(1);
    expect(p.filter((x) => !x.done).reduce((s, x) => s + x.min, 0)).toBe(240 - doneMin);
  });

  test('finishing or deleting the task clears the sessions still ahead of it', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).openPlanItOut(777001));
    await page.locator('#planGo').click();
    expect((await pieces(page)).length).toBeGreaterThan(1);
    await page.evaluate(() => (window as any).toggleTask(777001));
    await expect.poll(async () => (await pieces(page)).filter((x) => !x.done).length).toBe(0);

    await page.evaluate(() => {
      const w = window as any;
      w.tasks.unshift({ id: 777002, name: 'Lab report', date: '2026-10-09', type: 'lab', estTime: 120, done: false, subtasks: [], createdAt: Date.now() });
      w.renderTasks();
      w.openPlanItOut(777002);
    });
    await page.locator('#planGo').click();
    expect(await page.evaluate(() => (window as any).tasks.filter((t: any) => t.planOf === 777002).length)).toBeGreaterThan(0);
    await page.evaluate(() => (window as any).deleteTask(777002));
    expect(await page.evaluate(() => (window as any).tasks.filter((t: any) => t.planOf === 777002).length)).toBe(0);
  });

  test('New task can go straight on to Plan it out', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => (window as any).openDashAddTaskModal());
    await page.locator('#taskName').fill('Biology project');
    await page.locator('#taskDate').evaluate((el: HTMLInputElement) => { el.value = '2026-10-16'; });
    await page.locator('#taskType').selectOption('project');
    await page.locator('#taskPlanAfter').check();
    await page.locator('#dashAddTaskModal .mactions button', { hasText: 'Add Task' }).click();
    const modal = page.locator('#planItOutModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.plan-task')).toContainText('Biology project');
    await expect(modal.locator('#planTotal')).toHaveValue('360');
  });
});
