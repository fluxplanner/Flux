import { test, expect } from '@playwright/test';
import { bootSignedIn, gotoScenario, type BootTask } from './helpers';

/*
 * "Site is very laggy and refreshes multiple times when first opened and
 * undoes what you do before that refresh."
 *
 * Nothing reloaded the page. What undid the work was the first cloud pull of
 * the session: it replaced the whole task list with the row as it stood when
 * the request left, so a tick made while it was out was thrown away — and the
 * next push wrote that old list back over the cloud too. Reproduced below with
 * the real sign-in path and a stand-in Supabase whose first read is held open
 * until the test has ticked a task.
 */

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const TASKS: BootTask[] = Array.from({ length: 6 }, (_, i) => ({
  id: 7000 + i, name: `Boot task ${i}`, date: day(i + 1), priority: 'med', type: 'hw',
  done: false, subtasks: [], createdAt: 1_700_000_000_000 + i,
}));

test.describe('Opening Flux signed in', () => {
  test('a task ticked before the first pull lands stays ticked, here and in the cloud', async ({ page }) => {
    const boot = await bootSignedIn(page, { tasks: TASKS, holdFirstPull: true });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect.poll(() => boot.state.pulls, { message: 'the boot pull never went out' }).toBe(1);

    // The pull is out (and held). Tick a task now, as someone would.
    await page.evaluate(() => (window as any).toggleTask(7002));
    await page.waitForTimeout(400);
    expect(boot.state.pushes, 'a push went out before the pull: it would overwrite other devices').toBe(0);

    boot.releasePull();   // the row comes back — without the tick
    await expect.poll(() => boot.cloudTask(7002)?.done, { message: 'the tick never reached the cloud', timeout: 10_000 }).toBe(true);
    const here = await page.evaluate(() => ({
      mem: (window as any).tasks.find((t: any) => t.id === 7002)?.done,
      stored: JSON.parse(localStorage.getItem('tasks') || '[]').find((t: any) => t.id === 7002)?.done,
    }));
    expect(here, 'the pull undid the tick').toEqual({ mem: true, stored: true });
    expect(boot.state.pushedBeforeFirstPull).toBe(false);
  });

  test('a task deleted before the first pull lands stays deleted', async ({ page }) => {
    const boot = await bootSignedIn(page, { tasks: TASKS, holdFirstPull: true });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect.poll(() => boot.state.pulls).toBe(1);
    await page.evaluate(() => (window as any).deleteTask(7004));
    boot.releasePull();
    await expect.poll(() => boot.cloudTask(7004), { timeout: 10_000 }).toBeUndefined();
    expect(await page.evaluate(() => (window as any).tasks.some((t: any) => t.id === 7004))).toBe(false);
    // And it travels as a tombstone, so another device deletes it too rather
    // than taking the gap for a stale push.
    const tomb = (boot.state.cloud as any).listTombstones?.tasks || {};
    expect(Object.keys(tomb)).toContain('7004');
  });

  test('a change made on another device still arrives on open', async ({ page }) => {
    const cloudTasks = TASKS.map((t) => (t.id === 7001 ? { ...t, name: 'Renamed on my phone', updatedAt: Date.now() } : t));
    cloudTasks.unshift({ id: 7100, name: 'Added on my phone', done: false, createdAt: Date.now() });
    const boot = await bootSignedIn(page, { tasks: TASKS, cloud: { tasks: cloudTasks, onboarded: true } });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect.poll(() => page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 7100)?.name), { timeout: 10_000 })
      .toBe('Added on my phone');
    expect(await page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 7001)?.name)).toBe('Renamed on my phone');
    expect(boot.state.pushedBeforeFirstPull).toBe(false);
  });

  test('opening never reloads the page', async ({ page }) => {
    await bootSignedIn(page, { tasks: TASKS });
    let navigations = 0;
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations++; });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await page.waitForTimeout(5000);
    expect(navigations, 'the page navigated again after opening').toBe(1);
    expect(await page.evaluate(() => sessionStorage.getItem('__fluxBootLoads'))).toBe('1');
  });

  test('opening draws the task list twice at most: what is on this device, then the account', async ({ page }) => {
    // It was five: once from this device, then the pull, the skeleton coming
    // off, showApp() again, the route home and the skeleton check again, all
    // inside half a second. Each one replaced every row under the finger.
    await bootSignedIn(page, { tasks: TASKS });
    await page.addInitScript(() => {
      const w = window as any;
      w.__listDraws = 0;
      w.__panelEnters = 0;
      new MutationObserver((recs) => {
        for (const r of recs) {
          const t = r.target as HTMLElement;
          // Drawn where you can see it (the first, hidden draw behind the splash is not one).
          const shown = document.getElementById('app')?.classList.contains('visible');
          if (shown && r.type === 'childList' && t.id === 'taskList' && [...r.addedNodes].some((n) => (n as HTMLElement).classList?.contains('task-item'))) w.__listDraws++;
          if (r.type === 'attributes' && t.id === 'dashboard' && t.classList.contains('flux-panel-enter')) w.__panelEnters++;
        }
      }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect(page.locator('#fluxRoleSkeletonOverlay')).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(2500);
    const seen = await page.evaluate(() => ({ draws: (window as any).__listDraws, enters: (window as any).__panelEnters }));
    expect(seen.draws, 'the task list was rebuilt over and over while opening').toBeLessThanOrEqual(2);
    expect(seen.enters, 'the dashboard replayed its entrance after it was already up').toBe(0);
    await expect(page.locator('#taskList .task-item')).toHaveCount(TASKS.length);
  });

  test('an idle device stops writing its copy over the cloud', async ({ page }) => {
    const boot = await bootSignedIn(page, { tasks: TASKS });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    // Let sign-in finish and its own first writes settle.
    await page.waitForTimeout(4000);
    const before = boot.state.pushes;
    await page.waitForTimeout(6000);   // two and a bit push intervals
    expect(boot.state.pushes - before, 'pushed an unchanged copy on the 2.5s timer').toBe(0);
    // A real edit still goes straight up.
    await page.evaluate(() => (window as any).toggleTask(7003));
    await expect.poll(() => boot.cloudTask(7003)?.done, { timeout: 5000 }).toBe(true);
  });
});

test.describe('A pull that is out while you work', () => {
  test('ticking a task while a pull is in flight is not undone by it', async ({ page }) => {
    // teacher-workflow has a signed-in user; the stub stands in for Supabase.
    await gotoScenario(page, 'teacher-workflow');
    const res = await page.evaluate(async () => {
      const w = window as any;
      let row = JSON.parse(JSON.stringify(w.getCloudPayload()));
      let hold: (() => void) | null = null;
      w.getSB = () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => {
                const snap = JSON.parse(JSON.stringify(row));
                if (hold === null) await new Promise<void>((r) => { hold = r; });
                return { data: { data: snap }, error: null };
              },
            }),
          }),
          upsert: async (o: any) => { row = JSON.parse(JSON.stringify(o.data)); w.__row = row; return { error: null }; },
        }),
      });
      // Settle once so this device and the stub agree.
      hold = () => {};
      await w.syncFromCloud();
      hold = null;
      const id = w.tasks.find((t: any) => !t.done).id;
      const pull = w.syncFromCloud();          // goes out, holds
      await new Promise((r) => setTimeout(r, 50));
      w.toggleTask(id);                         // ticked while it is out
      (hold as any)?.();                        // the old row comes back
      await pull;
      return { id, here: w.tasks.find((t: any) => t.id === id).done };
    });
    expect(res.here, 'the in-flight pull undid the tick').toBe(true);
    await expect.poll(() => page.evaluate((id) => {
      const row = (window as any).__row;
      return row ? row.tasks.find((t: any) => t.id === id)?.done : undefined;
    }, res.id), { message: 'the tick never went back up', timeout: 5000 }).toBe(true);
  });
});
