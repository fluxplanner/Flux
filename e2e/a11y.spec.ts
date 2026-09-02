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

  test('a phone-sized switch is tappable well beyond the pill it paints', async ({ page }) => {
    /*
     * flux-touch-targets.css grows these switches to 44px with a transparent
     * ::before, because the pill itself is 36x20 and 20 is under WCAG 2.2
     * SC 2.5.8's 24px floor. That expander had never worked: both switches are
     * <button>s, and styles.css:596 gives every button overflow:hidden for the
     * ripple, which clipped the expander back to the pill.
     *
     * Asserting on CSS would not have caught it — ::before computed to exactly
     * the intended 60x44 the whole time. Only hit-testing shows the truth, so
     * this asks the browser what is really at the point a thumb would land.
     */
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('settings'));
    await page.waitForFunction(() => !!document.querySelector('#spane-appearance .tab-row-toggle'), null, {
      timeout: 10_000,
    });

    const hit = await page.evaluate(async () => {
      const el = document.querySelector<HTMLElement>('#spane-appearance .tab-row-toggle')!;
      el.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 350));
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const isSwitch = (dy: number) => document.elementFromPoint(cx, cy + dy) === el;
      return {
        painted: Math.round(r.height),
        centre: isSwitch(0),
        above: isSwitch(-18),
        below: isSwitch(18),
        // Bounded, not swallowing the whole row: neighbours sit 51px apart.
        wellAbove: isSwitch(-30),
      };
    });

    expect(hit.painted).toBeLessThan(24); // the pill really is that small…
    expect(hit.centre).toBe(true);
    expect(hit.above).toBe(true); // …but the target around it is not
    expect(hit.below).toBe(true);
    expect(hit.wellAbove).toBe(false);
  });
});
