import { test, expect, devices, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Setting a due date reads the same everywhere (Azfer, 2026-09-29):
 *   · New task and Edit task carry the Today / Tomorrow / Clear buttons the
 *     "Change due date" box on a task card already had.
 *   · On a phone or tablet a tap on a date field opens the Flux calendar, not
 *     the phone's own date wheel. Safari opens that wheel when the field takes
 *     focus, so the proof here is that the tap never focuses the field.
 * And a task no longer offers to send you to Flux AI: no ✦ on the card, no
 * "Ask Flux AI" in its right-click or long-press menu.
 */

/** Today plus n days as YYYY-MM-DD, by the page's own clock. */
const dayFromNow = (page: Page, n: number) => page.evaluate((k) => {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
  const p = (x: number) => (x < 10 ? '0' : '') + x;
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}, n);

test.describe('Due dates in New task and Edit task', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoScenario(page, 'student-semester');
  });

  test('New task: Today, Tomorrow and Clear set the due date', async ({ page }) => {
    await page.evaluate(() => (window as any).openDashAddTaskModal());
    const field = page.locator('#taskDate');
    const quick = page.locator('#dashAddTaskModal .fdp-quick');
    await expect(quick.locator('button')).toHaveText(['Today', 'Tomorrow', 'Clear']);

    await quick.getByRole('button', { name: 'Tomorrow' }).click();
    await expect(field).toHaveValue(await dayFromNow(page, 1));
    await quick.getByRole('button', { name: 'Today' }).click();
    await expect(field).toHaveValue(await dayFromNow(page, 0));
    await quick.getByRole('button', { name: 'Clear' }).click();
    await expect(field).toHaveValue('');
    // Still the Flux calendar on a click, alongside the buttons.
    await field.click();
    await expect(page.locator('.fdp-pop')).toBeVisible();
  });

  test('Edit task: the same buttons, and Save keeps the date they set', async ({ page }) => {
    const id = await page.evaluate(() => (window as any).tasks.find((t: any) => !t.done).id);
    await page.evaluate((k) => (window as any).openEdit(k), id);
    const quick = page.locator('#editModal .fdp-quick');
    await expect(quick.locator('button')).toHaveText(['Today', 'Tomorrow', 'Clear']);
    await quick.getByRole('button', { name: 'Tomorrow' }).click();
    const tomorrow = await dayFromNow(page, 1);
    await expect(page.locator('#editDue')).toHaveValue(tomorrow);
    await page.evaluate(() => (window as any).saveEdit());
    const saved = await page.evaluate((k) => (window as any).tasks.find((t: any) => t.id === k).date, id);
    expect(saved).toBe(tomorrow);
    // Opening it again does not add a second row of buttons.
    await page.evaluate((k) => (window as any).openEdit(k), id);
    await expect(page.locator('#editModal .fdp-quick')).toHaveCount(1);
  });

  test('a task card has no ✦ button, and its menu has no Ask Flux AI', async ({ page }) => {
    const card = page.locator('.task-item').first();
    await expect(card).toBeVisible();
    await expect(page.locator('.task-action-btn--ai')).toHaveCount(0);
    await expect(card.locator('.task-actions')).not.toContainText('✦');
    await card.click({ button: 'right' });
    await page.waitForTimeout(300);
    const menuText = await page.evaluate(() => [...document.querySelectorAll('body *')]
      // getClientRects, not offsetParent: a fixed-position menu has no offsetParent.
      .filter((e) => /Duplicate/.test(e.textContent || '') && e.getClientRects().length > 0 && e.children.length > 2)
      .map((e) => e.textContent || '').sort((a, b) => a.length - b.length)[0] || '');
    expect(menuText, 'the task menu did not open').toMatch(/Duplicate/);
    expect(menuText).not.toMatch(/Flux AI|Ask AI/);
  });
});

test.describe('Due dates on a phone', () => {
  const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
  test.use(iphone);

  test('a tap on the date field opens the Flux calendar without focusing the field', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as any).openDashAddTaskModal());
    // The title first, as a student would, so a keyboard is up when the date is tapped.
    await page.locator('#taskName').tap();
    const field = page.locator('#taskDate');
    await field.scrollIntoViewIfNeeded();
    await field.tap();
    const pop = page.locator('.fdp-pop');
    await expect(pop).toBeVisible();
    // All of it on screen: a fixed popup below the fold cannot be scrolled to.
    const box = (await pop.boundingBox())!;
    const vh = await page.evaluate(() => window.innerHeight);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'the calendar runs off the bottom of the phone').toBeLessThanOrEqual(vh);
    const focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    expect(focus, "the field took focus, which is what opens the phone's own picker").not.toBe('taskDate');
    expect(focus, 'the title kept focus, so its keyboard would stay over the calendar').not.toBe('taskName');

    // Picking a day fills the field and still leaves it unfocused.
    await pop.locator('[data-fdp-today]').tap();
    await expect(pop).toHaveCount(0);
    await expect(field).toHaveValue(await dayFromNow(page, 0));
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('taskDate');

    // A tap again reopens it.
    await field.tap();
    await expect(pop).toBeVisible();
  });
});
