import { test, expect } from '@playwright/test';

const SHOTS = process.env.TEACH_SHOTS || '';

test.describe('Flux Tutor · Learn', () => {
  test('library → subject → skill: method, worked example step by step, then a problem marked with its working', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/teacher.html');
    await page.getByRole('link', { name: 'Step-by-step lessons' }).click();
    await expect(page.locator('#ftScreenTitle')).toHaveText('Learn');
    await expect(page.locator('.ft-learn-subject')).toHaveCount(32);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/learn-home.png', fullPage: true });

    await page.locator('.ft-learn-subject', { hasText: 'Physics' }).click();
    await expect(page.locator('#ftScreenTitle')).toHaveText('Physics');
    await page.locator('.ft-learn-skill', { hasText: 'suvat' }).click();
    await expect(page.locator('.ft-learn-method li').first()).toBeVisible();

    // Worked example: one step at a time.
    await expect(page.locator('#ftLearnEx ~ .ft-learn-steps li, .ft-learn-card:nth-of-type(2) .ft-learn-steps li')).toHaveCount(1);
    await page.getByRole('button', { name: /Next step/ }).click();
    await page.getByRole('button', { name: 'Show every step' }).click();
    await expect(page.locator('.ft-learn-answer').first()).toBeVisible();

    // Your turn: answer it right using the state's own answer.
    const ans = await page.evaluate(() => (window as any).FluxTeach.answerText((window as any).FluxTeachUI._state().pr));
    await page.locator('#ftLearnIn').fill(ans.replace(/−/g, '-'));
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.ft-learn-fb')).toContainText('Right');
    await expect(page.locator('.ft-learn-hints')).toContainText('The working');
    if (SHOTS) await page.screenshot({ path: SHOTS + '/learn-skill.png', fullPage: true });

    // A wrong answer shows the working; hints show one step at a time.
    await page.getByRole('button', { name: 'Next problem' }).click();
    await page.getByRole('button', { name: /Hint/ }).click();
    await expect(page.locator('.ft-learn-hints li')).toHaveCount(1);
    await page.locator('#ftLearnIn').fill('123456789');
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.ft-learn-fb')).toContainText('Not this time');

    // Progress is saved and shown.
    await expect(page.locator('.ft-learn-mastery')).toContainText('1 right, 1 wrong');
    expect(errors).toEqual([]);
  });

  test('multiple choice and language skills work, and the syllabus links into lessons', async ({ page }) => {
    await page.goto('/teacher.html#learn/french-b/lang-fr-passeCompose');
    await expect(page.locator('#ftScreenTitle')).toContainText('passé composé');
    const ans = await page.evaluate(() => (window as any).FluxTeachUI._state().pr.answer);
    await page.locator('#ftLearnIn').fill(ans);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.locator('.ft-learn-fb')).toContainText('Right');

    await page.goto('/teacher.html#learn/tok/w-tok');
    await page.getByRole('button', { name: 'Concept, area or theme?' }).click();
    const right = await page.evaluate(() => (window as any).FluxTeachUI._state().pr.answer);
    await page.locator('.ft-learn-opt', { hasText: right }).first().click();
    await expect(page.locator('.ft-learn-fb')).toContainText('Right');

    await page.goto('/teacher.html');
    await page.locator('#ftSylSubject').selectOption('physics');
    await page.getByRole('link', { name: 'Lessons for Kinematics' }).click();
    await expect(page.locator('#ftScreenTitle')).toHaveText('Physics');
  });

  test('phone width: no sideways scroll on a skill page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/teacher.html#learn/math-aa/m-sinecos');
    await expect(page.locator('.ft-learn-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/learn-phone.png', fullPage: true });
  });
});
