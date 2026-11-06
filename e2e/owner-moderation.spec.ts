import { test, expect } from '@playwright/test';

/**
 * The Moderation tab prints text written by anyone who can post, intruders
 * included, so these tests feed it hostile rows through a stand-in client. Bans
 * themselves are enforced by the database and tested there.
 */
const EVIL = '<img src=x onerror="window.__pwned=1">';

test.beforeEach(async ({ page }) => {
  await page.goto('/?e2e=1&scenario=guest');
  await page.waitForFunction(() => !!(window as any).FluxOwnerModeration);
  await page.evaluate((evil) => {
    const log = [{
      source: 'school_announcements', action: 'INSERT', created_at: '2026-11-05T05:09:00Z',
      author_label: evil, author_ip: '203.0.113.9', content: { title: evil, body: 'hello' },
    }];
    const intel = [{
      user_id: 'u1', username: 'a"b', display_name: evil, role: 'student', deleted: false,
      device_id: 'abc', ip: '203.0.113.9', accounts_on_ip: 4, last_seen: '2026-11-05T05:09:00Z',
    }];
    const query = (rows: unknown[]) => {
      const q: any = {
        select: () => q, order: () => q, limit: () => q, eq: () => q,
        then: (done: any) => Promise.resolve({ data: rows, error: null }).then(done),
      };
      return q;
    };
    (window as any).getSB = () => ({
      from: (t: string) => query(t === 'flux_public_content_log' ? log : []),
      rpc: async (name: string) => name === 'flux_owner_user_intel'
        ? { data: intel, error: null }
        : { data: null, error: { code: 'PT403', message: 'flux_banned' } },
    });
    const mount = document.createElement('div');
    mount.id = 'modTest';
    document.body.appendChild(mount);
    (window as any).FluxOwnerModeration.render(mount);
  }, EVIL);
});

test('archive shows hostile posts as plain text', async ({ page }) => {
  const mount = page.locator('#modTest');
  await expect(mount).toContainText('school_announcements');
  await expect(mount).toContainText(EVIL);
  await expect(mount.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
});

test('people view warns about shared addresses and offers each ban', async ({ page }) => {
  const mount = page.locator('#modTest');
  await mount.locator('[data-view=people]').click();
  await expect(mount).toContainText('shared by 4 accounts');
  for (const label of ['Ban account', 'Ban IP', 'Ban device', 'Save to report']) {
    await expect(mount.getByRole('button', { name: label })).toBeVisible();
  }
  await expect(mount.locator('img')).toHaveCount(0);
});

test('bans and report views load when empty', async ({ page }) => {
  const mount = page.locator('#modTest');
  await mount.locator('[data-view=bans]').click();
  await expect(mount).toContainText('No active bans.');
  await mount.locator('[data-view=reports]').click();
  await expect(mount).toContainText('Nobody has been saved yet.');
});

test('a banned response shows the lock screen', async ({ page }) => {
  await page.evaluate(() => (window as any).FluxOwnerModeration.checkIn());
  await expect(page.locator('#fluxBanLock')).toContainText('Access to Flux has been removed');
});
