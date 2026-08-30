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
