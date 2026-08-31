import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Random student picker.
 *
 * The promise is fairness, so that is what these pin. "Skip the last three"
 * was the old rule and it is not fair in a class of thirty — the same student
 * can still be called three times in five minutes, in front of everybody. A
 * full rotation is the only version worth having: everyone once before anyone
 * twice.
 *
 * The other half is that names come from the teacher's own timetable, typed or
 * pasted. It used to read only the join-code roster table, so it worked solely
 * for classes where the students had all signed up for Flux themselves — which
 * in a real room is almost none of them.
 */

const picker = '[data-widget-id="classroom_student_picker"]';

async function gotoPicker(page: import('@playwright/test').Page) {
  await gotoScenario(page, 'teacher-workflow');
  await expect
    .poll(() => page.evaluate(() => (window as any).FluxRole?.isWorkMode?.() === true), { timeout: 15_000 })
    .toBe(true);
  await page.evaluate(() => (window as any).save('flux_student_picker_state_v1', {}));
  await page.evaluate(() => (window as any).nav('teacherDashboard'));
  await expect(page.locator(picker)).toBeVisible({ timeout: 15_000 });
}

async function saveNames(page: import('@playwright/test').Page, names: string[]) {
  await page.click(`${picker} #fluxPickerEdit`);
  await page.fill(`${picker} #fluxPickerNames`, names.join('\n'));
  await page.click(`${picker} #fluxPickerSave`);
}

test.describe('Random student picker', () => {
  test('offers the classes you teach, and asks for names before it will pick', async ({ page }) => {
    await gotoPicker(page);

    const opts = await page.locator(`${picker} #fluxPickerClass option`).allTextContents();
    expect(opts).toEqual(['A2 · E2E World History', 'A3 · E2E American Lit']);
    // Nothing to pick from yet, so the button must not pretend otherwise.
    await expect(page.locator(`${picker} #fluxPickerSpin`)).toBeDisabled();
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('No names for this class yet');
  });

  test('names are typed or pasted, one per line, and stick to the class', async ({ page }) => {
    await gotoPicker(page);
    await saveNames(page, ['Aiden', 'Maya', 'Jordan', ' Sam ']);

    const stored = await page.evaluate(() => (window as any).FluxTeacherClasses.list()[0].students);
    // Trimmed, blanks dropped — a pasted spreadsheet column is rarely tidy.
    expect(stored).toEqual(['Aiden', 'Maya', 'Jordan', 'Sam']);
    await expect(page.locator(`${picker} #fluxPickerSpin`)).toBeEnabled();
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('4 names · 0 called this round');
  });

  test('everyone is called once before anyone is called twice', async ({ page }) => {
    await gotoPicker(page);
    const names = ['Aiden', 'Maya', 'Jordan', 'Sam', 'Priya'];
    await saveNames(page, names);

    const picks: string[] = [];
    for (let i = 0; i < names.length; i++) {
      await page.click(`${picker} #fluxPickerSpin`);
      picks.push((await page.locator(`${picker} .flux-picker-name`).textContent()) || '');
    }
    // The whole point: a full round is every name exactly once.
    expect([...picks].sort()).toEqual([...names].sort());
    expect(new Set(picks).size).toBe(names.length);

    // The next pick starts a fresh round and says so.
    await page.click(`${picker} #fluxPickerSpin`);
    await expect(page.locator(`${picker} .flux-picker-meta`)).toHaveText('Everyone has had a turn — new round');
    const rounds = await page.evaluate(() => (window as any).load('flux_student_picker_state_v1', {}).rounds);
    expect(Object.values(rounds)[0]).toHaveLength(1);
  });

  test('"New round" clears the rotation without touching the names', async ({ page }) => {
    await gotoPicker(page);
    await saveNames(page, ['Aiden', 'Maya', 'Jordan']);
    await page.click(`${picker} #fluxPickerSpin`);
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('1 called this round');

    await page.click(`${picker} #fluxPickerReset`);
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('3 names · 0 called this round');
    expect(await page.evaluate(() => (window as any).FluxTeacherClasses.list()[0].students)).toHaveLength(3);
  });

  test('removing a name drops it from the round rather than blocking a slot', async ({ page }) => {
    await gotoPicker(page);
    await saveNames(page, ['Aiden', 'Maya', 'Jordan']);
    await page.click(`${picker} #fluxPickerSpin`);
    await page.click(`${picker} #fluxPickerSpin`);
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('2 called this round');

    // A student leaves the class. Their name must not keep occupying a place in
    // the rotation, or the round could never complete.
    await saveNames(page, ['Aiden']);
    const res = await page.evaluate(() => ({
      names: (window as any).FluxTeacherClasses.list()[0].students,
      rounds: (window as any).load('flux_student_picker_state_v1', {}).rounds,
    }));
    expect(res.names).toEqual(['Aiden']);
    expect((Object.values(res.rounds)[0] as string[]).every((n) => n === 'Aiden')).toBe(true);
  });

  test('each class keeps its own rotation', async ({ page }) => {
    await gotoPicker(page);
    await saveNames(page, ['Aiden', 'Maya']);
    await page.click(`${picker} #fluxPickerSpin`);

    await page.selectOption(`${picker} #fluxPickerClass`, { index: 1 });
    // A different class starts clean — picking in one must not spend the other.
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('No names for this class yet');
    await saveNames(page, ['Rosa', 'Tom']);
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('2 names · 0 called this round');

    await page.selectOption(`${picker} #fluxPickerClass`, { index: 0 });
    await expect(page.locator(`${picker} .flux-widget-hint`)).toContainText('2 names · 1 called this round');
  });

  test('a pasted name cannot inject markup', async ({ page }) => {
    await gotoPicker(page);
    await saveNames(page, ['<img src=x onerror="window.__pwned=1">']);
    await page.click(`${picker} #fluxPickerSpin`);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    expect(await page.locator(`${picker} img`).count()).toBe(0);
    await expect(page.locator(`${picker} .flux-picker-name`)).toContainText('<img');
  });

  test('no card on the staff dashboard is badged BETA', async ({ page }) => {
    await gotoPicker(page);
    // Every module in the registry is status:'beta', so stamping the status on
    // each card put BETA on all of them at once — which reads as an unfinished
    // product rather than a useful warning.
    await expect(page.locator('#teacherDashboardBody .flux-widget-cell__badge')).toHaveCount(0);
    await expect(page.locator('#teacherDashboardBody .flux-widget-cell')).not.toHaveCount(0);
  });
});
