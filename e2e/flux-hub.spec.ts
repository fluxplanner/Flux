import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The Flux Hub — the switcher between Flux products.
 *
 * It mounts in two documents that share almost nothing: the planner, with its
 * bundles and 150-odd stylesheets, and grapher.html, which loads neither. So
 * these run in both rather than trusting one to stand for the other.
 *
 * The geometry assertions are the point. A DOM-only check passed happily while
 * the panel hung 139px off the right of a 1280 viewport, because "is it in the
 * DOM and not hidden" cannot see that. The grapher puts the button at the right
 * of its header and the planner at the left, so the panel has to anchor
 * differently in each — exactly the kind of thing that regresses silently.
 */

const panelBox = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const p = document.querySelector('.fxhub-panel:not([hidden])') as HTMLElement;
  const q = p.getBoundingClientRect();
  return { left: Math.round(q.left), right: Math.round(q.right), vw: document.documentElement.clientWidth };
});

test.describe('Flux Hub', () => {
  test('the standalone grapher offers the switcher and marks itself', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/grapher.html');
    await page.waitForTimeout(900);

    const btn = page.locator('.fxhub-btn:visible');
    await expect(btn, 'no hub button in the grapher').toBeVisible();
    await btn.click();
    await page.waitForTimeout(250);

    const items = await page.evaluate(() =>
      [...document.querySelectorAll('.fxhub-item')].map((a) => ({
        name: a.querySelector('.fxhub-item-name')?.textContent?.trim() || '',
        here: a.classList.contains('is-here'),
      })));
    expect(items.length, 'the switcher lists no products').toBeGreaterThan(1);
    // It marks where you already are rather than offering it as somewhere to go.
    const here = items.find((i) => i.here);
    expect(here?.name, 'the grapher does not mark itself as the current app').toMatch(/Grapher/);

    const b = await panelBox(page);
    expect(b.right, `panel runs off the right edge (${b.right} > ${b.vw})`).toBeLessThanOrEqual(b.vw);
    expect(b.left, 'panel runs off the left edge').toBeGreaterThanOrEqual(0);
  });

  test('Escape closes it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/grapher.html');
    await page.waitForTimeout(900);
    await page.locator('.fxhub-btn:visible').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.fxhub-panel').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('.fxhub-panel').first()).toBeHidden();
  });

  test('the planner offers it too, marks itself, and keeps the panel on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 950 });
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);

    const btn = page.locator('.fxhub-btn:visible');
    await expect(btn, 'no hub button in the planner').toBeVisible();
    await btn.click();
    await page.waitForTimeout(250);

    const here = await page.evaluate(() =>
      document.querySelector('.fxhub-item.is-here .fxhub-item-name')?.textContent?.trim() || '');
    expect(here, 'the planner does not mark itself as the current app').toMatch(/Planner/);

    const b = await panelBox(page);
    expect(b.right).toBeLessThanOrEqual(b.vw);
    expect(b.left).toBeGreaterThanOrEqual(0);
  });

  test('it fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/grapher.html');
    await page.waitForTimeout(900);
    await page.locator('.fxhub-btn:visible').click();
    await page.waitForTimeout(250);
    const b = await panelBox(page);
    expect(b.right, 'the panel spills off a phone screen').toBeLessThanOrEqual(b.vw);
    expect(b.left).toBeGreaterThanOrEqual(0);
  });
  test('the planner on a phone has the switcher too, and it reaches the grapher', async ({ page }) => {
    /* The desktop switcher sits in a top-bar cluster that is hidden below
       768px, so on a phone the grapher had no way in from the planner. */
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoScenario(page, 'student-semester');
    await page.waitForTimeout(2200);
    const btn = page.locator('.fxhub-btn:visible');
    await expect(btn, 'no switcher in the phone header').toHaveCount(1);
    await btn.click();
    await page.waitForTimeout(250);
    const grapher = page.locator('.fxhub-panel:not([hidden]) a', { hasText: 'Flux Grapher' });
    await expect(grapher).toBeVisible();
    await expect(grapher).toHaveAttribute('href', /grapher/);
    const b = await panelBox(page);
    expect(b.right, 'the panel spills off the phone screen').toBeLessThanOrEqual(b.vw);
    expect(b.left).toBeGreaterThanOrEqual(0);
  });
});
