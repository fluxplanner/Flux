import { test, expect } from '@playwright/test';

/**
 * The grapher's two halves, and the chrome that is meant to be gone.
 *
 * It used to open on a headline and three sentences explaining what it was —
 * fine for a landing page, wrong for a tool you are already inside. The plot
 * gets the screen now, and the only chrome left is a thin bar with the mark,
 * the mode switch and the Flux hub.
 *
 * Functions and measurements are genuinely different jobs: typing y = x² to
 * see its shape has nothing in common with plotting eleven readings and their
 * error bars. These pin that both halves work, and that neither let the
 * explanation creep back in and eat the plot.
 *
 * No sign-in helper — grapher.html has no account, which is the point of it.
 */

test.describe('Flux Grapher', () => {
  test('the prose is gone and the plot gets the screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/grapher.html');
    await page.waitForTimeout(900);

    const body = await page.evaluate(() => document.body.innerText);
    for (const phrase of ['Plot your practical', 'Free forever', 'Built because', 'Part of']) {
      expect(body, `"${phrase}" is still on the page`).not.toContain(phrase);
    }

    const geo = await page.evaluate(() => {
      const host = document.getElementById('grapherHost')!;
      return {
        hostH: host.getBoundingClientRect().height,
        vh: window.innerHeight,
        pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
      };
    });
    // Measured at 93%; 85 leaves room for a taller header without being brittle.
    expect(geo.hostH / geo.vh, 'the tool is not getting most of the screen').toBeGreaterThan(0.85);
    /* The page itself must never scroll — the tool scrolls inside it. Otherwise
       a growing data table pushes the plot off the bottom, which is the whole
       thing this layout exists to prevent. */
    expect(geo.pageScrolls, 'the page scrolls, so the plot can be pushed off').toBe(false);

    // The one piece of branding that stays.
    await expect(page.locator('.brand-mark')).toBeVisible();
  });

  test('measurements mode is the default and has its table', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/grapher.html');
    await page.waitForTimeout(900);
    await expect(page.locator('#modeData')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.flg-table')).toBeVisible();
  });

  test('functions mode plots what you type, and says why when it cannot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/grapher.html');
    await page.waitForTimeout(900);

    await page.locator('#modeFunctions').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#modeFunctions')).toHaveAttribute('aria-selected', 'true');
    // A curve, not merely an empty frame.
    expect(await page.locator('.flg-fnchart polyline').count()).toBeGreaterThan(0);

    const box = page.locator('.flg-fnsrc').first();
    await box.fill('sin(x)*3');
    await page.waitForTimeout(350);
    expect(await page.locator('.flg-fnchart polyline').count(),
      'a valid expression drew nothing').toBeGreaterThan(0);

    /* A half-typed expression is the normal state of a box being typed into,
       so it has to explain itself rather than silently blank the graph. */
    await box.fill('sin(');
    await page.waitForTimeout(350);
    await expect(page.locator('.flg-fnerr')).toBeVisible();
  });

  test('the chosen mode survives a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/grapher.html');
    await page.waitForTimeout(900);
    await page.locator('#modeFunctions').click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForTimeout(900);
    await expect(page.locator('#modeFunctions'),
      'it forgot which half you were using').toHaveAttribute('aria-selected', 'true');
  });
});
