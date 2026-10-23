import { test, expect, type Page } from '@playwright/test';
import { gotoScenario, stubCloudRow } from './helpers';

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

  /* The bar names the completion, but its Undo took back the latest change of
     any kind. A task dragged to another day on the calendar records a change
     with no bar of its own: Undo then moved that task back and left the named
     one ticked. */
  const dragOnCalendar = (page: Page, id: number, date: string) => page.evaluate(([i, d]) => {
    const cell = document.createElement('div');
    cell.setAttribute('data-cal-date', d as string);
    (window as any).fluxCalDrop({ preventDefault() {}, currentTarget: cell, dataTransfer: { getData: () => String(i) } });
  }, [id, date] as const);
  const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const taskNow = (page: Page, id: number) => page.evaluate((i) => {
    const t = (window as any).tasks.find((x: any) => x.id === i);
    return t ? { done: !!t.done, date: t.date } : null;
  }, id);

  test('the bar\'s Undo takes back the completion it names, not a calendar drag made since', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seedToday(page);
    await page.locator('#taskList .task-item[data-task-id="9302"] .check').click();
    const bar = page.locator('#undoSnackbar');
    await expect(bar).toContainText('Maths sheet');
    await dragOnCalendar(page, 9301, inDays(3));             // another task moved, bar still up
    expect((await taskNow(page, 9301))?.date).toBe(inDays(3));
    await bar.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => taskNow(page, 9302), { message: 'Undo did not take back the completion it named' }).toEqual({ done: false, date: today() });
    expect((await taskNow(page, 9301))?.date, 'Undo took back the calendar drag instead').toBe(inDays(3));
    // Saved like that too, and Ctrl+Z still undoes the drag after it.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tasks') || '[]').find((t: any) => t.id === 9302).done)).toBe(false);
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press('Control+z');
    await expect.poll(() => taskNow(page, 9301)).toEqual({ done: false, date: today() });
    expect((await taskNow(page, 9302))?.done, 'undoing the drag ticked the task again').toBe(false);
  });

  test('the bar\'s Undo says it can\'t when that task has been changed since, and changes nothing', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seedToday(page);
    await page.locator('#taskList .task-item[data-task-id="9302"] .check').click();
    const bar = page.locator('#undoSnackbar');
    await expect(bar).toContainText('Maths sheet');
    await dragOnCalendar(page, 9302, inDays(2));             // the ticked task itself, moved
    await bar.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('#toastLive')).toContainText('Can’t undo that');
    expect(await taskNow(page, 9302)).toEqual({ done: true, date: inDays(2) });
    expect((await taskNow(page, 9301))?.done).toBe(false);
  });

  test('the bar\'s Undo takes back only its own change: a task added and a rename made since both stay', async ({ page }) => {
    // It put back the whole list from before the tick: the task added after
    // it was deleted (and tombstoned, so deleted on every device), and the
    // rename made in the edit window was reverted.
    await gotoScenario(page, 'student-semester');
    await seedToday(page);
    await page.locator('#taskList .task-item[data-task-id="9302"] .check').click();
    const bar = page.locator('#undoSnackbar');
    await expect(bar).toContainText('Maths sheet');
    const added = await page.evaluate(() => {
      const w = window as any;
      (document.getElementById('taskName') as HTMLInputElement).value = 'Added after the tick';
      w.addTask();
      w.openEdit(9301);
      (document.getElementById('editText') as HTMLInputElement).value = 'Read chapter 5';
      w.saveEdit();
      return w.tasks.find((t: any) => t.name === 'Added after the tick')?.id;
    });
    expect(added, 'the task was not added').toBeTruthy();
    await bar.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => taskNow(page, 9302), { message: 'Undo did not take back the tick' }).toEqual({ done: false, date: today() });
    const after = await page.evaluate((id) => {
      const w = window as any;
      const tomb = JSON.parse(localStorage.getItem(w.fluxNamespacedKey('flux_list_tombstones_v1')) || '{}').tasks || {};
      return {
        kept: w.tasks.some((t: any) => t.id === id),
        name: w.tasks.find((t: any) => t.id === 9301)?.name,
        tombstoned: Object.keys(tomb).includes(String(id)),
      };
    }, added);
    expect(after).toEqual({ kept: true, name: 'Read chapter 5', tombstoned: false });
  });

  test('a recurring task\'s next one goes too when its completion is undone from the bar', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate((d) => {
      const w = window as any;
      w.tasks.splice(0, w.tasks.length,
        { id: 9311, name: 'Weekly quiz', date: d, priority: 'med', type: 'hw', estTime: 0, done: false, subtasks: [], createdAt: Date.now(), recurringType: 'weekly', recurringWeekly: true },
        { id: 9312, name: 'Essay plan', date: d, priority: 'med', type: 'hw', estTime: 0, done: false, subtasks: [], createdAt: Date.now() });
      w.save('tasks', w.tasks);
      w.renderTasks();
    }, today());
    await page.locator('#taskList .task-item[data-task-id="9311"] .check').click();
    await expect(page.locator('#undoSnackbar')).toContainText('Weekly quiz');
    const count = () => page.evaluate(() => (window as any).tasks.filter((t: any) => t.name === 'Weekly quiz').length);
    expect(await count(), 'ticking it added the next one').toBe(2);
    await dragOnCalendar(page, 9312, inDays(4));
    await page.locator('#undoSnackbar').getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => taskNow(page, 9311)).toEqual({ done: false, date: today() });
    expect(await count(), 'the next repeat stayed behind').toBe(1);
    expect((await taskNow(page, 9312))?.date).toBe(inDays(4));
  });

  test('Ctrl+Z in the note editor is the text\'s own undo, not a task\'s', async ({ page }) => {
    // The shortcut skipped inputs and textareas but not a contenteditable
    // editor: Ctrl+Z there took back the last task change instead. Letters
    // typed there opened quick add too.
    await gotoScenario(page, 'student-semester');
    await seedToday(page);
    await page.locator('#taskList .task-item[data-task-id="9301"] .check').click();
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const w = window as any;
      w.openNewNote();
      const panel = document.getElementById('notes')!;
      panel.style.display = 'block';
      panel.classList.add('active');
    });
    const editor = page.locator('#noteEditor');
    await editor.click();
    await page.keyboard.insertText('Need to finish the lab');   // text in, no key events
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    expect((await taskNow(page, 9301))?.done, 'Ctrl+Z in the note undid a task').toBe(true);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('noteEditor');
    await page.keyboard.type(' now');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as any).FluxOverlays.anyOpen()), 'typing "n" in the note opened quick add').toBe(false);
    await expect(editor).toContainText('now');
    // Out of the editor, Ctrl+Z is the planner's again.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('Control+z');
    await expect.poll(() => taskNow(page, 9301).then((t) => t?.done)).toBe(false);
  });

  test('undo keeps a task another device added in the meantime', async ({ page }) => {
    // teacher-workflow has a signed-in user; the stub stands in for Supabase.
    await gotoScenario(page, 'teacher-workflow');
    await stubCloudRow(page);
    const res = await page.evaluate(async () => {
      const w = window as any;
      w.__fluxStubRow();
      w.tasks.push({ id: 9401, name: 'Lab write-up', date: '', priority: 'med', done: false, subtasks: [], createdAt: Date.now() });
      w.save('tasks', w.tasks);
      await w.syncFromCloud();          // agree with the stub first
      await w.syncToCloud();
      w.toggleTask(9401);               // the change to undo
      // Meanwhile, on a phone:
      w.__writeRow((row: any) => {
        row.tasks.unshift({ id: 9402, name: 'Added on my phone', date: '', priority: 'med', done: false, subtasks: [], createdAt: Date.now(), updatedAt: Date.now() });
        return row;
      });
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
