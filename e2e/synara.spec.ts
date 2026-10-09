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
  test('opening the planner for the first time keeps Synara\'s data', async ({ page }) => {
    // A student who used Synara first, then opens the planner on the same device:
    // the planner's first-run cleanup used to drop every key not starting with flux_.
    await withExampleData(page);
    const before = await page.evaluate(() => localStorage.getItem('synara.v2'));
    expect(before).toBeTruthy();
    await page.evaluate(() => localStorage.removeItem('flux_data_version'));
    await page.goto('/?e2e=1&scenario=student-semester');
    await expect(page.locator('#app')).toHaveClass(/visible/);
    expect(await page.evaluate(() => localStorage.getItem('synara.v2'))).toBe(before);
    // Clearing planner data leaves it too.
    await page.evaluate(() => (window as any).fluxClearLocalStorageKeepingApps());
    expect(await page.evaluate(() => localStorage.getItem('synara.v2'))).toBe(before);
  });

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

  test('the intro asks about epilepsy, shares a fact, then hands over the sections', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/synara.html');
    const welcome = page.locator('#welcome');

    await page.getByRole('button', { name: 'Set it up for me' }).click();
    await expect(welcome.getByRole('heading', { name: 'First, a little about you' })).toBeVisible();
    // Backing out at the questions still leaves nothing saved.
    expect(await page.evaluate(() => localStorage.getItem('synara.v2'))).toBeNull();

    await page.getByLabel('What should we call you?').fill('Riley Ellison');
    await welcome.getByRole('button', { name: /^Absence/ }).click();
    await welcome.getByRole('button', { name: /^Focal impaired awareness/ }).click();
    await expect(welcome.getByRole('button', { name: /^Absence/ })).toHaveAttribute('aria-pressed', 'true');

    // A typo in the year is caught, and nothing moves on.
    await page.getByLabel('What year were you diagnosed?').fill('21');
    await welcome.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('#intro-year-error')).toContainText('Enter a year');
    await page.getByLabel('What year were you diagnosed?').fill('2021');
    await welcome.getByRole('button', { name: 'Continue' }).click();

    // A fact, with its source, and another on request.
    await expect(welcome.getByRole('heading', { name: 'You’re not alone, Riley' })).toBeVisible();
    await expect(welcome.locator('.intro-fact figcaption')).toContainText('Source:');
    const first = await welcome.locator('.intro-fact-t').textContent();
    await welcome.getByRole('button', { name: 'Another fact' }).click();
    await expect(welcome.locator('.intro-fact-t')).not.toHaveText(first!);

    // The answers went into the real record.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('synara.v2')!).profile);
    expect(saved).toMatchObject({ name: 'Riley Ellison', seizureType: 'Absence, Focal impaired awareness', diagnosed: '2021' });

    // Back keeps the answers.
    await welcome.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByLabel('What should we call you?')).toHaveValue('Riley Ellison');
    await welcome.getByRole('button', { name: 'Continue' }).click();
    await welcome.getByRole('button', { name: 'Continue' }).click();

    // The sections: tapping one leaves the intro and opens its editor.
    await expect(welcome.getByRole('heading', { name: 'Now, fill in your sections' })).toBeVisible();
    await welcome.getByRole('button', { name: /What your seizures look like/ }).click();
    await expect(welcome).toBeHidden();
    await page.locator('#card-text').fill('I stare and don’t answer for about 30 seconds.');
    await page.locator('.sheet [data-action="card-save"]').click();

    // Home keeps the list until it's done, and ticks off what is.
    const card = page.locator('.setup-card');
    await expect(card).toBeVisible();
    await expect(card.locator('.setup-h')).toHaveText(/^1 of \d sections done$/);
    await expect(card.locator('.setup-row[data-done="true"]')).toHaveText(/What your seizures look like/);
    await card.getByRole('button', { name: 'Hide this list' }).click();
    await expect(page.locator('.setup-card')).toHaveCount(0);
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

  test('says it is powered by Flux, with the Flux logo, but never on the emergency card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto('/synara.html');
    const welcomeBadge = page.locator('#welcome .powered-by');
    await expect(welcomeBadge).toBeVisible();
    await expect(welcomeBadge).toHaveAttribute('href', /fluxplanner\.github\.io\/Flux/);
    // The logo path differs inside Flux; a broken image would still be "visible".
    expect(await welcomeBadge.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Look around with example data' }).click();
    await expect(page.locator('.sidebar-powered')).toBeVisible();
    await page.locator('.sos-btn').click();
    await expect(page.locator('#emergency[data-open="true"]')).toBeVisible();
    await expect(page.locator('#emergency .powered-by')).toHaveCount(0);
  });

  test('the page itself never scrolls past the app', async ({ page }) => {
    // A hidden file input on You once stretched the page, and a scroll wheel
    // could carry the whole window off into blank space.
    await page.setViewportSize({ width: 1280, height: 760 });
    await withExampleData(page);
    for (const route of ['home', 'meds', 'track', 'safety', 'you']) {
      await page.locator(`.tab[data-to="${route}"]`).click();
      const extra = await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight);
      expect(extra, `#/${route} makes the page taller than the window`).toBeLessThanOrEqual(0);
    }
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
    await expect(page.locator('.fxhub-item.is-here .fxhub-item-name')).toHaveText(/^Synara/);
    await expect(page.locator('.fxhub-item.is-here .fxhub-partner')).toHaveText('Partner');
    await expect(page.locator('.fxhub-item--synara .fxhub-item-mark--logo svg')).toBeVisible();
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
    await expect(card.locator('.app-name')).toHaveText(/^Synara/);
    // Set apart from the other apps: its own logo tile and a violet gradient frame.
    await expect(card.locator('.app-icon--logo svg')).toBeVisible();
    expect(await card.evaluate((a) => getComputedStyle(a, '::before').backgroundImage)).toContain('linear-gradient');
    await expect(page.locator('#apps .app-icon--logo'), 'only Synara wears its own logo').toHaveCount(1);
    await card.click();
    await expect(page.locator('#welcome')).toBeVisible();
  });
});
