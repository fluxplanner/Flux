import { expect, test } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Bugs found by clicking every button and filling every field in the planner.
 *
 * The id bugs share one cause. Tasks from quick-add, repeats and AI, and
 * classes imported from Canvas, get Date.now() + Math.random() as their id —
 * a fraction. parseInt threw the fraction away, so the id no longer matched
 * and the action silently did nothing. Seeded classes have string ids, which
 * an unquoted onclick="editClass(e2e-math)" turned into a ReferenceError.
 */

test.describe('planner sweep', () => {
  test('a class with a fractional id (a Canvas import) can be edited and saved', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => {
      const w = window as any;
      w.classes.push({ id: 1727291234567.123, period: 5, name: 'Canvas Physics', teacher: '', room: '', days: '', color: '#5865f2' });
      w.nav('school');
    });
    await page.waitForTimeout(800);
    const row = page.locator('#school .class-row', { hasText: 'Canvas Physics' });
    await row.locator('button[title="Edit"]').click();
    await expect(page.locator('#editClassModal')).toBeVisible();
    await page.locator('#ecName').fill('Canvas Physics HL');
    await page.locator('#editClassModal button', { hasText: 'Save' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).classes.find((c: any) => c.id === 1727291234567.123)?.name))
      .toBe('Canvas Physics HL');
  });

  test('a class with a string id opens its editor and deletes without an error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('school'));
    await page.waitForTimeout(800);
    const row = page.locator('#school .class-row', { hasText: 'Algebra II' });
    await row.locator('button[title="Edit"]').click();
    await expect(page.locator('#editClassModal')).toBeVisible();
    await expect(page.locator('#ecName')).toHaveValue('Algebra II');
    await page.locator('#editClassModal button', { hasText: 'Cancel' }).click();
    await row.locator('button[aria-label="Delete class"], button[title="Delete"]').first().click();
    await expect(page.locator('#school .class-row', { hasText: 'Algebra II' })).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('right-click → Complete works on a task with a fractional id', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => {
      const w = window as any;
      w.tasks.unshift({ id: 1727291234567.5, name: 'Quick-added task', date: '', subject: '', priority: 'med', done: false });
      w.renderTasks();
    });
    const item = page.locator('.task-item', { hasText: 'Quick-added task' }).first();
    await item.click({ button: 'right' });
    await expect(page.locator('#fluxTaskCtxMenu')).toBeVisible();
    await page.locator('#fluxTaskCtxMenu', { hasText: 'Complete' }).getByText('Complete').click();
    await expect.poll(() => page.evaluate(() => (window as any).tasks.find((t: any) => t.id === 1727291234567.5)?.done)).toBe(true);
  });

  test('the Pomodoro minutes are readable, not clipped to nothing', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('timer'));
    await page.waitForTimeout(800);
    for (const id of ['#customWork', '#customShort']) {
      const fit = await page.locator(id).evaluate((el: HTMLInputElement) => {
        const s = getComputedStyle(el);
        const room = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
        const c = document.createElement('canvas').getContext('2d')!;
        c.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        return { room, need: c.measureText(el.value).width, value: el.value };
      });
      expect(fit.value).not.toBe('');
      expect(fit.room, `${id} has ${fit.room}px for "${fit.value}", which needs ${fit.need}px`).toBeGreaterThanOrEqual(fit.need);
    }
  });

  test('Settings lights the accent you are actually using, and colour pickers show real colours', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('settings'));
    await page.waitForTimeout(900);
    const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase());
    const lit = await page.locator('#swatches .swatch.active').evaluateAll((els) => els.map((e) => e.getAttribute('onclick')));
    expect(lit, 'exactly one swatch, and it is the current accent').toHaveLength(1);
    expect(lit[0]!.toLowerCase()).toContain(accent);
    const bg = await page.locator('#cc-text').inputValue();
    expect(bg, 'the text colour picker should show the theme text colour, not black').not.toBe('#000000');
  });

  test('the Gratitude card has its icon, and Canvas no longer talks about Google', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).nav('mood'));
    await page.waitForTimeout(800);
    const icon = page.locator('#fluxGratitudeCard .fluxw-emoji');
    await expect.poll(() => icon.evaluate((e) => e.innerHTML.trim().length)).toBeGreaterThan(0);
    await page.evaluate(() => (window as any).nav('canvas'));
    await page.waitForTimeout(900);
    await expect(page.locator('#canvas')).not.toContainText('signed into Google');
  });
});
