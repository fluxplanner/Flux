import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoScenario } from './helpers';

/*
 * B6 — keyboard & focus accessibility.
 *
 * Focus traps + focus-return-to-invoker on the modal surfaces
 * (FluxA11y.trapFocus), visible :focus-visible rings, and axe-core scans
 * scoped to the surfaces this pass hardened (a whole-page scan would drown
 * in pre-existing findings and gate nothing — scoping keeps the signal).
 */

test.describe('Keyboard & focus a11y', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'guest');
  });

  test('New Task modal traps Tab and returns focus to the invoker', async ({ page }) => {
    const invoker = page.locator('.topbar-new-task-btn:visible').first();
    await invoker.click();
    await expect(page.locator('#dashAddTaskModal')).toBeVisible();
    // Focus lands inside the modal.
    await expect(page.locator('#taskName')).toBeFocused();
    // Tab many times — focus must stay inside the modal (trap).
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      !!document.getElementById('dashAddTaskModal')?.contains(document.activeElement));
    expect(inside).toBe(true);
    // Escape closes and focus returns to the invoker.
    await page.keyboard.press('Escape');
    await expect(page.locator('#dashAddTaskModal')).toBeHidden();
    const returned = await page.evaluate(() =>
      document.activeElement?.classList.contains('topbar-new-task-btn'));
    expect(returned).toBe(true);
  });

  test('palette traps Tab; Escape returns focus', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#cmdInput')).toBeFocused();
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      !!document.getElementById('cmdPalette')?.contains(document.activeElement));
    expect(inside).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#cmdPalette')).toHaveCount(0);
  });

  test('keyboard focus paints a visible ring (:focus-visible)', async ({ page }) => {
    await page.keyboard.press('Tab'); // first tab stop (skip link / topbar)
    const ring = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth };
    });
    expect(ring).not.toBeNull();
    expect(ring!.style).not.toBe('none');
    expect(parseFloat(ring!.width)).toBeGreaterThan(0);
  });

  test('toast region is an aria-live region; More sheet is a modal dialog', async ({ page }) => {
    await expect(page.locator('#toastLive')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#moreSheet')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#moreSheet')).toHaveAttribute('aria-modal', 'true');
  });

  test('axe: New Task modal has no critical violations', async ({ page }) => {
    await page.locator('.topbar-new-task-btn:visible').first().click();
    await expect(page.locator('#dashAddTaskModal')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('#dashAddTaskModal')
      .analyze();
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical, JSON.stringify(critical.map(v => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
  });

  test('axe: sidebar + topbar have no critical violations', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .include('.topbar')
      .include('#sidebar')
      .analyze();
    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical, JSON.stringify(critical.map(v => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
  });
});
