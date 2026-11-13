import { expect, test } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * A calendar day shows up to three tasks and two events. The "+N" under them
 * counts only what did not fit — three tasks and one event all show, so there
 * is no "+1" pointing at nothing.
 */

async function seedDay(page: import('@playwright/test').Page, nTasks: number, nEvents: number) {
  return page.evaluate(([nt, ne]) => {
    const w = window as any;
    const d = new Date();
    /* A day nothing else is on. A fixed "the 15th" collided with the
       scenario's homework, which is dated a few days from today, so the
       test failed for a few days every month. */
    const probe = (x: any) => String(x.name || x.title || '').startsWith('MoreProbe');
    const busy = new Set<string>([
      ...w.tasks.filter((t: any) => !probe(t)).map((t: any) => t.date),
      ...(w.load('flux_events', []) as any[]).filter((e) => !probe(e)).map((e) => e.date),
    ]);
    let iso = '';
    for (let day = 1; day <= 28 && !iso; day++) {
      const ds = w.fluxLocalYMD(new Date(d.getFullYear(), d.getMonth(), day));
      if (!busy.has(ds) && !(w.weeklyVirtualEventsForDate?.(ds) || []).length) iso = ds;
    }
    w.tasks = w.tasks.filter((t: any) => !String(t.name || '').startsWith('MoreProbe'));
    for (let i = 0; i < nt; i++) {
      w.tasks.push({ id: 900200 + i, name: 'MoreProbe ' + i, date: iso, type: 'hw', priority: 'med', done: false, createdAt: 1 });
    }
    w.save('tasks', w.tasks);
    const events = (w.load('flux_events', []) as any[]).filter((e) => !String(e.title || '').startsWith('MoreProbe'));
    for (let i = 0; i < ne; i++) events.push({ id: 'more-probe-' + i, title: 'MoreProbe event ' + i, date: iso });
    w.save('flux_events', events);
    w.nav('calendar');
    w.renderCalendar();
    return iso;
  }, [nTasks, nEvents]);
}

test('the "+N" on a calendar day counts only items that did not fit', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 950 });
  await gotoScenario(page, 'student-semester');
  await page.waitForTimeout(800);

  let iso = await seedDay(page, 3, 1);
  const day = () => page.locator(`#calGrid .cal-day[data-cal-date="${iso}"]`);
  await expect(day().locator('.cal-task-bar', { hasText: 'MoreProbe' })).toHaveCount(4);
  await expect(day().locator('.cal-day-count')).toHaveCount(0);

  iso = await seedDay(page, 5, 3);
  await expect(day().locator('.cal-task-bar', { hasText: 'MoreProbe' })).toHaveCount(5);
  await expect(day().locator('.cal-day-count')).toHaveText('+3');
});
