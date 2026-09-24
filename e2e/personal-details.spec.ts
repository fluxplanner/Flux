import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Locker, combination, counselor and student ID belong to you, not the school.
 *
 * They lived in School Info behind a collapsed card — a tab you open to look at
 * your classes — so personal details you might need in a hurry sat two
 * navigations and a disclosure triangle away. They are in Profile now, under
 * Profile Info.
 *
 * The markup moved unchanged: saveSchoolInfo() and toggleReveal() find these
 * inputs by id, so the move costs them nothing. That is exactly why this saves
 * through the form rather than only looking for the fields — an id lookup that
 * silently resolved to nothing would still leave a tidy-looking card.
 *
 * The schedule/PDF importer that sat directly beneath went at the same time.
 * Only its card: bindScheduleImportDropzones() is shared with the onboarding
 * importer and null-guards its elements.
 */

test.describe('Personal details', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 950 });
    await gotoScenario(page, 'student-semester');
  });

  test('the locker card is in Profile, not School Info, and still saves', async ({ page }) => {
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('school'));
    await page.waitForTimeout(700);
    await expect(page.locator('#school #schoolInfoCard'),
      'the locker card is still in School Info').toHaveCount(0);

    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('profile'));
    await page.waitForTimeout(700);
    await expect(page.locator('#profile #schoolInfoCard'),
      'the locker card did not arrive in Profile').toHaveCount(1);

    const saved = await page.evaluate(async () => {
      const w = window as any;
      (document.querySelector('#profile #schoolInfoCard') as HTMLDetailsElement).open = true;
      (document.getElementById('inputLocker') as HTMLInputElement).value = '342';
      (document.getElementById('inputStudentID') as HTMLInputElement).value = '123456';
      (document.getElementById('inputCounselor') as HTMLInputElement).value = 'Ms. Probe';
      w.saveSchoolInfo();
      await new Promise((r) => setTimeout(r, 250));
      return w.load('flux_school', {});
    });

    // Saving from the new home has to reach the same store it always did.
    expect(saved.locker).toBe('342');
    expect(saved.studentID).toBe('123456');
    expect(saved.counselor).toBe('Ms. Probe');
  });

  test('the schedule importer is gone, and nothing errors without it', async ({ page }) => {
    const errs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('school'));
    await page.waitForTimeout(900);

    await expect(page.locator('.flux-pdf-import-card-host'),
      'the schedule importer card is still there').toHaveCount(0);
    /* The shared dropzone wiring still runs and still looks for ids that no
       longer exist. It guards for that — this is what proves the guard holds. */
    expect(errs, `console errors after removing the importer:\n${errs.join('\n')}`).toEqual([]);
  });
});
