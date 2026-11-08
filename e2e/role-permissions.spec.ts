import { test, expect, type Page } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Role permissions (Owner Controls › Roles) on the pages people use. Each page
 * asks flux-app-visibility.js what this viewer may do; the tests answer
 * flux_my_permissions() themselves. Site mode and posting are also enforced in
 * the database (migration flux_role_permissions), tested there.
 */

const SESSION_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
const MEMBER = '22222222-3333-4444-5555-666666666666';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

async function asMember(page: Page, perms: string[], extra: { hiddenApps?: string[]; siteMode?: unknown } = {}) {
  await page.route('**/rest/v1/rpc/flux_my_permissions', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(perms) }));
  await page.route('**/rest/v1/flux_hidden_apps**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify((extra.hiddenApps || []).map((app_id) => ({ app_id }))) }));
  await page.route('**/rest/v1/platform_settings?key=eq.site_mode**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(extra.siteMode ? [{ value: extra.siteMode }] : []) }));
  await page.route('**/rest/v1/flux_announcements**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' }));
  await page.addInitScript(([key, uid]) => {
    const w = window as unknown as Record<string, boolean>;
    w.__FLUX_APP_VIS_TEST = true;
    w.__FLUX_SITE_NOTICES_TEST = true;
    localStorage.setItem(key as string, JSON.stringify({ access_token: 't', user: { id: uid } }));
  }, [SESSION_KEY, MEMBER]);
}

test.describe('apps', () => {
  test('"See every hidden app" opens any hidden app', async ({ page }) => {
    await asMember(page, ['apps:all'], { hiddenApps: ['pixel', 'grapher'] });
    await page.goto('/pixel.html');
    await expect(page).toHaveURL(/\/pixel(\.html)?$/);
    await page.goto('/suite.html');
    await expect(page.locator('.app--grapher')).toContainText('Hidden');
  });

  test('Aorta stays out for everyone else while hidden', async ({ page }) => {
    await asMember(page, [], { hiddenApps: ['aorta'] });
    await page.goto('/aorta.html');
    await expect(page).toHaveURL(/\/suite(\.html)?(#.*)?$/);
    await expect(page.locator('.app--aorta')).toHaveCount(0);
  });

  test('a role that can see Aorta opens it', async ({ page }) => {
    await asMember(page, ['app:aorta'], { hiddenApps: ['aorta'] });
    await page.goto('/aorta.html');
    await expect(page).toHaveURL(/\/aorta(\.html)?$/);
  });
});

test.describe('site mode', () => {
  const maintenance = { mode: 'maintenance', starts_at: '2020-01-01T00:00:00Z', message: 'Back soon' };

  test('without the permission, maintenance covers the page', async ({ page }) => {
    await asMember(page, [], { siteMode: maintenance });
    await page.goto('/grapher.html');
    await expect(page.locator('#fluxSiteMaintenance')).toBeVisible();
  });

  test('"Use Flux during maintenance" skips the screen and says why', async ({ page }) => {
    await asMember(page, ['site:maintenance'], { siteMode: maintenance });
    await page.goto('/grapher.html');
    await expect(page.locator('[data-notice="site"]')).toContainText('Your role lets you keep using it');
    await expect(page.locator('#fluxSiteMaintenance')).toHaveCount(0);
  });
});

test.describe('planner tabs', () => {
  const hideCalendar = async (page: Page) => {
    await page.addInitScript(() => {
      localStorage.setItem('flux_platform_ui', JSON.stringify({ hiddenTabs: ['calendar'], cachedAt: Date.now() }));
    });
  };

  test('a hidden tab stays hidden without the permission', async ({ page }) => {
    await asMember(page, []);
    await hideCalendar(page);
    await gotoScenario(page, 'guest');
    await page.waitForTimeout(700);
    await expect(page.locator('#sidebar [data-tab="calendar"]').first()).toBeHidden();
  });

  test('"See the Calendar tab" brings it back', async ({ page }) => {
    await asMember(page, ['tab:calendar']);
    await hideCalendar(page);
    await gotoScenario(page, 'guest');
    await page.waitForTimeout(700);
    await expect(page.locator('#sidebar [data-tab="calendar"]').first()).toBeVisible();
  });
});
