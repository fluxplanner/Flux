import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Rebuilding the task list (a tick, a cloud pull, an undo) replaced every row.
 * Scrolled down a long list, that could move you; past the first 100 rows it
 * cut the list back to 100 and threw you up the page; and a focused check or
 * button lost focus to the page, so a keyboard user started again from the top.
 */

async function seed(page: Page, n: number) {
  await page.evaluate((count) => {
    const w = window as any;
    const day = (k: number) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
    // Due dates in id order, so the list order is the id order.
    const list = Array.from({ length: count }, (_, i) => ({
      id: 9500 + i, name: `Row ${i}`, date: day(1 + Math.floor(i / 3)), priority: 'med', type: 'hw',
      estTime: 0, done: false, subtasks: [], createdAt: Date.now() - i,
    }));
    w.tasks.splice(0, w.tasks.length, ...list);
    w.save('tasks', w.tasks);
    w.renderTasks();
  }, n);
  await settled(page);
}

/** The first draw of a list brings its rows in one after another; wait until all are in place. */
async function settled(page: Page) {
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#taskList .task-item')].filter((r) => {
    const cs = getComputedStyle(r);
    return cs.opacity !== '1' || (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)');
  }).length), { timeout: 10_000 }).toBe(0);
}

/** The first task row whose bottom is below the top of the screen, and where it is. */
const firstInView = (page: Page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll('#taskList > .task-item[data-task-id]')] as HTMLElement[];
  const r = rows.find((n) => n.getBoundingClientRect().bottom > 60);
  return r ? { id: r.dataset.taskId, top: Math.round(r.getBoundingClientRect().top) } : null;
});

async function scrollToRow(page: Page, id: number) {
  const row = page.locator(`#taskList .task-item[data-task-id="${id}"]`);
  await row.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
}

test.describe('The task list keeps your place', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
  });

  test('a rebuild leaves the list where it was, rows beyond the first 100 included', async ({ page }) => {
    await seed(page, 160);
    // Bring the second chunk in, the way scrolling does.
    await page.locator('#taskList [data-flux-sentinel]').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('#taskList > .task-item').count()).toBeGreaterThan(100);
    await scrollToRow(page, 9620);
    const before = await firstInView(page);
    const rendered = await page.locator('#taskList > .task-item').count();
    await page.evaluate(() => (window as any).renderTasks());   // what a pull or an undo does
    await page.waitForTimeout(600);
    const after = await firstInView(page);
    expect(after?.id).toBe(before?.id);
    // Within a few px (rows above can gain a badge as they redraw); it used to
    // be hundreds, or back to the top.
    expect(Math.abs((after?.top ?? 0) - (before?.top ?? 0))).toBeLessThanOrEqual(12);
    expect(await page.locator('#taskList > .task-item').count()).toBeGreaterThanOrEqual(rendered);
  });

  test('ticking a row while scrolled down closes the gap without moving the page', async ({ page }) => {
    await seed(page, 60);
    // Mid-screen, clear of the sticky bars, so the click itself scrolls nothing.
    await page.locator('#taskList .task-item[data-task-id="9530"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    const top = (id: number) => page.evaluate((i) => Math.round(document.querySelector(`#taskList .task-item[data-task-id="${i}"]`)!.getBoundingClientRect().top), id);
    const was = { above: await top(9529), row: await top(9530) };
    const box = (await page.locator('#taskList .task-item[data-task-id="9530"] .check').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(900);   // the rebuild takes 9530 out of Active
    expect(await page.locator('#taskList .task-item[data-task-id="9530"]').count()).toBe(0);
    // The row above has not moved, and the next one moved up into the gap.
    expect(Math.abs((await top(9529)) - was.above)).toBeLessThanOrEqual(12);
    expect(Math.abs((await top(9531)) - was.row)).toBeLessThanOrEqual(12);
  });

  /*
   * After a rebuild the list holds the row you were on in place for up to
   * 1.5 s, against rows above it growing. A wheel, key or touch ended that
   * hold, but momentum after a flick and a dragged scrollbar scroll with none
   * of those behind them: the next height change in the list pulled the page
   * back to where the rebuild had left it. Scrolled here by script, which
   * sends no input event either.
   */
  const rowTop = (page: Page, id: number) => page.evaluate((i) =>
    Math.round(document.querySelector(`#taskList .task-item[data-task-id="${i}"]`)!.getBoundingClientRect().top), id);
  /** Scroll the list's scroller (found the way the app finds it) by dy, in steps, one a frame. */
  const scrollList = (page: Page, dy: number, steps: number, growAt = -1) => page.evaluate(async ([d, n, g]) => {
    let el = document.getElementById('taskList')!.parentElement;
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) break;
    }
    const sc = (el && el !== document.body && el !== document.documentElement) ? el : document.scrollingElement!;
    for (let i = 0; i < n; i++) {
      sc.scrollBy({ top: d / n, left: 0, behavior: 'instant' as ScrollBehavior });
      if (i === g) {   // something in the list changes height mid-flick
        const pad = document.createElement('div');
        pad.style.height = '120px';
        document.getElementById('taskList')!.appendChild(pad);
      }
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
  }, [dy, steps, growAt] as const);
  const growList = (page: Page) => page.evaluate(() => {
    const pad = document.createElement('div');
    pad.style.height = '160px';
    document.getElementById('taskList')!.appendChild(pad);
  });

  test('a scrollbar drag during the hold after a rebuild is not pulled back', async ({ page }) => {
    await seed(page, 60);
    await scrollToRow(page, 9520);
    await page.evaluate(() => (window as any).renderTasks());   // the hold starts
    await page.waitForTimeout(50);
    await scrollList(page, 300, 1);                              // the thumb dragged 300px down in one go
    const there = await rowTop(page, 9530);
    await growList(page);                                        // while the hold would still be on
    await page.waitForTimeout(300);
    // Within a few px: rows above can still settle by a badge's height, and
    // the browser keeps what is on screen in place when they do. Pulled back
    // was the whole 300.
    expect(Math.abs((await rowTop(page, 9530)) - there), 'the page was pulled back against the scrollbar').toBeLessThanOrEqual(16);
  });

  test('momentum still running after a flick is not pulled back, even when the list changes mid-flick', async ({ page }) => {
    await seed(page, 60);
    await scrollToRow(page, 9520);
    const start = await rowTop(page, 9530);
    await page.evaluate(() => (window as any).renderTasks());   // the hold starts
    await page.waitForTimeout(50);
    await scrollList(page, 360, 12, 4);                          // a frame at a time, no input event at all
    const there = await rowTop(page, 9530);
    expect(start - there, 'the list was pulled back mid-flick').toBeGreaterThan(330);
    await growList(page);
    await page.waitForTimeout(300);
    expect(Math.abs((await rowTop(page, 9530)) - there), 'the page was pulled back against the flick').toBeLessThanOrEqual(16);
  });

  test('a task added after a rebuild still comes in; the rows already there do not', async ({ page }) => {
    await seed(page, 12);
    await page.evaluate(() => (window as any).renderTasks());
    const kept = await page.evaluate(() => {
      const row = document.querySelector('#taskList .task-item[data-task-id="9503"]') as HTMLElement;
      return { seen: row.classList.contains('task-seen'), anim: getComputedStyle(row).animationName, stagger: row.classList.contains('stagger-item') };
    });
    expect(kept).toEqual({ seen: true, anim: 'none', stagger: false });
    await page.evaluate(() => {
      const w = window as any;
      w.tasks.unshift({ id: 9599, name: 'Brand new', date: '', priority: 'med', type: 'hw', estTime: 0, done: false, subtasks: [], createdAt: Date.now() });
      w.save('tasks', w.tasks);
      w.renderTasks();
    });
    const fresh = await page.evaluate(() => {
      const row = document.querySelector('#taskList .task-item[data-task-id="9599"]') as HTMLElement;
      return { seen: row.classList.contains('task-seen'), anim: getComputedStyle(row).animationName };
    });
    expect(fresh).toEqual({ seen: false, anim: 'taskEnter' });
  });

  test('a focused button keeps focus through a rebuild', async ({ page }) => {
    await seed(page, 20);
    const edit = page.locator('#taskList .task-item[data-task-id="9505"] button[title="Edit"]');
    await edit.focus();
    await page.evaluate(() => (window as any).renderTasks());
    expect(await page.evaluate(() => {
      const a = document.activeElement as HTMLElement;
      return { title: a?.getAttribute('title'), id: a?.closest('[data-task-id]')?.getAttribute('data-task-id') };
    })).toEqual({ title: 'Edit', id: '9505' });
  });

  test('ticking from the keyboard moves focus to the next task, not the top of the page', async ({ page }) => {
    await seed(page, 20);
    await page.locator('#taskList .task-item[data-task-id="9506"] .check').focus();
    await page.keyboard.press(' ');
    await page.waitForTimeout(900);   // the rebuild takes 9506 out of Active
    expect(await page.evaluate(() => {
      const a = document.activeElement as HTMLElement;
      return { check: a?.classList.contains('check'), id: a?.closest('[data-task-id]')?.getAttribute('data-task-id') };
    })).toEqual({ check: true, id: '9507' });
    // And the next Space ticks that one.
    await page.keyboard.press(' ');
    await expect.poll(() => page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 9507).done)).toBe(true);
  });

  test('ticking with the mouse hands focus to nothing, so a later Space ticks no other task', async ({ page }) => {
    await seed(page, 20);
    await page.locator('#taskList .task-item[data-task-id="9506"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const box = (await page.locator('#taskList .task-item[data-task-id="9506"] .check').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(900);   // the rebuild takes 9506 out of Active
    expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.closest('#taskList [data-task-id]')?.getAttribute('data-task-id') ?? null),
      'focus moved on to the next task after a click').toBeNull();
    await page.keyboard.press(' ');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 9507).done), 'Space ticked a task nobody chose').toBe(false);
  });

  {
    test('in Today, a keyboard tick moves on to the next task, not after the ticked one', async ({ page }) => {
      await page.evaluate(() => {
        const w = window as any;
        const today = w.todayStr();
        const list = Array.from({ length: 8 }, (_, i) => ({
          id: 9600 + i, name: `Today ${i}`, date: today, priority: 'med', type: 'hw', estTime: 0, done: false, subtasks: [], createdAt: Date.now() - i,
        }));
        w.tasks.splice(0, w.tasks.length, ...list);
        w.save('tasks', w.tasks);
        w.setFilter('today', document.querySelector('#filterChips .tmode-btn:nth-child(2)'));
      });
      await page.waitForTimeout(400);
      const order = await page.evaluate(() => [...document.querySelectorAll('#taskList > .task-item')].map((n) => (n as HTMLElement).dataset.taskId));
      const [first, second] = order;
      await page.locator(`#taskList .task-item[data-task-id="${first}"] .check`).focus();
      await page.keyboard.press(' ');
      await page.waitForTimeout(900);
      const at = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement;
        return { check: a?.classList.contains('check'), id: a?.closest('[data-task-id]')?.getAttribute('data-task-id'), inDone: !!a?.closest('#completedTasksWrap') };
      });
      expect(at).toEqual({ check: true, id: second, inDone: false });
    });
  }
});
