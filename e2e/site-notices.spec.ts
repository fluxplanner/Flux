import { test, expect, type Page } from '@playwright/test';

/**
 * flux-site-notices.js: the maintenance screen, the read-only notice and the
 * owner's announcements, on every Flux page. The database is answered here, so
 * nothing reaches production. The database's own refusal of writes in
 * read-only mode is tested against the database, not here.
 */

const OWNER_UID = 'eabe2b1f-e428-4181-8530-8e5366eb3975';
const SESSION_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
const EVIL = '<img src=x onerror="window.__pwned=1">';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function setup(page: Page, opts: { mode?: unknown; announcements?: unknown[]; uid?: string } = {}) {
  const seen: { id: string; auth: string }[] = [];
  await page.route('**/*.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname.endsWith('/rpc/flux_mark_announcement_read')) {
      seen.push({ id: req.postDataJSON().p_id, auth: req.headers().authorization || '' });
      return json(null);
    }
    if (url.pathname.endsWith('/platform_settings')) return json(opts.mode ? [{ value: opts.mode }] : []);
    if (url.pathname.endsWith('/flux_announcements')) return json(opts.announcements || []);
    return json([]);
  });
  await page.addInitScript(([key, uid]) => {
    (window as any).__FLUX_SITE_NOTICES_TEST = true;
    if (uid) localStorage.setItem(key as string, JSON.stringify({ access_token: 'tok-' + uid, user: { id: uid } }));
  }, [SESSION_KEY, opts.uid || '']);
  return seen;
}

const hour = (n: number) => new Date(Date.now() + n * 3600000).toISOString();

test('maintenance covers the page with the message and a countdown', async ({ page }) => {
  await setup(page, { mode: { mode: 'maintenance', message: EVIL, ends_at: hour(2) } });
  await page.goto('/suite.html');
  const screen = page.locator('#fluxSiteMaintenance');
  await expect(screen).toBeVisible();
  await expect(screen).toContainText(EVIL);
  await expect(screen).toContainText(/Back in about (1 hour 59 min|2 hours)/);
  await expect(screen.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
});

test('the owner is never shut out by maintenance, and is reminded it is on', async ({ page }) => {
  await setup(page, { mode: { mode: 'maintenance', message: 'x' }, uid: OWNER_UID });
  await page.goto('/suite.html');
  await expect(page.locator('[data-notice="site"]')).toContainText('You set Flux to maintenance');
  await expect(page.locator('#fluxSiteMaintenance')).toHaveCount(0);
});

test('scheduled maintenance warns first, and read-only says changes are not saving', async ({ page }) => {
  await setup(page, { mode: { mode: 'maintenance', starts_at: hour(3) } });
  await page.goto('/suite.html');
  await expect(page.locator('[data-notice="site"]')).toContainText('Flux goes down for maintenance in');
  await expect(page.locator('#fluxSiteMaintenance')).toHaveCount(0);

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await setup(page, { mode: { mode: 'read_only' } });
  await page.goto('/suite.html');
  await expect(page.locator('[data-notice="site"]')).toContainText('not being saved to the cloud');
});

test('an announcement shows only in its app, closes for good, and counts who saw it', async ({ page }) => {
  const seen = await setup(page, {
    uid: 'student-1',
    announcements: [
      { id: 'a1', title: EVIL, body: 'For everyone', app: null, level: 'info' },
      { id: 'a2', title: 'Grapher only', body: null, app: 'grapher', level: 'warning' },
      { id: 'a3', title: 'Cannot close', body: null, app: null, level: 'urgent' },
    ],
  });
  await page.goto('/suite.html');
  const notices = page.locator('#fluxSiteNotices');
  await expect(notices).toContainText(EVIL);
  await expect(notices).toContainText('Cannot close');
  await expect(notices).not.toContainText('Grapher only');
  await expect(notices.locator('img')).toHaveCount(0);
  await expect.poll(() => seen.map((s) => s.id).sort()).toEqual(['a1', 'a3']);
  expect(seen[0].auth).toBe('Bearer tok-student-1');
  await expect(page.locator('[data-notice="ann-a3"] button')).toHaveCount(0);

  await page.locator('[data-notice="ann-a1"] button[aria-label="Close this notice"]').click();
  await page.reload();
  await expect(notices).toContainText('Cannot close');
  await expect(notices).not.toContainText('For everyone');
});

test('nothing shows, and nothing breaks, when the database cannot be reached', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.addInitScript(() => { (window as any).__FLUX_SITE_NOTICES_TEST = true; });
  await page.goto('/suite.html');
  await page.waitForTimeout(500);
  await expect(page.locator('#fluxSiteMaintenance')).toHaveCount(0);
  await expect(page.locator('#fluxSiteNotices [data-notice]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
