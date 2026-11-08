import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The owner can hide any app from everyone else (table flux_hidden_apps,
 * public/js/flux-app-visibility.js). Nobody may
 * find a hidden app through a tile, a link or its address, and the owner must
 * still be able to open it and test it.
 *
 * The gate stays off the production list on localhost, so these tests opt in
 * and answer the list request themselves. The row-level security that stops
 * anyone else changing the list is checked against the database.
 */

const OWNER_UID = 'eabe2b1f-e428-4181-8530-8e5366eb3975';
const SESSION_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';

type Answer = string[] | 'unreachable';

async function setup(page: Page, answer: Answer, opts: { uid?: string; cached?: string[]; synara?: unknown; perms?: string[] } = {}) {
  /* Roles: what flux_my_permissions() says this account may see. */
  await page.route('**/rest/v1/rpc/flux_my_permissions', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    body: JSON.stringify(opts.perms || []),
  }));
  await page.route('**/rest/v1/flux_hidden_apps**', (route) => {
    if (answer === 'unreachable') return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      body: JSON.stringify(answer.map((app_id) => ({ app_id }))),
    });
  });
  await page.addInitScript(([key, o]) => {
    (window as unknown as { __FLUX_APP_VIS_TEST: boolean }).__FLUX_APP_VIS_TEST = true;
    const { uid, cached, synara } = o as { uid?: string; cached?: string[]; synara?: unknown };
    if (uid) localStorage.setItem(key as string, JSON.stringify({ access_token: 't', user: { id: uid } }));
    if (cached) localStorage.setItem('flux_hidden_apps_v1', JSON.stringify(cached));
    if (synara) localStorage.setItem('synara.v2', JSON.stringify(synara));
  }, [SESSION_KEY, opts] as const);
}

test.describe('someone other than the owner', () => {
  test('sees no trace of a hidden app in Flux Suite', async ({ page }) => {
    // Every partner app hidden, as Aorta is in production, so the Partners tab goes too.
    await setup(page, ['synara', 'aorta']);
    await page.goto('/suite.html#partners');
    await expect(page.locator('.app--grapher')).toBeVisible();
    await expect(page.locator('.app--synara')).toHaveCount(0);
    await expect(page.locator('#tab-partner')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('Synara');
    await expect(page.locator('a[href="partners.html"]:visible')).toHaveCount(0);
  });

  for (const path of ['synara.html', 'synara-welcome.html', 'partners.html']) {
    test(`is sent to Flux Suite from ${path}`, async ({ page }) => {
      await setup(page, ['synara']);
      await page.goto('/' + path);
      await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
      await expect(page.locator('.app--grapher')).toBeVisible();
    });
  }

  test('hides any app, not only Synara, with its links and copy', async ({ page }) => {
    await setup(page, ['grapher']);
    await page.goto('/landing.html');
    await page.waitForFunction(() => document.getElementById('fluxHiddenApps')?.textContent !== '');
    await expect(page.locator('.card', { hasText: 'Flux Grapher' })).toBeHidden();
    await page.goto('/grapher.html');
    await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
    await expect(page.locator('.app--grapher')).toHaveCount(0);
    await expect(page.locator('.app--pixel')).toHaveCount(1);
  });

  test('loses the app from a device that already had the old list', async ({ page }) => {
    await setup(page, ['pixel'], { cached: [] });
    await page.goto('/pixel.html');
    await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
  });

  test('gets the app back as soon as it is shown again, with no bounce from the old list', async ({ page }) => {
    await setup(page, [], { cached: ['synara'] });
    await page.goto('/synara.html');
    await expect(page.locator('#screen')).toBeVisible();
    await expect(page).toHaveURL(/\/synara(\.html)?$/);
  });

  test('keeps an app open when the list cannot be reached and nothing was ever known', async ({ page }) => {
    await setup(page, 'unreachable');
    await page.goto('/grapher.html');
    await expect(page).toHaveURL(/\/grapher(\.html)?$/);
    await expect(page.locator('html')).not.toHaveCSS('visibility', 'hidden');
  });

  test('stays out when the list cannot be reached but was hidden last time', async ({ page }) => {
    await setup(page, 'unreachable', { cached: ['synara'] });
    await page.goto('/synara.html');
    await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
  });

  test('a person with Synara records on this device keeps their emergency card', async ({ page }) => {
    await setup(page, ['synara'], { synara: { meds: [{ id: 'm1', name: 'Example' }], seizures: [] } });
    await page.goto('/synara.html');
    await expect(page.locator('#screen')).toBeVisible();
    await expect(page).toHaveURL(/\/synara(\.html)?$/);
  });
});

test.describe('the owner', () => {
  test('still sees and opens a hidden app, marked Hidden', async ({ page }) => {
    await setup(page, ['synara'], { uid: OWNER_UID });
    await page.goto('/suite.html#partners');
    await expect(page.locator('.app--synara')).toContainText('Hidden');
    await page.goto('/synara.html');
    await expect(page).toHaveURL(/\/synara(\.html)?$/);
    await expect(page.locator('#screen')).toBeVisible();
  });

  test('another account signed in on the device is not the owner', async ({ page }) => {
    await setup(page, ['synara'], { uid: '11111111-2222-3333-4444-555555555555' });
    await page.goto('/synara.html');
    await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
  });
});

test.describe('someone given a role', () => {
  const PARTNER = '22222222-3333-4444-5555-666666666666';

  test('sees and opens the hidden app their role shows, marked Hidden', async ({ page }) => {
    await setup(page, ['synara'], { uid: PARTNER, perms: ['app:synara'] });
    await page.goto('/suite.html#partners');
    await expect(page.locator('.app--synara')).toContainText('Hidden');
    await page.goto('/synara.html');
    await expect(page).toHaveURL(/\/synara(\.html)?$/);
    await expect(page.locator('#screen')).toBeVisible();
  });

  test('still cannot open a hidden app their role does not show', async ({ page }) => {
    await setup(page, ['synara', 'pixel'], { uid: PARTNER, perms: ['app:synara'] });
    await page.goto('/pixel.html');
    await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
  });

  test('a grant cached for another account on this device does not carry over', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('flux_my_permissions_v1', JSON.stringify({ uid: 'someone-else', perms: ['app:synara'] })));
    await setup(page, ['synara']);
    await page.goto('/synara.html');
    await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
  });
});
