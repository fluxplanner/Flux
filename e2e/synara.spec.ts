import { test, expect } from '@playwright/test';

/*
 * Synara (synara.html): medication, seizures and a school safety card for
 * students with epilepsy — its own app inside Flux, with its own look.
 *
 * Every tap here is a real click, which Playwright only lands if the target
 * is actually on top. That is deliberate: Synara once shipped with its closed
 * welcome screen still stretched invisibly over the page, and every check
 * that clicked from script passed while nobody could tap anything.
 */

async function withExampleData(page: import('@playwright/test').Page) {
  await page.goto('/synara.html');
  await page.getByRole('button', { name: 'Look around with example data' }).click();
  await expect(page.locator('#welcome')).toBeHidden();
}

test.describe('Synara', () => {
  test('asks first, then every tab answers a real click', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/synara.html');

    // Nothing is written until the student chooses.
    await expect(page.locator('#welcome')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('synara.v2'))).toBeNull();

    await page.getByRole('button', { name: 'Look around with example data' }).click();
    await expect(page.locator('#welcome')).toBeHidden();

    for (const route of ['meds', 'track', 'safety', 'you', 'home']) {
      await page.locator(`.tab[data-to="${route}"]`).click();
      await expect(page.locator(`.screen-inner[data-route="${route}"]`)).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('SOS opens the emergency card, with the timer, and Close gives the app back', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withExampleData(page);

    await page.locator('.sos-btn').click();
    const card = page.locator('#emergency[data-open="true"]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-action="timer-start"]')).toBeVisible();

    await card.locator('[data-action="close-emergency"]').first().click();
    await expect(page.locator('#emergency')).toBeHidden();
    // The page behind must take taps again, not just look as if it would.
    await page.locator('.tab[data-to="meds"]').click();
    await expect(page.locator('.screen-inner[data-route="meds"]')).toBeVisible();
  });

  test('#/sos lands straight on the emergency card', async ({ page }) => {
    await withExampleData(page);
    await page.goto('/synara.html#/sos');
    await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
  });

  test('the Flux switcher lives in its app bar, marks Synara, and survives re-renders', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await withExampleData(page);

    // Synara redraws its app bar on every change; the switcher is moved, not lost.
    await page.locator('.tab[data-to="safety"]').click();
    await page.locator('.tab[data-to="home"]').click();
    await expect(page.locator('#appbar .fxhub-btn')).toHaveCount(1);

    await page.locator('#appbar .fxhub-btn').click();
    await expect(page.locator('.fxhub-item.is-here .fxhub-item-name')).toHaveText('Synara');
    const b = await page.locator('.fxhub-panel').boundingBox();
    expect(b!.x + b!.width).toBeLessThanOrEqual(1280);

    await page.keyboard.press('Escape');
    await expect(page.locator('.fxhub-panel')).toBeHidden();
  });

  test('on a phone the switcher menu stays on screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await withExampleData(page);
    await page.locator('#appbar .fxhub-btn').click();
    const b = (await page.locator('.fxhub-panel').boundingBox())!;
    expect(b.x, 'menu runs off the left edge').toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, 'menu runs off the right edge').toBeLessThanOrEqual(375);
    await page.locator('.fxhub-panel a', { hasText: 'Flux Grapher' }).click();
    await expect(page).toHaveURL(/grapher/);
  });

  test('keeps its own violet even when the planner theme is carried', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/hub.html');
    await page.evaluate(() => {
      localStorage.setItem('flux_theme', '"ember"');
      localStorage.setItem('flux_accent', '"#f97316"');
      localStorage.setItem('flux_accent_rgb', '"249,115,22"');
      localStorage.setItem('sb-test-auth-token', '{"x":1}');
    });
    await withExampleData(page);
    const brand = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim());
    expect(brand.toLowerCase()).toBe('#7c4dff');
  });

  test('the hub lists it beside the planner, in its own colour', async ({ page }) => {
    await page.goto('/hub.html');
    const hrefs = await page.locator('#apps .app').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.slice(0, 2), 'Synara should sit next to the planner at the top').toEqual(['index.html', 'synara.html']);
    const card = page.locator('#apps a.app--synara');
    await expect(card).toHaveAttribute('href', 'synara.html');
    await expect(card.locator('.app-name')).toHaveText('Synara');
    await card.click();
    await expect(page.locator('#welcome')).toBeVisible();
  });
});
