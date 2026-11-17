import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

/**
 * Flux Suite (suite.html): the directory is written into the page at build
 * time (scripts/build-suite.mjs) and only redrawn when the apps this viewer
 * may see differ. These pin the fixes from the 2026-11 suite audit.
 */

const DATA = JSON.parse(readFileSync('public/data/products.json', 'utf8'));
const HUB_CSS = readFileSync('public/css/flux-hub.css', 'utf8') + readFileSync('suite.html', 'utf8');

async function hide(page: Page, ids: string[]) {
  await page.route('**/rest/v1/rpc/flux_my_permissions', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  await page.route('**/rest/v1/flux_hidden_apps**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(ids.map((app_id) => ({ app_id }))),
  }));
  await page.addInitScript(() => { (window as unknown as { __FLUX_APP_VIS_TEST: boolean }).__FLUX_APP_VIS_TEST = true; });
}

test('paints within 400ms on a cold visit', async ({ page }) => {
  // The production list never answers: nothing may wait for it.
  await page.route('**/rest/v1/**', () => { /* hang */ });
  await page.addInitScript(() => { (window as unknown as { __FLUX_APP_VIS_TEST: boolean }).__FLUX_APP_VIS_TEST = true; });
  await page.goto('/suite.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.style.visibility)).not.toBe('hidden');
  await expect(page.locator('.app--grapher')).toBeVisible();
});

test('every visible product has a card, a colour pair and a blurb', async ({ page }) => {
  await page.goto('/suite.html');
  for (const p of DATA.products.filter((x: { ownerOnly?: boolean }) => !x.ownerOnly)) {
    await expect(page.locator(`#apps .app--${p.id}`), p.id).toHaveCount(1);
    expect(p.blurb, `${p.id} blurb`).toBeTruthy();
    expect(HUB_CSS.includes(`.app--${p.id} {`) || HUB_CSS.includes(`.app--${p.id}{`), `${p.id} colour pair`).toBe(true);
  }
});

test('hiding a partner keeps the partners strip and its link', async ({ page }) => {
  await hide(page, ['synara']);
  await page.goto('/suite.html#partners');
  await expect(page.locator('.app--aorta')).toBeVisible();
  await expect(page.locator('#partnersStrip')).toBeVisible();
  // partners.html is about Synara, so its link goes with it; the strip stays.
  await hide(page, ['synara', 'aorta']);
  await page.goto('/suite.html');
  await expect(page.locator('#tab-partner')).toHaveCount(0);
  await expect(page.locator('#partnersStrip')).toHaveCount(1);
});

test('hiding every study app renders one plain grid', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const tabApps = DATA.products.filter((p: { group: string }) => p.group !== 'planner').map((p: { id: string }) => p.id);
  await hide(page, tabApps);
  await page.goto('/suite.html');
  await expect(page.locator('.app--planner')).toBeVisible();
  await expect(page.locator('[role="tablist"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the grid is not rebuilt when visibility does not change', async ({ page }) => {
  await page.goto('/suite.html');
  await page.evaluate(() => { (document.querySelector('.app--grapher') as HTMLElement & { _mark?: number })._mark = 1; });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('flux-app-visibility')));
  expect(await page.evaluate(() => (document.querySelector('.app--grapher') as HTMLElement & { _mark?: number })._mark)).toBe(1);
});

test('switcher shows each product logo and frame', async ({ page }) => {
  await page.goto('/grapher.html');
  await page.locator('.fxhub-more').first().click();
  await expect(page.locator('.fxhub-item--synara .fxhub-item-mark svg')).toBeVisible();
  await expect(page.locator('.fxhub-item--aorta .fxhub-item-mark img')).toBeVisible();
  const bg = await page.locator('.fxhub-item--synara .fxhub-item-mark').evaluate((n) => getComputedStyle(n).backgroundImage);
  expect(bg).toContain('gradient');
});

test('graph/ links stay in the app when installed', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
  await page.goto('/suite.html');
  await page.evaluate(() => {
    const a = document.createElement('a'); a.href = 'graph/'; a.target = '_blank'; a.id = 't'; a.textContent = 'g';
    document.body.appendChild(a);
  });
  const popup = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
  await page.click('#t');
  expect(await popup).toBeNull();
  await expect(page).toHaveURL(/graph\/?/);
});

for (const theme of ['dark', 'light'] as const) {
  test(`axe clean, 390px, ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (theme === 'light') await page.addInitScript(() => localStorage.setItem('flux_theme', 'light'));
    await page.goto('/suite.html');
    if (theme === 'light') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['color-contrast']).analyze();
    expect(r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id)).toEqual([]);
  });
}

test('skip link comes first and tabs are keyboard reachable', async ({ page }) => {
  await page.goto('/suite.html');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.locator('#tab-study').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-partner')).toHaveAttribute('aria-selected', 'true');
});
