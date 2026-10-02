import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Sign-up asks for the school and at least one class, and Canvas can fill in
 * both (Azfer, 2026-10-01: "check if canvas can see the school it's connected
 * to - if so require at login to find school and class info").
 *
 * Canvas has no school field for students; each course's Canvas account
 * usually carries the school's name, so the account most courses share is
 * taken as the school, with the Canvas address as a fallback. The Canvas
 * server is faked here: the address and token are test values only.
 */

const course = (id: number, name: string, account: string, teacher: string) =>
  ({ id, name, workflow_state: 'available', account: { id: 7, name: account }, teachers: [{ display_name: teacher }] });

async function atSchoolStep(page: Page, courses: unknown, status = 200) {
  await page.route('**/functions/v1/canvas-proxy', (route) => route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(courses),
  }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).showOnboarding(3));
  await expect(page.locator('#ob-step-3')).toBeVisible();
}
const findWithCanvas = async (page: Page) => {
  await page.locator('#obCanvasUrl').fill('lincoln.instructure.com');
  await page.locator('#obCanvasToken').fill('test-token');
  await page.locator('#obCanvasGo').click();
};

test.describe('Sign-up: school and classes', () => {
  test('Canvas finds the school and the classes, and the classes are waiting on the next step', async ({ page }) => {
    await atSchoolStep(page, [
      course(1, 'AP Biology', 'Lincoln High School', 'Ms. Rivera'),
      course(2, 'English 10', 'Lincoln High School', 'Mr. Okafor'),
      course(3, 'Spanish II', 'Riverside District', 'Sra. Diaz'),
    ]);
    await findWithCanvas(page);
    await expect(page.locator('#obCanvasStatus')).toContainText('Found Lincoln High School and 3 classes');
    await expect(page.locator('#obSchool')).toHaveValue('Lincoln High School');
    expect(await page.evaluate(() => [localStorage.getItem('flux_canvas_host'), JSON.parse(localStorage.getItem('flux_canvas_url') || '""')]))
      .toEqual(['"lincoln.instructure.com"', 'lincoln.instructure.com']);
    await page.locator('#ob-step-3 .ob-btn').click();
    await expect(page.locator('#ob-step-4')).toBeVisible();
    // Added to any classes already there (the test account has two).
    const rows = page.locator('#obExtractedClasses .ob-class-row');
    for (const [name, teacher] of [['AP Biology', 'Ms. Rivera'], ['English 10', 'Mr. Okafor'], ['Spanish II', 'Sra. Diaz']]) {
      await expect(rows.filter({ hasText: name })).toHaveCount(1);
      await expect(rows.filter({ hasText: name })).toContainText(teacher);
    }
    await page.locator('#ob-step-4 .ob-btn').click();
    await expect(page.locator('#ob-step-5')).toBeVisible();
  });

  test('a district-wide Canvas account falls back to the Canvas address, and says to check it', async ({ page }) => {
    await atSchoolStep(page, [course(1, 'Chemistry', 'Fairfax County Public Schools', 'Dr. Lee')]);
    await findWithCanvas(page);
    await expect(page.locator('#obSchool')).toHaveValue('LINCOLN');
    await expect(page.locator('#obCanvasStatus')).toContainText('Change the school name below');
  });

  test('a token Canvas refuses gets a plain message, and nothing is saved', async ({ page }) => {
    await atSchoolStep(page, { errors: [{ message: 'Invalid access token.' }] }, 401);
    await findWithCanvas(page);
    await expect(page.locator('#obCanvasStatus')).toContainText('didn’t accept that token');
    await expect(page.locator('#obCanvasStatus')).toHaveClass(/is-bad/);
    expect(await page.evaluate(() => localStorage.getItem('flux_canvas_host'))).toBeNull();
  });

  test('a student cannot go on without a school, or without a class', async ({ page }) => {
    await atSchoolStep(page, []);
    await page.locator('#obSchool').fill('');
    await page.locator('#ob-step-3 .ob-btn').click();
    await expect(page.locator('#ob-step-3')).toBeVisible();
    await expect(page.locator('#obSchoolNeed')).toContainText('Add your school');
    await page.locator('#obSchool').fill('Lincoln High School');
    await page.locator('#ob-step-3 .ob-btn').click();
    await expect(page.locator('#ob-step-4')).toBeVisible();
    await expect(page.locator('#ob-step-4 .ob-skip')).toBeHidden();
    // The test account comes with classes: take them off to start from none.
    while (await page.locator('#obExtractedClasses .ob-class-del').count()) await page.locator('#obExtractedClasses .ob-class-del').first().click();
    await page.locator('#ob-step-4 .ob-btn').click();
    await expect(page.locator('#ob-step-4')).toBeVisible();
    await expect(page.locator('#obClassesNeed')).toContainText('Add at least one class');
    await page.locator('#obManualName').fill('Algebra II');
    await page.locator('#ob-step-4 .btn-sec', { hasText: 'Add Class' }).click();
    await page.locator('#ob-step-4 .ob-btn').click();
    await expect(page.locator('#ob-step-5')).toBeVisible();
  });

  test('staff skip the Canvas card and may skip both steps', async ({ page }) => {
    await atSchoolStep(page, []);
    // Chosen on the first step, the way a teacher would.
    await page.evaluate(() => (window as any).showOnboarding(1));
    await page.locator('#obRoleChips .ob-chip', { hasText: 'Staff' }).click();
    await page.locator('#obName').fill('Ms. Park');
    await page.locator('#ob-step-1 .ob-btn').click();
    await expect(page.locator('#ob-step-2')).toBeVisible();
    await page.evaluate(() => (window as any).showOnboarding(3));
    await expect(page.locator('#ob-step-3 .ob-canvas')).toBeHidden();
    await page.locator('#obSchool').fill('');
    await page.locator('#ob-step-3 .ob-btn').click();
    await expect(page.locator('#ob-step-4')).toBeVisible();
    await page.locator('#ob-step-4 .ob-skip').click();
    await expect(page.locator('#ob-step-5')).toBeVisible();
  });
});
