import { test, expect } from '@playwright/test';
import { bootSignedIn, type BootTask } from './helpers';

const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const TASKS: BootTask[] = Array.from({ length: 4 }, (_, i) => ({
  id: 7000 + i, name: `Boot task ${i}`, date: day(i + 1), priority: 'med', type: 'hw',
  done: false, subtasks: [], createdAt: 1_700_000_000_000 + i,
}));
const H1 = { id: 'h1', name: 'Water', icon: '💧', streak: 0, log: {} };
const EV1 = { id: 'e1', title: 'Dentist', date: day(2), time: '10:00' };

async function open(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.locator('#app')).toHaveClass(/visible/);
  await expect(page.locator('#fluxRoleSkeletonOverlay')).toHaveCount(0, { timeout: 15_000 });
}

test('a habit added while Claude had just written the row survives', async ({ page }) => {
  const boot = await bootSignedIn(page, {
    tasks: TASKS,
    cloud: { tasks: TASKS, onboarded: true, habits: [H1] },
    extraLocal: { flux_habits: [H1] },
  });
  await open(page);
  // This tab's first push has landed (the row now carries the mark).
  await expect.poll(() => (boot.state.cloud as any).accent !== undefined, { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(500);
  const missed0 = boot.state.missed;
  // Claude (mcp mutateTasks): conditional write, spreads the rest of the row.
  boot.writeElsewhere((row) => ({ ...row, tasks: [{ id: 7190, name: 'From Claude', done: false, subtasks: [], createdAt: Date.now() }, ...(row.tasks || [])] }));
  // A second later, before this tab's next 8s pull, the student adds a habit here.
  await page.evaluate(() => {
    const w = window as any;
    w.setFluxHabits([...(w.getFluxHabits() || []), { id: 'h2', name: 'Read 20 min', icon: '📖', streak: 0, log: {} }]);
  });
  await page.waitForTimeout(5000);
  console.log('claude task in cloud:', boot.cloudTask(7190)?.name);
  const here = await page.evaluate(() => ((window as any).getFluxHabits() || []).map((h: any) => h.id));
  const cloud = ((boot.state.cloud as any).habits || []).map((h: any) => h.id);
  expect({ here, cloud }).toEqual({ here: ['h1', 'h2'], cloud: ['h1', 'h2'] });
});

test('a calendar event added while another device had just written the row survives', async ({ page }) => {
  const boot = await bootSignedIn(page, {
    tasks: TASKS,
    cloud: { tasks: TASKS, onboarded: true, events: [EV1] },
    extraLocal: { flux_events: [EV1] },
  });
  await open(page);
  await expect.poll(() => (boot.state.cloud as any).accent !== undefined, { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(500);
  // The phone ticks a task (a new-Flux write: merged first, keeps the mark).
  boot.writeElsewhere((row) => ({ ...row, tasks: (row.tasks || []).map((t) => (t.id === 7001 ? { ...t, done: true, updatedAt: Date.now() } : t)) }));
  await page.evaluate((ev) => {
    const w = window as any;
    const list = w.load('flux_events', []);
    list.push(ev);
    w.save('flux_events', list);
    w.syncKey('events', list);
  }, { id: 'e2', title: 'Maths test', date: day(3), time: '09:00' });
  await page.waitForTimeout(5000);
  console.log('phone tick in cloud:', boot.cloudTask(7001)?.done);
  const here = await page.evaluate(() => ((window as any).load('flux_events', []) || []).map((e: any) => e.id));
  const cloud = ((boot.state.cloud as any).events || []).map((e: any) => e.id);
  expect({ here, cloud }).toEqual({ here: ['e1', 'e2'], cloud: ['e1', 'e2'] });
});

test('back online, habits logged offline survive a task ticked on the phone meanwhile', async ({ page, context }) => {
  const boot = await bootSignedIn(page, {
    tasks: TASKS,
    cloud: { tasks: TASKS, onboarded: true, habits: [H1] },
    extraLocal: { flux_habits: [H1] },
  });
  await open(page);
  await expect.poll(() => (boot.state.cloud as any).accent !== undefined, { timeout: 15_000 }).toBe(true);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.evaluate(() => {
    const w = window as any;
    w.setFluxHabits([...(w.getFluxHabits() || []), { id: 'h3', name: 'Stretch', icon: '🧘', streak: 0, log: {} }]);
  });
  boot.writeElsewhere((row) => ({ ...row, tasks: (row.tasks || []).map((t) => (t.id === 7003 ? { ...t, done: true, updatedAt: Date.now() } : t)) }));
  await page.waitForTimeout(3000);
  await context.setOffline(false);
  await page.waitForTimeout(6000);
  console.log('phone tick in cloud:', boot.cloudTask(7003)?.done);
  const here = await page.evaluate(() => ((window as any).getFluxHabits() || []).map((h: any) => h.id));
  const cloud = ((boot.state.cloud as any).habits || []).map((h: any) => h.id);
  console.log('F1c here:', here, 'cloud:', cloud);
  expect({ here, cloud }).toEqual({ here: ['h1', 'h3'], cloud: ['h1', 'h3'] });
});
