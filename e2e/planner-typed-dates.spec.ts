import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Adding a task the way students type it.
 *
 * Quick add's reader stripped "due", "by" and "on" from inside words
 * ("Conclusion" was saved as "Cclusi"), read "chapter 3 homework" as a
 * three-hour task, took "on photosynthesis" for a date and knew no "tmrw",
 * "10/24" or "oct 24". The New task form ignored a date typed in the title
 * and saved "Algebra quiz friday" as due today; Enter did nothing; and an
 * empty task list offered only keyboard shortcuts, which a phone doesn't have.
 *
 * The clock is pinned to Monday 2026-03-09 at midday, so "friday" is always
 * 2026-03-13 (see the wall-clock fixtures note: bare dates went red on main).
 */

const MONDAY_NOON = new Date('2026-03-09T12:00:00');

type Parsed = { name: string; date: string; time: string; type: string; subject: string; priority: string; estTime: number };
type Task = { id: number; name: string; date: string; time?: string; type: string; subject: string; priority: string; estTime: number };

async function boot(page: Page) {
  await page.clock.install({ time: MONDAY_NOON });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await gotoScenario(page, 'guest');
  await page.waitForTimeout(700);
}

const newest = (page: Page) => page.evaluate(() => (window as unknown as { tasks: Task[] }).tasks[0]);

test.describe('Typed dates in the planner', () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test('the reader keeps names whole and understands how students write dates', async ({ page }) => {
    const cases: Array<[string, Partial<Parsed>]> = [
      ['Conclusion paragraph tomorrow', { name: 'Conclusion paragraph', date: '2026-03-10' }],
      ['Read chapter 3 homework', { name: 'Read chapter 3 homework', date: '', estTime: 0 }],
      ['Ch 5 hw tmrw', { name: 'Ch 5 hw', date: '2026-03-10', estTime: 0 }],
      ['Lab report on photosynthesis due friday', { name: 'Lab report on photosynthesis', date: '2026-03-13', type: 'lab' }],
      ['essay due 10/24', { name: 'Essay', date: '2026-10-24', type: 'essay' }],
      ['bio test oct 24th', { name: 'Bio test', date: '2026-10-24', type: 'test' }],
      ['history reading in 3 days', { date: '2026-03-12', type: 'reading' }],
      ['physics problem set due thurs 45 min', { name: 'Physics problem set', date: '2026-03-12', estTime: 45 }],
      ['algebra hw due the 20th at 9am urgent', { name: 'Algebra hw', date: '2026-03-20', time: '09:00', priority: 'high', subject: 'CLSe2e-math' }],
      ['SAT practice test', { name: 'SAT practice test', date: '' }],
      ['Read pages 10-12', { name: 'Read pages 10-12', date: '' }],
      ['High school application essay', { name: 'High school application essay', priority: 'med' }],
    ];
    const got = await page.evaluate((inputs) => {
      const parse = (window as unknown as { parseNLTask: (s: string) => unknown }).parseNLTask;
      return inputs.map((s) => parse(s));
    }, cases.map(([s]) => s));
    cases.forEach(([input, want], i) => {
      expect(got[i], `"${input}"`).toMatchObject(want);
    });
  });

  test('Quick add saves the date, time and class it read, and says the due date', async ({ page }) => {
    await page.evaluate(() => (window as unknown as { openQuickAdd: () => void }).openQuickAdd());
    const input = page.locator('#quickAddInput');
    await input.fill('Algebra quiz friday at 3pm');
    await expect(page.locator('#quickAddParsed')).toContainText('Mar 13');
    await input.press('Enter');
    await expect.poll(async () => (await newest(page)).name).toBe('Algebra quiz');
    expect(await newest(page)).toMatchObject({ date: '2026-03-13', time: '15:00', type: 'quiz', subject: 'CLSe2e-math' });
    await expect(page.locator('body')).toContainText('due Fri, Mar 13');
  });

  test('the New task form fills its fields from the title, and Enter adds the task', async ({ page }) => {
    await page.locator('.topbar-new-task-btn:not(.topbar-mob-only)').click();
    const title = page.locator('#taskName');
    await expect(title).toBeFocused();
    await title.pressSequentially('Algebra quiz friday');
    await expect(page.locator('#taskDate')).toHaveValue('2026-03-13');
    await expect(page.locator('#taskType')).toHaveValue('quiz');
    await expect(page.locator('#taskSubject')).toHaveValue('CLSe2e-math');
    await expect(page.locator('#taskNameParsed')).toContainText('Due Fri, Mar 13');

    // Taking the date words back out puts the date back to the default.
    await title.fill('Algebra quiz');
    await expect(page.locator('#taskDate')).toHaveValue('2026-03-09');
    await title.fill('Algebra quiz friday');

    await title.press('Enter');
    await expect(page.locator('#dashAddTaskModal')).toBeHidden();
    expect(await newest(page)).toMatchObject({ name: 'Algebra quiz', date: '2026-03-13', type: 'quiz', subject: 'CLSe2e-math' });
  });

  test('a field you set yourself is not overwritten by the title', async ({ page }) => {
    await page.locator('.topbar-new-task-btn:not(.topbar-mob-only)').click();
    await page.locator('#taskType').selectOption('project');
    await page.locator('#taskName').pressSequentially('Algebra quiz friday');
    await expect(page.locator('#taskDate')).toHaveValue('2026-03-13');
    await expect(page.locator('#taskType'), 'the type picked by hand was replaced').toHaveValue('project');
  });

  // The last subject and type are remembered on purpose (applyAddTaskDefaults);
  // the date was the one left behind by accident.
  test('each New task form starts due today instead of keeping the last task\'s date', async ({ page }) => {
    await page.locator('.topbar-new-task-btn:not(.topbar-mob-only)').click();
    await page.locator('#taskName').pressSequentially('Bio essay oct 24');
    await page.locator('#taskName').press('Enter');
    await expect(page.locator('#dashAddTaskModal')).toBeHidden();
    await page.waitForTimeout(500);

    await page.locator('.topbar-new-task-btn:not(.topbar-mob-only)').click();
    await expect(page.locator('#taskDate')).toHaveValue('2026-03-09');
    await expect(page.locator('#taskNameParsed')).toBeHidden();
  });

  test('an empty task list has a button that opens the New task form', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { tasks: Task[]; renderTasks: () => void };
      w.tasks.splice(0);
      w.renderTasks();
    });
    const add = page.locator('#taskList .flux-empty-add');
    await expect(add).toBeVisible();
    await add.click();
    await expect(page.locator('#dashAddTaskModal')).toBeVisible();
    await expect(page.locator('#taskName')).toBeFocused();
  });
});
