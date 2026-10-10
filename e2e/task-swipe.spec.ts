import { test, expect, type Page, type CDPSession } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * "Barely scrolling through the tasks sometimes checks them off and it's
 * impossible to find and undo it."
 *
 * Two causes. app.js had a second swipe handler beside flux-mobile-swipe.js
 * that completed a task on any 60px sideways drift, with no look at vertical
 * movement, and it was bound again on every showApp(). And the real one
 * decided "horizontal" on the first 6px — a scroll that started with a
 * little sideways wobble was taken for a swipe, and the scroll itself (the
 * row is touch-action: pan-y) carried the drift on past 80px.
 *
 * Real touch input through CDP, not synthetic TouchEvents, so the browser's
 * own scrolling takes part exactly as it does under a finger.
 */

const PHONE = { width: 390, height: 844 };

async function seed(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const list = Array.from({ length: 30 }, (_, i) => ({
      id: 8100 + i, name: `Swipe task ${i}`, date: day(1 + (i % 9)), priority: 'med', type: 'hw',
      done: false, subtasks: [], createdAt: Date.now() - i, urgencyScore: 30 - i,
    }));
    w.tasks.splice(0, w.tasks.length, ...list);
    w.save('tasks', w.tasks);
    w.renderTasks();
    w.__toggles = [];
    const orig = w.toggleTask;
    w.toggleTask = function (id: number) { w.__toggles.push(id); return orig.apply(this, arguments as any); };
  });
}

type Pt = { x: number; y: number };

/** The row's box once the page has stopped moving (boot banners and reveals land late). */
async function rowBox(page: Page, id: number) {
  const row = page.locator(`#taskList .task-item[data-task-id="${id}"]`);
  await row.scrollIntoViewIfNeeded();
  await expect(row).toHaveClass(/task-swipeable/);
  let prev = '';
  for (let i = 0; i < 40; i++) {
    const b = await row.boundingBox();
    if (!b) throw new Error('row has no box');
    // The page too: the windowed list renders more rows as it nears the end.
    const page_ = await page.evaluate(() => `${window.scrollY},${document.documentElement.scrollHeight}`);
    const key = `${Math.round(b.x)},${Math.round(b.y)},${page_}`;
    if (key === prev) return b;
    prev = key;
    await page.waitForTimeout(150);
  }
  throw new Error('the row never stopped moving');
}

/** A finger from `from`, through each point in `path`, then lifted (or cancelled). */
async function gesture(client: CDPSession, page: Page, from: Pt, path: Pt[], end: 'touchEnd' | 'touchCancel' = 'touchEnd') {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (const p of path) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
    await page.waitForTimeout(16);
  }
  await client.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
  await page.waitForTimeout(500);
}

function line(from: Pt, dx: number, dy: number, steps: number): Pt[] {
  return Array.from({ length: steps }, (_, i) => ({ x: from.x + (dx * (i + 1)) / steps, y: from.y + (dy * (i + 1)) / steps }));
}

const toggles = (page: Page) => page.evaluate(() => (window as any).__toggles.slice());
const isDone = (page: Page, id: number) => page.evaluate((i) => !!(window as any).tasks.find((t: any) => t.id === i)?.done, id);

test.describe('Swiping task rows on a phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await seed(page);
  });

  test('a clear swipe right completes the task once, with an undo', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    const b = await rowBox(page, 8103);
    const from = { x: b.x + 40, y: b.y + b.height / 2 };
    await gesture(client, page, from, line(from, 200, 4, 10));
    expect(await toggles(page), 'one swipe, one toggle').toEqual([8103]);
    expect(await isDone(page, 8103)).toBe(true);
    await expect(page.locator('#undoSnackbar')).toContainText('Task completed');
  });

  test('scrolling straight down the list completes nothing', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    const b = await rowBox(page, 8104);
    const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await gesture(client, page, from, line(from, 0, -300, 15));
    expect(await toggles(page)).toEqual([]);
  });

  test('a scroll that starts with a sideways wobble completes nothing', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    const b = await rowBox(page, 8105);
    const from = { x: b.x + 30, y: b.y + b.height / 2 };
    // The first 20px mostly sideways, then a diagonal scroll that drifts on to 110px right.
    const start = line(from, 18, -6, 3);
    const path = [...start, ...line(start[2], 92, -220, 14)];
    await gesture(client, page, from, path);
    expect(await toggles(page), 'a wobble at the start was read as a swipe').toEqual([]);
  });

  test('a slightly diagonal drag is not a swipe', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    const b = await rowBox(page, 8106);
    const from = { x: b.x + 30, y: b.y + b.height / 2 };
    // 34° off horizontal — more sideways than down, but nowhere near a clear swipe.
    await gesture(client, page, from, line(from, 120, -80, 12));
    expect(await toggles(page)).toEqual([]);
  });

  test('a swipe the browser cancels completes nothing', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    const b = await rowBox(page, 8107);
    const from = { x: b.x + 40, y: b.y + b.height / 2 };
    await gesture(client, page, from, line(from, 180, 0, 9), 'touchCancel');
    expect(await toggles(page)).toEqual([]);
    expect(await isDone(page, 8107)).toBe(false);
  });

  test('signing in again does not stack up swipe handlers', async ({ page }) => {
    // showApp() runs two or three times on a real sign-in.
    await page.evaluate(() => { (window as any).showApp(); (window as any).showApp(); (window as any).renderTasks(); });
    await page.waitForTimeout(1200);
    const client = await page.context().newCDPSession(page);
    // The page can still be settling after showApp(); try again if the swipe missed every row.
    for (let i = 0; i < 3 && !(await toggles(page)).length; i++) {
      const b = await rowBox(page, 8108);
      const from = { x: b.x + 40, y: b.y + b.height / 2 };
      await gesture(client, page, from, line(from, 200, 0, 10));
    }
    const hit = await toggles(page);
    expect(hit.length, 'one swipe toggled the task more than once').toBe(1);
    expect(await isDone(page, hit[0])).toBe(true);
  });
});
