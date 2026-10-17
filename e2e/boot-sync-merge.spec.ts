import { test, expect } from '@playwright/test';
import { bootSignedIn, gotoScenario, stubCloudRow, type BootTask } from './helpers';

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

  test('an assignment imported here and on another device before either synced shows once', async ({ page }) => {
    const mine = { id: 7201, name: 'Lab report', date: day(2), canvasCourseId: 5, canvasAssignmentId: 9, done: false, createdAt: Date.now() - 1000 };
    const theirs = { ...mine, id: 7302, createdAt: Date.now() - 2000, updatedAt: Date.now() - 2000 };
    const boot = await bootSignedIn(page, { tasks: [mine, ...TASKS], cloud: { tasks: [theirs, ...TASKS], onboarded: true } });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect.poll(() => boot.state.pulls, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect(page.locator('#fluxRoleSkeletonOverlay')).toHaveCount(0, { timeout: 10_000 });
    const ids = await page.evaluate(() => (window as any).tasks.filter((t: any) => t.canvasAssignmentId === 9).map((t: any) => t.id));
    expect(ids, 'the same assignment came out twice').toEqual([7302]);
    await expect(page.locator('#taskList .task-item', { hasText: 'Lab report' })).toHaveCount(1);
    expect((boot.state.cloud.tasks || []).filter((t: any) => t.canvasAssignmentId === 9).length).toBe(1);
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

test.describe('Pulls that fail, and other tabs', () => {
  test('a pull that fails keeps pushes held until one comes back', async ({ page }) => {
    // It used to open the gate all the same, and the next push sent this
    // device's unmerged copy over the cloud — on a new device, an empty one.
    const boot = await bootSignedIn(page, { tasks: TASKS, failPulls: 1 });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect.poll(() => boot.state.failedPulls, { timeout: 10_000 }).toBe(1);
    await page.evaluate(() => (window as any).toggleTask(7002));
    await page.waitForTimeout(3500);   // more than a push interval
    expect(boot.state.pushes, 'pushed an unmerged copy after a failed pull').toBe(0);
    await page.evaluate(() => (window as any).FluxSync.pull());
    await expect.poll(() => boot.cloudTask(7002)?.done, { message: 'the tick never went up once a pull came back', timeout: 10_000 }).toBe(true);
  });

  test('a tab open from earlier neither drops what another tab added nor undoes its rename', async ({ page, context }) => {
    // The base lived only in shared storage: tab A's push moved tab B's base
    // too, so B took A's new task for one it had deleted and its own old copy
    // of the renamed task for a newer edit — and pushed both back.
    const boot = await bootSignedIn(page, { tasks: TASKS });
    await page.goto('/');                                    // tab B
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect(page.locator('#fluxRoleSkeletonOverlay')).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(1500);
    const tabA = await context.newPage();
    await tabA.goto('/');
    await expect(tabA.locator('#app')).toHaveClass(/visible/);
    await expect(tabA.locator('#fluxRoleSkeletonOverlay')).toHaveCount(0, { timeout: 10_000 });
    await tabA.evaluate(async () => {
      const w = window as any;
      w.tasks.unshift({ id: 7150, name: 'Added in tab A', done: false, subtasks: [], createdAt: Date.now() });
      w.tasks.find((t: any) => t.id === 7001).name = 'Renamed in tab A';
      w.save('tasks', w.tasks);
      await w.FluxSync.push();
    });
    await expect.poll(() => boot.cloudTask(7150)?.name, { timeout: 10_000 }).toBe('Added in tab A');
    await tabA.close();
    const b = await page.evaluate(async () => {
      const w = window as any;
      await w.FluxSync.pull();
      await w.FluxSync.push();
      return { added: w.tasks.some((t: any) => t.id === 7150), name: w.tasks.find((t: any) => t.id === 7001)?.name };
    });
    expect(b, 'tab B undid tab A').toEqual({ added: true, name: 'Renamed in tab A' });
    expect(boot.cloudTask(7150)?.name, 'the cloud lost tab A\'s task').toBe('Added in tab A');
    expect(boot.cloudTask(7001)?.name, 'the cloud lost tab A\'s rename').toBe('Renamed in tab A');
  });
});

test.describe('A pull that is out while you work', () => {
  test('ticking a task while a pull is in flight is not undone by it', async ({ page }) => {
    // teacher-workflow has a signed-in user; the stub stands in for Supabase.
    await gotoScenario(page, 'teacher-workflow');
    await stubCloudRow(page);
    const res = await page.evaluate(async () => {
      const w = window as any;
      w.__fluxStubRow();
      // Settle once so this device and the stub agree.
      await w.syncFromCloud();
      let release: () => void = () => {};
      w.__rowRead = () => new Promise<void>((r) => { release = r; });
      const id = w.tasks.find((t: any) => !t.done).id;
      const pull = w.syncFromCloud();          // goes out, holds
      await new Promise((r) => setTimeout(r, 50));
      w.__rowRead = null;
      w.toggleTask(id);                         // ticked while it is out
      release();                                // the old row comes back
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

test.describe('Pushes only write over the row they merged', () => {
  // A tab or device that had not pulled lately wrote its older list over the
  // row, and the merge then took the tasks missing from it for deleted —
  // everywhere. Now each write names the updated_at it merged; the stand-in
  // answers like PostgREST, so a write over a newer row lands nowhere.
  async function open(page: import('@playwright/test').Page) {
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect(page.locator('#fluxRoleSkeletonOverlay')).toHaveCount(0, { timeout: 10_000 });
  }
  const task = (id: number, name: string) => ({ id, name, done: false, subtasks: [], createdAt: Date.now() });

  test('a tab that has not pulled since another tab added a task cannot write its older list over it', async ({ page, context }) => {
    const boot = await bootSignedIn(page, { tasks: TASKS });
    await open(page);                                         // tab B
    await expect.poll(() => (boot.state.cloud as any).syncCas, { timeout: 10_000 }).toBe(1);
    const tabA = await context.newPage();
    await open(tabA);
    await tabA.evaluate(async (t) => {
      const w = window as any;
      w.tasks.unshift(t);
      w.save('tasks', w.tasks);
      await w.FluxSync.push();
    }, task(7150, 'Added in tab A'));
    await expect.poll(() => boot.cloudTask(7150)?.name, { timeout: 10_000 }).toBe('Added in tab A');
    await tabA.close();
    // Tab B has not pulled since (its 8s pull may still get there first; either way nothing is lost). It ticks something and pushes straight away.
    await page.evaluate(async () => { const w = window as any; w.toggleTask(7002); await w.FluxSync.push(); });
    await expect.poll(() => boot.cloudTask(7002)?.done, { message: 'tab B\'s tick never went up', timeout: 10_000 }).toBe(true);
    expect(boot.cloudTask(7150)?.name, 'tab B wrote its older list over tab A\'s task').toBe('Added in tab A');
    expect(await page.evaluate(() => (window as any).tasks.some((t: any) => t.id === 7150)), 'tab B never took in tab A\'s task').toBe(true);
  });

  test('Claude deletes a task and adds one while Flux is open: a tick made then keeps both changes', async ({ page }) => {
    const boot = await bootSignedIn(page, { tasks: TASKS });
    await open(page);
    await expect.poll(() => (boot.state.cloud as any).syncCas, { timeout: 10_000 }).toBe(1);
    // The connector's write (mcp/index.ts): conditional, and it keeps the rest of the row.
    boot.writeElsewhere((row) => ({ ...row, tasks: [task(7190, 'From Claude'), ...(row.tasks || []).filter((t) => t.id !== 7004)] }));
    await page.evaluate(() => (window as any).toggleTask(7001));
    await expect.poll(() => boot.cloudTask(7001)?.done, { message: 'the tick never went up', timeout: 10_000 }).toBe(true);
    expect(boot.cloudTask(7004), 'the task Claude deleted came back').toBeUndefined();
    expect(boot.cloudTask(7190)?.name, 'the task Claude added was lost').toBe('From Claude');
    const here = await page.evaluate(() => (window as any).tasks.map((t: any) => t.id));
    expect(here).toContain(7190);
    expect(here).not.toContain(7004);
  });

  test('back online: what another device did meanwhile is merged before this one\'s tick goes up', async ({ page, context }) => {
    const boot = await bootSignedIn(page, { tasks: TASKS });
    await open(page);
    await expect.poll(() => (boot.state.cloud as any).syncCas, { timeout: 10_000 }).toBe(1);
    await context.setOffline(true);
    await page.evaluate(() => (window as any).toggleTask(7003));
    boot.writeElsewhere((row) => ({ ...row, tasks: [task(7170, 'Added on the phone'), ...(row.tasks || [])] }));
    await page.waitForTimeout(3000);                          // the push timer fails while offline
    await context.setOffline(false);
    await expect.poll(() => boot.cloudTask(7003)?.done, { message: 'the offline tick never went up', timeout: 15_000 }).toBe(true);
    expect(boot.cloudTask(7170)?.name, 'the phone\'s task was written over').toBe('Added on the phone');
    await expect.poll(() => page.evaluate(() => (window as any).tasks.some((t: any) => t.id === 7170))).toBe(true);
  });

  test('an older Flux, still open in some tab, writes its stale list over the row: the task it never saw stays', async ({ page }) => {
    const boot = await bootSignedIn(page, { tasks: TASKS });
    await open(page);
    await expect.poll(() => (boot.state.cloud as any).syncCas, { timeout: 10_000 }).toBe(1);
    await page.evaluate(async (t) => {
      const w = window as any;
      w.tasks.unshift(t);
      w.save('tasks', w.tasks);
      await w.FluxSync.push();
    }, task(7160, 'Added here'));
    await expect.poll(() => boot.cloudTask(7160)?.name, { timeout: 10_000 }).toBe('Added here');
    // It never pulled task 7160, and writes without merging: no mark, no tombstones.
    boot.writeElsewhere(() => ({ tasks: TASKS, onboarded: true }));
    await page.evaluate(() => (window as any).FluxSync.pull());
    expect(await page.evaluate(() => (window as any).tasks.some((t: any) => t.id === 7160)), 'taken for deleted').toBe(true);
    await expect.poll(() => boot.cloudTask(7160)?.name, { message: 'not sent back up', timeout: 10_000 }).toBe('Added here');
  });

  test('a first pull that wrongly finds no row does not let this device replace the account\'s', async ({ page }) => {
    // PGRST116 also comes back when the session has lapsed and the read runs
    // without it. Taken for a new account, the first push replaced the row
    // with this device's lists — empty, on a new device.
    const boot = await bootSignedIn(page, { tasks: [], cloud: { tasks: TASKS, onboarded: true }, missingPulls: 1 });
    await page.goto('/');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await expect.poll(() => boot.state.missingPulls).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as any).tasks.length), { message: 'the account\'s tasks never arrived', timeout: 20_000 }).toBe(TASKS.length);
    await page.waitForTimeout(3000);
    expect((boot.state.cloud.tasks || []).length, 'the account\'s tasks were replaced').toBe(TASKS.length);
  });
});
