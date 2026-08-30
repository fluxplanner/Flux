import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The bar at the top of the staff dashboard, and the attendance reminder.
 *
 * The reminder is the delicate half. Two failures matter more than the feature
 * itself:
 *
 *  - Nagging. It must go quiet once attendance is taken, and stay quiet for a
 *    class the teacher waved away. Something that reappears every twenty
 *    seconds mid-lesson is worse than nothing at all.
 *
 *  - Lying. It must never suggest a register was taken because a prompt was
 *    dismissed. "Done" is read from the Lesson Hub's own store, never from this
 *    module's snooze list, and the two are asserted to be independent.
 *
 * The suite runs on whatever day it happens to be and resolveNow gates on the
 * real clock, so anything about a live period stubs the resolver rather than
 * hoping the calendar cooperates.
 */

async function gotoStaffDashboard(page: import('@playwright/test').Page) {
  await gotoScenario(page, 'teacher-workflow');
  await expect
    .poll(() => page.evaluate(() => (window as any).FluxRole?.isWorkMode?.() === true), { timeout: 15_000 })
    .toBe(true);
  await page.evaluate(() => {
    (window as any).save('flux_lesson_state_v1', {});
    (window as any).save('flux_staff_now_v1', {});
  });
  await page.evaluate(() => (window as any).nav('teacherDashboard'));
  await expect(page.locator('#fluxStaffNow')).toBeAttached({ timeout: 15_000 });
}

/** Two classes on the clock: one in session, one after it. */
async function seedTeachingDay(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const p = (n: number) => (n < 10 ? '0' : '') + n;
    const now = new Date();
    const hm = (d: Date) => p(d.getHours()) + ':' + p(d.getMinutes());
    (window as any).FluxTeacherClasses._set([
      {
        id: 101, period: 2, periodLabel: 'A2', days: '', name: 'World History', room: '118',
        timeStart: hm(new Date(now.getTime() - 10 * 60000)),
        timeEnd: hm(new Date(now.getTime() + 30 * 60000)),
        color: '#f43f5e', work: [],
      },
      {
        id: 102, period: 3, periodLabel: 'A3', days: '', name: 'American Lit', room: '204',
        timeStart: hm(new Date(now.getTime() + 40 * 60000)),
        timeEnd: hm(new Date(now.getTime() + 90 * 60000)),
        color: '#3b82f6', work: [],
      },
    ]);
  });
}

/** Force the "mid-lesson" view regardless of the real date. */
async function pinToLesson(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const w = window as any;
    const cls = w.FluxTeacherClasses.list();
    w.FluxNow.resolveLive = () => ({
      state: 'period', cls: cls[0], next: cls[1], minutesLeft: 22, sentence: '',
    });
    w.FluxStaffNow.render();
  });
}

test.describe('Staff now bar', () => {
  test('names the class in session, the minutes left, and what is next', async ({ page }) => {
    await gotoStaffDashboard(page);
    await seedTeachingDay(page);
    await pinToLesson(page);

    const bar = page.locator('#fluxStaffNow');
    await expect(bar).toHaveAttribute('data-state', 'period');
    await expect(bar.locator('.fsn-badge')).toHaveText('A2');
    await expect(bar.locator('.fsn-now-name')).toHaveText('World History');
    await expect(bar.locator('.fsn-room')).toHaveText('Rm 118');
    await expect(bar.locator('.fsn-left')).toHaveText('22 min left');
    await expect(bar.locator('.fsn-next')).toHaveText('Next · American Lit · Rm 204');
    // It leads the dashboard — the whole point of "rebuild around today".
    expect(await page.evaluate(() => {
      const el = document.getElementById('fluxStaffNow')!;
      return el.parentElement!.firstElementChild === el;
    })).toBe(true);
  });

  test('a teacher with no timetable is told where to make one', async ({ page }) => {
    await gotoStaffDashboard(page);
    await page.evaluate(() => (window as any).FluxTeacherClasses._set([]));
    await page.evaluate(() => (window as any).FluxStaffNow.render());

    const bar = page.locator('#fluxStaffNow');
    await expect(bar).toHaveAttribute('data-state', 'empty');
    // A blank strip would just look broken; this has to name the destination.
    await expect(bar).toContainText('School Info');
    await expect(bar.locator('a')).toHaveAttribute('href', /school/);
  });

  test('asks for attendance once a lesson is running', async ({ page }) => {
    await gotoStaffDashboard(page);
    await seedTeachingDay(page);
    await pinToLesson(page);

    const nudge = page.locator('#fluxStaffNow .fsn-nudge');
    await expect(nudge).toBeVisible();
    await expect(nudge).toContainText('Take attendance for');
    await expect(nudge).toContainText('World History');
    await expect(nudge.locator('[data-fsn="attend"]')).toBeVisible();
  });

  test('"Not now" silences that class for the day but keeps the bar', async ({ page }) => {
    await gotoStaffDashboard(page);
    await seedTeachingDay(page);
    await pinToLesson(page);

    await page.click('#fluxStaffNow [data-fsn="snooze"]');
    await expect(page.locator('#fluxStaffNow .fsn-nudge')).toHaveCount(0);
    // Dismissing the reminder must not take the timetable with it.
    await expect(page.locator('#fluxStaffNow .fsn-now-name')).toHaveText('World History');

    // Still silent on a re-render — otherwise it returns on the next 20s tick.
    await page.evaluate(() => (window as any).FluxStaffNow.render());
    await expect(page.locator('#fluxStaffNow .fsn-nudge')).toHaveCount(0);

    // A dismissal is NOT a register. This is the lie the feature must not tell.
    const taken = await page.evaluate(() => (window as any).FluxStaffNow._attendanceTaken(2));
    expect(taken).toBe(false);
  });

  test("yesterday's dismissal does not silence today", async ({ page }) => {
    await gotoStaffDashboard(page);
    const res = await page.evaluate(() => {
      const w = window as any;
      w.save('flux_staff_now_v1', { date: '2020-01-01', snoozed: [2] });
      const stale = w.FluxStaffNow._isSnoozed(2);
      w.FluxStaffNow._snooze(2);
      return { stale, fresh: w.FluxStaffNow._isSnoozed(2), state: w.FluxStaffNow._snoozeState() };
    });
    // A snooze list that outlived its day would mute the reminder for good.
    expect(res.stale).toBe(false);
    expect(res.fresh).toBe(true);
    expect(res.state.snoozed).toEqual([2]);
  });

  test('taking the register in the Lesson Hub settles the reminder', async ({ page }) => {
    await gotoStaffDashboard(page);
    await seedTeachingDay(page);
    await pinToLesson(page);
    await expect(page.locator('#fluxStaffNow .fsn-nudge:not(.is-done)')).toBeVisible();

    // Exactly what the Lesson Hub writes when you mark a class present.
    await page.evaluate(() => {
      const w = window as any;
      const p = (n: number) => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const today = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      const st = w.load('flux_lesson_state_v1', {});
      st[today + '__P2'] = { notes: '', attendance: 'All present', materials: [] };
      w.save('flux_lesson_state_v1', st);
      w.FluxStaffNow.render();
    });

    const done = page.locator('#fluxStaffNow .fsn-nudge.is-done');
    await expect(done).toContainText('Attendance taken for World History');
    // Nothing left to press — the reminder is a statement now, not a task.
    await expect(page.locator('#fluxStaffNow [data-fsn="attend"]')).toHaveCount(0);
    await expect(page.locator('#fluxStaffNow [data-fsn="snooze"]')).toHaveCount(0);
  });

  test('no reminder outside a lesson', async ({ page }) => {
    await gotoStaffDashboard(page);
    await seedTeachingDay(page);
    await page.evaluate(() => {
      const w = window as any;
      const cls = w.FluxTeacherClasses.list();
      w.FluxNow.resolveLive = () => ({ state: 'passing', next: cls[1], minutesUntil: 8, sentence: '' });
      w.FluxStaffNow.render();
    });

    const bar = page.locator('#fluxStaffNow');
    await expect(bar).toHaveAttribute('data-state', 'passing');
    await expect(bar.locator('.fsn-now-name')).toHaveText('American Lit');
    await expect(bar.locator('.fsn-left')).toHaveText('in 8 min');
    // Between lessons there is no register to take.
    await expect(bar.locator('.fsn-nudge')).toHaveCount(0);
  });

  test('a class name cannot inject markup', async ({ page }) => {
    await gotoStaffDashboard(page);
    await page.evaluate(() => {
      (window as any).FluxTeacherClasses._set([{
        id: 1, period: 2, periodLabel: 'A2', days: '',
        name: '<img src=x onerror="window.__pwned=1">', room: '118',
        timeStart: '08:00', timeEnd: '23:59', color: '#f43f5e', work: [],
      }]);
    });
    await pinToLesson(page);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    expect(await page.locator('#fluxStaffNow img').count()).toBe(0);
    await expect(page.locator('#fluxStaffNow .fsn-now-name')).toContainText('<img');
  });
});
