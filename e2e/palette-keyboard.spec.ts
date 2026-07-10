import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * P0 A3 — command-palette / quick-add keyboard chaos.
 *
 * Live bug: ⌘K opened the palette without focus (three modules bound ⌘K and
 * stacked palettes); typing "notes" let the leading "n" fire the global
 * quick-add shortcut ON TOP, the rest ("otes") landed in quick-add, and Enter
 * silently created a junk task "otes".
 *
 * Fixes under test: single ⌘K owner, guaranteed palette focus, FluxOverlays
 * stack (single-key suppression + Escape pops top only), Enter gated to the
 * top overlay, ⌘K toggle.
 */

test.describe('Palette & quick-add keyboard handling', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'guest');
  });

  test('exact junk-task repro: ⌘K → "notes" → Enter creates NO task', async ({ page }) => {
    const tasksBefore = await page.evaluate(() => (window as any).tasks.length);

    await page.keyboard.press('ControlOrMeta+k');
    // Exactly one palette, input focused.
    await expect(page.locator('#cmdPalette')).toHaveCount(1);
    await expect(page.locator('#fluxCmdPalette')).toHaveCount(0);
    await expect(page.locator('#fluxSkillPalette')).toHaveCount(0);
    await expect(page.locator('#cmdInput')).toBeFocused();

    await page.keyboard.type('notes');
    // Quick-add must NOT have opened on top.
    await expect(page.locator('#quickAddPanel')).not.toHaveClass(/open/);
    await page.keyboard.press('Enter');

    // Navigates to Notes…
    await expect(page.locator('#notes.panel.active')).toBeVisible();
    // …and created no junk task.
    const tasksAfter = await page.evaluate(() => (window as any).tasks.length);
    expect(tasksAfter).toBe(tasksBefore);
    const junk = await page.evaluate(() =>
      (window as any).tasks.some((t: any) => /^otes$|^notes$/i.test(t.name)));
    expect(junk).toBe(false);
  });

  test('N opens quick-add only when no overlay is open', async ({ page }) => {
    // No overlay: N opens quick-add.
    await page.keyboard.press('n');
    await expect(page.locator('#quickAddPanel')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#quickAddPanel')).not.toHaveClass(/open/);

    // Palette open: N must be suppressed even if focus was stolen.
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#cmdInput')).toBeFocused();
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('n');
    await expect(page.locator('#quickAddPanel')).not.toHaveClass(/open/);
  });

  test('Escape closes only the top overlay', async ({ page }) => {
    // Stack: quick-add below, palette on top.
    await page.keyboard.press('n');
    await expect(page.locator('#quickAddPanel')).toHaveClass(/open/);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#cmdPalette')).toHaveCount(1);

    await page.keyboard.press('Escape');
    // Palette (top) gone, quick-add still open.
    await expect(page.locator('#cmdPalette')).toHaveCount(0);
    await expect(page.locator('#quickAddPanel')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#quickAddPanel')).not.toHaveClass(/open/);
  });

  test('⌘K toggles the palette closed', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#cmdPalette')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('#cmdPalette')).toHaveCount(0);
  });

  test('Enter in quick-add still creates a task when quick-add is top', async ({ page }) => {
    const before = await page.evaluate(() => (window as any).tasks.length);
    await page.keyboard.press('n');
    await expect(page.locator('#quickAddInput')).toBeFocused();
    await page.keyboard.type('read chapter 4');
    await page.keyboard.press('Enter');
    const after = await page.evaluate(() => (window as any).tasks.length);
    expect(after).toBe(before + 1);
  });
});
