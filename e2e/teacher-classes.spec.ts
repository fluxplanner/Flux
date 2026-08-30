import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The classes a member of staff TEACHES, on the IA A/B period system.
 *
 * Two invariants carry most of the risk here.
 *
 * 1. It must stay OFF the student key. flux_classes drives GPA, subject
 *    budgets, the task subject picker and the AI planner's context. A teacher's
 *    list is the same shape with the opposite meaning, so if the two ever share
 *    storage, anyone who is both a student and a teacher gets "American Lit,
 *    period A1" silently folded into their grade average. That is the kind of
 *    bug nobody reports because the number just looks slightly wrong.
 *
 * 2. Period parsing is BORROWED, not reimplemented. parseClassPeriodInput is
 *    what the student form, the PDF schedule import and onboarding all use. A
 *    second parser would drift the first time the school changed its format,
 *    so the test pins the shared behaviour rather than a local copy of it.
 */

async function gotoTeacherSchool(page: import('@playwright/test').Page) {
  await gotoScenario(page, 'teacher-workflow');
  // The harness settles the role asynchronously; School Info only renders the
  // teacher variant once FluxRole reports Work mode.
  await expect
    .poll(() => page.evaluate(() => (window as any).FluxRole?.isWorkMode?.() === true), {
      timeout: 15_000,
    })
    .toBe(true);
  await page.evaluate(() => (window as any).save('flux_teacher_classes', []));
  await page.evaluate(() => (window as any).nav('school'));
  await expect(page.locator('#fluxTeacherClasses')).toBeVisible({ timeout: 15_000 });
}

/** Fill the add row and submit it, the way a teacher would. */
async function addClass(
  page: import('@playwright/test').Page,
  fields: { period: string; name: string; room?: string; start?: string; end?: string },
) {
  await page.fill('#ftcPeriod', fields.period);
  await page.fill('#ftcName', fields.name);
  if (fields.room) await page.fill('#ftcRoom', fields.room);
  if (fields.start) await page.fill('#ftcStart', fields.start);
  if (fields.end) await page.fill('#ftcEnd', fields.end);
  await page.click('#fluxTeacherClasses [data-ftc="class-add"]');
}

test.describe('Teacher class schedule', () => {
  test('adds classes on the A/B period system and reads them back in order', async ({ page }) => {
    await gotoTeacherSchool(page);

    // Deliberately out of order: the list should sort itself.
    await addClass(page, { period: 'B3', name: 'World History', room: '118' });
    await addClass(page, { period: 'A1', name: 'American Lit', room: '204', start: '08:15', end: '09:05' });

    const stored = await page.evaluate(() => (window as any).FluxTeacherClasses.list());
    expect(stored.map((c: any) => c.periodLabel)).toEqual(['A1', 'B3']);
    // "A1" must become period 1 on A Day — the shared parser's contract.
    expect(stored[0]).toMatchObject({ period: 1, days: 'A Day', name: 'American Lit', room: '204' });
    expect(stored[1]).toMatchObject({ period: 3, days: 'B Day', name: 'World History' });

    // The badge is what a teacher actually reads down the left of the card.
    const badges = await page.locator('#fluxTeacherClasses .ftc-badge').allTextContents();
    expect(badges).toEqual(['A1', 'B3']);
    await expect(page.locator('#fluxTeacherClasses .ftc-class-name').first()).toHaveText('American Lit');
    // Room and time are collapsed into one meta line rather than three chips.
    await expect(page.locator('#fluxTeacherClasses .ftc-class-meta').first()).toHaveText(
      'Room 204 · 08:15–09:05',
    );
  });

  test('never writes to the student class list', async ({ page }) => {
    await gotoTeacherSchool(page);
    const before = await page.evaluate(() => (window as any).load('flux_classes', []));

    await addClass(page, { period: 'A2', name: 'American Lit' });

    const after = await page.evaluate(() => ({
      students: (window as any).load('flux_classes', []),
      teachers: (window as any).load('flux_teacher_classes', []),
    }));
    // The whole reason for a separate key: a teacher's timetable must never
    // reach the list that feeds GPA.
    expect(after.students).toEqual(before);
    expect(after.teachers).toHaveLength(1);
    expect(after.teachers[0].name).toBe('American Lit');
  });

  test('a class carries its own assigned work and events', async ({ page }) => {
    await gotoTeacherSchool(page);
    await addClass(page, { period: 'A1', name: 'American Lit' });

    const id = await page.evaluate(() => (window as any).FluxTeacherClasses.list()[0].id);
    await page.click(`#fluxTeacherClasses [data-ftc="toggle"][data-id="${id}"]`);

    await page.fill(`#ftcWorkTitle-${id}`, 'Essay 2 draft');
    await page.fill(`#ftcWorkDue-${id}`, '2026-09-05');
    await page.click(`#fluxTeacherClasses [data-ftc="work-add"][data-id="${id}"]`);

    await page.selectOption(`#ftcWorkType-${id}`, 'event');
    await page.fill(`#ftcWorkTitle-${id}`, 'Museum field trip');
    await page.fill(`#ftcWorkDue-${id}`, '2026-09-12');
    await page.click(`#fluxTeacherClasses [data-ftc="work-add"][data-id="${id}"]`);

    const work = await page.evaluate(() => (window as any).FluxTeacherClasses.list()[0].work);
    expect(work).toHaveLength(2);
    // Assignments and events are distinguishable — an assembly is not a thing
    // to grade, and the card colours them differently on that basis.
    expect(work.map((w: any) => w.type)).toEqual(['assignment', 'event']);
    expect(work.map((w: any) => w.title)).toEqual(['Essay 2 draft', 'Museum field trip']);
    // Soonest first.
    expect(work.map((w: any) => w.due)).toEqual(['2026-09-05', '2026-09-12']);

    // Ticking one through the UI persists, and does not disturb the other.
    await page.click(`#fluxTeacherClasses .ftc-check[data-wid="${work[0].id}"]`);
    const after = await page.evaluate(() => (window as any).load('flux_teacher_classes', [])[0].work);
    expect(after[0].done).toBe(true);
    expect(after[1].done).toBe(false);
  });

  test('undated work sinks below dated work instead of sorting as year zero', async ({ page }) => {
    await gotoTeacherSchool(page);
    await addClass(page, { period: 'A1', name: 'American Lit' });
    const id = await page.evaluate(() => (window as any).FluxTeacherClasses.list()[0].id);
    await page.click(`#fluxTeacherClasses [data-ftc="toggle"][data-id="${id}"]`);

    // Added first, with no date. A naive comparator puts '' before any real
    // date, which would bury the thing that is actually due tomorrow.
    await page.fill(`#ftcWorkTitle-${id}`, 'Reading, no deadline');
    await page.click(`#fluxTeacherClasses [data-ftc="work-add"][data-id="${id}"]`);
    await page.fill(`#ftcWorkTitle-${id}`, 'Essay 2 draft');
    await page.fill(`#ftcWorkDue-${id}`, '2026-09-05');
    await page.click(`#fluxTeacherClasses [data-ftc="work-add"][data-id="${id}"]`);

    const titles = await page.evaluate(() =>
      (window as any).FluxTeacherClasses.list()[0].work.map((w: any) => w.title),
    );
    expect(titles).toEqual(['Essay 2 draft', 'Reading, no deadline']);
  });

  test('deleting a class says how much work goes with it', async ({ page }) => {
    await gotoTeacherSchool(page);
    await page.evaluate(() =>
      (window as any).FluxTeacherClasses._set([
        {
          id: 1,
          period: 1,
          periodLabel: 'A1',
          days: 'A Day',
          name: 'American Lit',
          color: '#3b82f6',
          work: [
            { id: 'w1', type: 'assignment', title: 'Essay 2', due: '2026-09-05', done: false },
            { id: 'w2', type: 'event', title: 'Field trip', due: '', done: false },
          ],
        },
      ]),
    );

    // Losing two pieces of work to a single × is worth a sentence, not a
    // surprise — so the count is named in the prompt.
    const messages: string[] = [];
    page.on('dialog', (d) => {
      messages.push(d.message());
      d.dismiss();
    });
    await page.click('#fluxTeacherClasses [data-ftc="class-del"][data-id="1"]');
    expect(messages[0]).toBe('Delete American Lit and its 2 items of work?');
    // Dismissing must keep it.
    expect(await page.evaluate(() => (window as any).FluxTeacherClasses.list())).toHaveLength(1);
  });

  test('survives a reload and applies a cloud payload', async ({ page }) => {
    await gotoTeacherSchool(page);
    await addClass(page, { period: 'A1', name: 'American Lit', room: '204' });

    await page.reload();
    await expect(page.locator('#app')).toHaveClass(/visible/);
    await page.evaluate(() => (window as any).nav('school'));
    await expect(page.locator('#fluxTeacherClasses .ftc-class-name')).toHaveText('American Lit');

    // A second device pushing its own list must replace, render and persist.
    await page.evaluate(() =>
      (window as any).FluxTeacherClasses.applyFromCloud([
        { id: 9, period: 4, periodLabel: 'B4', days: 'B Day', name: 'Physics', color: '#10d9a0', work: [] },
      ]),
    );
    await expect(page.locator('#fluxTeacherClasses .ftc-class-name')).toHaveText('Physics');
    expect(await page.evaluate(() => (window as any).load('flux_teacher_classes', []))).toHaveLength(1);
    // And the slice it would send back is the same list.
    expect(
      await page.evaluate(() => (window as any).FluxTeacherClasses.getCloudSlice()[0].name),
    ).toBe('Physics');
  });

  test('a class with no name is refused', async ({ page }) => {
    await gotoTeacherSchool(page);
    await addClass(page, { period: 'A1', name: '   ' });
    expect(await page.evaluate(() => (window as any).FluxTeacherClasses.list())).toHaveLength(0);
    await expect(page.locator('#fluxTeacherClasses .ftc-empty')).toBeVisible();
  });
});

/*
 * The staff surfaces that were reading the wrong list.
 *
 * Before a teacher timetable existed, the Lesson Hub and the FluxNow strip
 * both read window.classes — the classes you ATTEND. For a teacher that is
 * normally empty, so the Lesson Hub rendered "No classes yet" directly beneath
 * its own empty state telling you to add the periods you teach in School Info,
 * and the dashboard counted 0 of everything. These pin the fix: staff read the
 * timetable they teach, students are unaffected, and Personal mode still means
 * "me, the person".
 */
test.describe('Staff surfaces read the timetable they teach', () => {
  /** Two classes around a fixed clock time, one in session and one later. */
  async function seedTeachingDay(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
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

  test('FluxNow names the class a teacher is teaching, not one they attend', async ({ page }) => {
    await gotoTeacherSchool(page);
    await seedTeachingDay(page);

    const res = await page.evaluate(() => {
      const w = window as any;
      // resolveNow weekend-gates on the real clock, so pin a weekday. The
      // class times are wall-clock, so the same hour on a Monday still lands
      // mid-period and the suite passes whichever day it runs.
      const d = new Date();
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
      return {
        r: w.FluxNow.resolveLive(d),
        studentNames: (w.classes || []).map((c: any) => c.name),
      };
    });

    expect(res.r.state).toBe('period');
    expect(res.r.cls.name).toBe('World History');
    expect(res.r.next.name).toBe('American Lit');
    expect(res.r.sentence).toContain('World History');
    // The student list is non-empty in this scenario, so naming a class from
    // the teaching list is only meaningful if it is not also a student one.
    expect(res.studentNames.length).toBeGreaterThan(0);
    expect(res.studentNames).not.toContain('World History');
  });

  test('the Lesson Hub lists what you teach, with attendance to take', async ({ page }) => {
    await gotoTeacherSchool(page);
    await seedTeachingDay(page);
    await page.evaluate(() => (window as any).nav('lessonHub'));

    const cards = page.locator('#lessonHubBody .lh-class-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.first().locator('.lh-class-name')).toHaveText('World History');
    // The empty state that used to show under a filled-in timetable.
    await expect(page.locator('#lessonHubBody .lh-empty')).toHaveCount(0);
    // Attendance is the thing a teacher comes here to do.
    await expect(cards.first().locator('.lh-att-mini')).toHaveText('No attendance');
    await cards.first().locator('.lh-att-btn[data-att="present"]').click();
    await expect(page.locator('#lessonHubBody .lh-class-card').first().locator('.lh-att-mini'))
      .toHaveText('All present');
  });

  test('only the classes that meet today are listed', async ({ page }) => {
    await gotoTeacherSchool(page);
    // Same period number on opposite cycle days. Rendering both on one day is
    // what made them share a lesson-state key and overwrite each other.
    await page.evaluate(() => {
      (window as any).save('flux_cycle_config', {
        enabled: true, pattern: ['A', 'B'], anchorDate: '2026-08-31', skipWeekends: true,
      });
      (window as any).FluxTeacherClasses._set([
        { id: 1, period: 1, periodLabel: 'A1', days: 'A Day', name: 'American Lit', color: '#3b82f6', work: [] },
        { id: 2, period: 1, periodLabel: 'B1', days: 'B Day', name: 'World History', color: '#f43f5e', work: [] },
      ]);
    });

    const res = await page.evaluate(() => {
      const w = window as any;
      const label = w.FluxNow.cycleToday();
      const today = w.FluxNow.classesForDay(w.FluxTeacherClasses.mine(), label);
      return { label, names: today.map((c: any) => c.name) };
    });

    // Whatever today's letter is, exactly one of the two period-1 classes runs.
    if (res.label) {
      expect(res.names).toHaveLength(1);
      expect(res.names[0]).toBe(res.label === 'A' ? 'American Lit' : 'World History');
    } else {
      // Weekend or no cycle: A/B classes are not scheduled at all.
      expect(res.names).toHaveLength(0);
    }
  });

  test('Personal mode gives an educator their own student list back', async ({ page }) => {
    await gotoTeacherSchool(page);
    await seedTeachingDay(page);
    expect(await page.evaluate(() => (window as any).FluxTeacherClasses.mine()?.length)).toBe(2);

    // Off the clock, a teacher is a person using a planner.
    const mine = await page.evaluate(() => {
      const w = window as any;
      w.FluxRole.setMode ? w.FluxRole.setMode('personal') : (w.FluxRole.mode = 'personal');
      return w.FluxTeacherClasses.mine();
    });
    expect(mine).toBeNull();
  });

  test('a student is untouched by any of this', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(() => {
      const w = window as any;
      return { mine: w.FluxTeacherClasses.mine(), studentCount: (w.classes || []).length };
    });
    // mine() must refuse for anyone who is not staff, so resolveLive falls
    // through to the student list exactly as it always did.
    expect(res.mine).toBeNull();
    expect(res.studentCount).toBeGreaterThan(0);
  });
});
