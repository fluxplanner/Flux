import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * "Clicking the complete button on tasks doesn't always work/lags and it lags
 * like crazy with the completed animation."
 *
 * toggleTask() waited for the completion animation (~800ms) before it saved or
 * filled the check, then rebuilt the list and replayed the entrance animation
 * on every row. On a phone (low-end mode) the check never filled at all until
 * that rebuild. Now the tick is saved and painted at once and the list is
 * rebuilt once, after the last tick, never under a pressed finger.
 */

async function seed(page: Page, n = 40) {
  await page.evaluate((count) => {
    const w = window as any;
    const day = (k: number) => { const d = new Date(); d.setDate(d.getDate() + k); return d.toISOString().slice(0, 10); };
    const list = Array.from({ length: count }, (_, i) => ({
      id: 9100 + i, name: `Task ${i}`, date: day(1 + (i % 12)), priority: 'med', type: 'hw',
      estTime: 0, done: false, subtasks: [], createdAt: Date.now() - i,
    }));
    w.tasks.splice(0, w.tasks.length, ...list);
    w.save('tasks', w.tasks);
    w.renderTasks();
    w.__toggles = [];
    const orig = w.toggleTask;
    w.toggleTask = function (id: number) { w.__toggles.push(id); return orig.apply(this, arguments as any); };
    w.__entered = 0;
    const FA = w.FluxAnim;
    const enter = FA.tasksEnter;
    FA.tasksEnter = function (els: any) { w.__entered += (els && els.length) || 0; return enter.apply(this, arguments as any); };
  }, n);
  // Let the first render's own entrance finish before measuring anything.
  await page.waitForTimeout(400);
  await page.evaluate(() => { (window as any).__entered = 0; });
}

/** Records, in order, when this task's check fills, when the tasks are saved and when the list is rebuilt. */
async function watch(page: Page, id: number) {
  await page.evaluate((i) => {
    const w = window as any;
    const ev: string[] = (w.__events = []);
    const chk = document.querySelector(`#taskList .task-item[data-task-id="${i}"] .check`)!;
    new MutationObserver((r, o) => {
      if (chk.classList.contains('done') && chk.getAttribute('aria-checked') === 'true') { ev.push('filled'); o.disconnect(); }
    }).observe(chk, { attributes: true });
    new MutationObserver((r, o) => { ev.push('rebuilt'); o.disconnect(); }).observe(document.getElementById('taskList')!, { childList: true });
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (/(^|:)tasks$/.test(k) && !ev.includes('saved')) {
        try { if (JSON.parse(v).find((t: any) => t.id === i)?.done) ev.push('saved'); } catch (_) { /* not ours */ }
      }
      return set.call(this, k, v);
    };
  }, id);
}
const events = (page: Page) => page.evaluate(() => (window as any).__events.slice());

const check = (page: Page, id: number) => page.locator(`#taskList .task-item[data-task-id="${id}"] .check`);
const stored = (page: Page, id: number) => page.evaluate((i) => {
  const raw = localStorage.getItem('tasks') || '[]';
  return !!JSON.parse(raw).find((t: any) => t.id === i)?.done;
}, id);

test.describe('Ticking a task off', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seed(page);
  });

  test('the check fills and the tick is saved straight away', async ({ page }) => {
    const chk = check(page, 9100);
    await chk.scrollIntoViewIfNeeded();
    await watch(page, 9100);
    await chk.click();
    // Filled and saved in the click itself, before the list is rebuilt (the
    // old code saved and filled only after an ~800ms animation, by rebuilding).
    await expect.poll(() => events(page)).toContain('rebuilt');
    const ev = await events(page);
    expect(ev.slice(0, 2).sort()).toEqual(['filled', 'saved']);
    expect(ev[2]).toBe('rebuilt');
    expect(await stored(page, 9100)).toBe(true);
    await expect(page.locator('#undoSnackbar')).toContainText('Task 0');
  });

  test('ticking one task does not replay the animation on the rest of the list', async ({ page }) => {
    await check(page, 9100).click();
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => (window as any).__entered), 'rows re-animated after one tick').toBe(0);
    // The rebuild did happen: the finished task left the Active list.
    await expect(page.locator('#taskList .task-item[data-task-id="9100"]')).toHaveCount(0);
  });

  test('every click counts: two quick clicks tick and untick, three tasks in a row all stay ticked', async ({ page }) => {
    await check(page, 9101).dblclick();
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => (window as any).__toggles)).toEqual([9101, 9101]);
    expect(await stored(page, 9101)).toBe(false);

    await page.evaluate(() => { (window as any).__toggles = []; });
    for (const id of [9102, 9103, 9104]) await check(page, id).click();
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => (window as any).__toggles)).toEqual([9102, 9103, 9104]);
    for (const id of [9102, 9103, 9104]) expect(await stored(page, id)).toBe(true);
  });

  test('a press held across the rebuild still counts', async ({ page }) => {
    // 9116 sits just above 9105 (both lists are by due date), so 9105 leaving
    // the list does not move it.
    await check(page, 9105).scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const w = window as any;
      const ev: string[] = (w.__events = []);
      new MutationObserver(() => ev.push('rebuilt')).observe(document.getElementById('taskList')!, { childList: true });
      document.addEventListener('pointerdown', () => ev.push('down'), true);
      document.addEventListener('pointerup', () => ev.push('up'), true);
    });
    await check(page, 9105).click();
    // Where 9116's check is once the page has stopped moving, and that it is
    // what is actually under that point.
    let box = (await check(page, 9116).boundingBox())!;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(60);
      const b = (await check(page, 9116).boundingBox())!;
      if (Math.abs(b.y - box.y) < 0.5 && Math.abs(b.x - box.x) < 0.5) break;
      box = b;
    }
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    expect(await page.evaluate(({ x, y }) => (document.elementFromPoint(x, y) as HTMLElement)?.closest('.task-item')?.getAttribute('data-task-id'), at)).toBe('9116');
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(1000);   // past when the rebuild was due
    await page.mouse.up();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as any).__toggles), (await events(page)).join(' ')).toEqual([9105, 9116]);
    expect(await stored(page, 9116)).toBe(true);
    // Never rebuilt under the held press.
    const ev = (await events(page)).join(' ');
    expect(ev).not.toMatch(/down(?: rebuilt)+ up$|down rebuilt+ up /);
    expect(ev.split('down').pop()).toMatch(/^ up/);
  });

  test('the check is a keyboard checkbox, and Enter ticks once', async ({ page }) => {
    // j puts flux-pro's highlight on the first row; Enter on another row's
    // check must tick that one, once, and leave the highlighted one alone.
    await page.locator('body').press('j');
    const c = check(page, 9107);
    await expect(c).toHaveAttribute('role', 'checkbox');
    await c.focus();
    await watch(page, 9107);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as any).__toggles)).toEqual([9107]);
    expect(await events(page), 'the checkbox never said it was checked').toContain('filled');
    expect(await stored(page, 9107)).toBe(true);
    // Space works the same way.
    await check(page, 9108).focus();
    await page.keyboard.press(' ');
    expect(await page.evaluate(() => (window as any).__toggles)).toEqual([9107, 9108]);
    expect(await stored(page, 9108)).toBe(true);
  });

  test('with reduced motion the tick is just as immediate, with no burst', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await watch(page, 9108);
    await page.evaluate(() => {
      const w = window as any;
      w.__particles = 0;
      new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((n: any) => {
        if (n.classList && (n.classList.contains('task-burst-particle') || n.classList.contains('confetti-piece'))) w.__particles++;
      }))).observe(document.body, { childList: true });
    });
    await check(page, 9108).click();
    await expect.poll(() => events(page)).toContain('rebuilt');
    const ev = await events(page);
    expect(ev.indexOf('filled')).toBeGreaterThan(-1);
    expect(ev.indexOf('filled')).toBeLessThan(ev.indexOf('rebuilt'));
    expect(await page.evaluate(() => (window as any).__particles)).toBe(0);
    expect(await stored(page, 9108)).toBe(true);
  });
});

test.describe('Ticking a task off on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tap fills the check at once (phones run in low-end mode)', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seed(page);
    const chk = check(page, 9100);
    await chk.scrollIntoViewIfNeeded();
    await watch(page, 9100);
    await chk.tap();
    await expect.poll(() => events(page)).toContain('rebuilt');
    const ev = await events(page);
    expect(ev.indexOf('filled'), 'the check stayed empty until the list was rebuilt').toBeGreaterThan(-1);
    expect(ev.indexOf('filled')).toBeLessThan(ev.indexOf('rebuilt'));
    expect(await stored(page, 9100)).toBe(true);
  });
});
