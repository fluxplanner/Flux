import { test, expect, type Page, type Browser } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The Flux × Synara partnership: Purple Day, Flux Partners and its kit, the
 * Synara ↔ planner link, and Synara's encrypted sync through a Flux account.
 * Synara itself is covered by synara.spec.ts.
 */

const PURPLE_DAY = new Date('2027-03-26T10:00:00');
const NOT_PURPLE_DAY = new Date('2027-03-25T10:00:00');
const accent = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());

test.describe('Purple Day', () => {
  test('on March 26 the hub goes purple and points to Synara; dismissing it lasts the year', async ({ page }) => {
    await page.clock.setFixedTime(PURPLE_DAY);
    await page.goto('/hub.html');
    await expect(page.locator('html')).toHaveClass(/flux-purple-day/);
    expect(await accent(page)).toBe('#a78bfa');

    const banner = page.locator('[data-purple-day-slot] .fxpd');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Purple Day');
    await expect(banner).toContainText('Call 911 if it lasts more than 5 minutes');
    await expect(banner.locator('a')).toHaveAttribute('href', 'synara.html');
    // Nothing on it may move: photosensitivity is the point of the day.
    expect(await banner.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

    await banner.getByRole('button', { name: 'Hide the Purple Day message' }).click();
    await expect(page.locator('.fxpd')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.fxpd')).toHaveCount(0);
    await expect(page.locator('html')).toHaveClass(/flux-purple-day/); // still purple, just quieter
  });

  test('any other day nothing changes', async ({ page }) => {
    await page.clock.setFixedTime(NOT_PURPLE_DAY);
    await page.goto('/hub.html');
    await expect(page.locator('html')).not.toHaveClass(/flux-purple-day/);
    await expect(page.locator('.fxpd')).toHaveCount(0);
    expect(await accent(page)).toBe('#00c2ff');
  });

  test('?purpleday previews it on any day', async ({ page }) => {
    await page.clock.setFixedTime(NOT_PURPLE_DAY);
    // /hub, not /hub.html?…: the test server's clean-URL redirect drops the query.
    await page.goto('/hub?purpleday');
    await expect(page.locator('[data-purple-day-slot] .fxpd')).toBeVisible();
  });

  test('the landing page carries it too', async ({ page }) => {
    await page.clock.setFixedTime(PURPLE_DAY);
    await page.goto('/landing.html');
    await expect(page.locator('[data-purple-day-slot] .fxpd')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/flux-purple-day/);
  });

  test('the planner turns purple with a corner card, and the tools follow', async ({ page }) => {
    await page.clock.setFixedTime(PURPLE_DAY);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoScenario(page, 'student-semester');
    await expect(page.locator('html')).toHaveClass(/flux-purple-day/);
    await expect(page.locator('.fxpd--float')).toBeVisible();
    expect(await accent(page)).toBe('#a78bfa');

    await page.goto('/grapher.html');
    await expect(page.locator('html')).toHaveClass(/flux-purple-day/);
  });

  test('Synara suggests showing the safety card', async ({ page }) => {
    await page.clock.setFixedTime(PURPLE_DAY);
    await page.goto('/synara.html');
    await page.getByRole('button', { name: 'Look around with example data' }).click();
    const card = page.locator('.purple-day');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Open my safety card' }).click();
    await expect(page.locator('.screen-inner[data-route="safety"]')).toBeVisible();
  });
});

test.describe('Flux Partners', () => {
  test('the hub labels Synara a partner and links to the program', async ({ page }) => {
    await page.goto('/hub.html');
    await expect(page.locator('#apps a.app--synara .app-partner')).toHaveText('Partner');
    await expect(page.locator('#apps .app-partner')).toHaveCount(1);
    await page.locator('.partners-strip a').click();
    await expect(page).toHaveURL(/partners/);
  });

  test('the partners page lists Synara and its kit actually downloads', async ({ page, request }) => {
    await page.goto('/partners.html');
    await expect(page.locator('.partner h3')).toHaveText('Synara');
    await expect(page.locator('.partner a')).toHaveAttribute('href', 'synara.html');

    const files = await page.locator('#kit a[download]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const href of files) {
      const res = await request.get('/' + href);
      expect(res.status(), `${href} is missing`).toBe(200);
    }
    const broken = await page.locator('.shot img').evaluateAll(async (imgs) => {
      await Promise.all(imgs.map((i) => (i as HTMLImageElement).decode().catch(() => null)));
      return imgs.filter((i) => !(i as HTMLImageElement).naturalWidth).length;
    });
    expect(broken, 'a screenshot does not load').toBe(0);

    // The Purple Day post is there, and the badge snippet is the badge shown.
    await expect(page.locator('#p2')).toContainText('#PurpleDay');
    await expect(page.locator('#badgePreview a')).toHaveAttribute('href', /landing\.html/);
    await expect(page.locator('a[href^="mailto:"]').first()).toHaveAttribute('href', /Flux%20Partners/);
  });

  test('copy buttons copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/partners.html');
    await page.locator('[data-copy-from="w1"]').click();
    await expect(page.locator('[data-copy-from="w1"]')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('free planner for school');
  });
});

test.describe('Synara in the Flux Planner', () => {
  const FEED = { v: 1, meds: [{ name: 'Levetiracetam', dose: '500 mg', color: 'violet', added: '2020-01-01', ended: null, schedule: [{ from: '2020-01-01', times: ['08:00', '20:00'] }] }] };

  test('Synara shares only medication times, and only when asked', async ({ page }) => {
    await page.goto('/synara.html');
    await page.getByRole('button', { name: 'Look around with example data' }).click();
    await page.locator('.tab[data-to="you"]').click();
    expect(await page.evaluate(() => localStorage.getItem('synara.flux'))).toBeNull();

    await page.getByRole('switch', { name: 'Show in my Flux Planner' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('synara.flux'))).not.toBeNull();
    const feed = JSON.parse((await page.evaluate(() => localStorage.getItem('synara.flux')))!);
    expect(Object.keys(feed)).toEqual(['v', 'meds']);
    expect(feed.meds.length).toBeGreaterThan(0);
    expect(JSON.stringify(feed)).not.toContain('Maya');

    await page.getByRole('switch', { name: 'Show in my Flux Planner' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('synara.flux'))).toBeNull();
  });

  test('the planner shows dose times on its calendar and the safety card in School info', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate((f) => localStorage.setItem('synara.flux', JSON.stringify(f)), FEED);

    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('calendar'));
    await page.locator('.cal-day.today').click();
    const day = page.locator('#calDayTasks');
    await expect(day).toContainText('Synara · medication');
    await expect(day).toContainText('Levetiracetam 500 mg');
    await expect(day.locator('a[href="synara.html#/meds"]').first()).toBeVisible();

    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('school'));
    const card = page.locator('#fxSynaraSchool');
    await expect(card).toBeVisible();
    await expect(card.locator('a[href="synara.html#/sos"]')).toBeVisible();

    // Turned off in Synara: gone from the planner.
    await page.evaluate(() => localStorage.removeItem('synara.flux'));
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('calendar'));
    await page.locator('.cal-day.today').click();
    await expect(page.locator('#calDayTasks')).not.toContainText('Synara');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('school'));
    await expect(page.locator('#fxSynaraSchool')).toHaveCount(0);
  });

  test('a malformed summary is ignored, not drawn', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const out = await page.evaluate(() => {
      const w = window as unknown as { FluxSynara: { dosesForDate: (d: string) => unknown[] } };
      localStorage.setItem('synara.flux', JSON.stringify({ v: 1, meds: [{ name: '<img src=x onerror=alert(1)>', added: 'yesterday', schedule: [] }] }));
      const a = w.FluxSynara.dosesForDate('2027-01-01');
      localStorage.setItem('synara.flux', '{not json');
      const b = w.FluxSynara.dosesForDate('2027-01-01');
      return [a.length, b.length];
    });
    expect(out).toEqual([0, 0]);
  });
});

test.describe('Synara sync through a Flux account', () => {
  type Row = { ciphertext: string; iv: string; version: number; updated_at: string } | null;

  /** A device: its own browser, sharing one Flux account's vault with the others. */
  async function device(browser: Browser, shared: { row: Row; writes: number }) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.exposeFunction('__vault', (op: string, arg: { ciphertext: string; iv: string }) => {
      if (op === 'get') return shared.row;
      if (op === 'put') {
        shared.writes += 1;
        shared.row = { ciphertext: arg.ciphertext, iv: arg.iv, version: 1, updated_at: new Date(Date.UTC(2027, 0, 1, 0, 0, shared.writes)).toISOString() };
        return { updated_at: shared.row.updated_at };
      }
      if (op === 'remove') { shared.row = null; return true; }
      return null;
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __vault: (op: string, arg?: unknown) => Promise<unknown>; FluxSynaraVault: unknown };
      w.FluxSynaraVault = {
        account: async () => ({ id: 'student-1', email: 'student@example.com' }),
        get: () => w.__vault('get'),
        put: (r: unknown) => w.__vault('put', r),
        remove: () => w.__vault('remove'),
      };
    });
    return { ctx, page };
  }

  test('a second device gets the record, edits flow back, and Flux only ever holds ciphertext', async ({ browser }) => {
    test.setTimeout(90_000);
    const shared = { row: null as Row, writes: 0 };

    const A = await device(browser, shared);
    await A.page.goto('/synara.html');
    await A.page.getByRole('button', { name: 'Look around with example data' }).click();
    await A.page.locator('.tab[data-to="you"]').click();
    await A.page.getByRole('button', { name: /Sync across your devices/ }).click();
    await A.page.getByRole('button', { name: 'Start syncing from this device' }).click();
    const key = (await A.page.locator('.sync-key code').textContent())!.trim();
    expect(key).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{1,4}){6}$/);
    await A.page.locator('.sheet [data-action="close-sheet"]').first().click();
    await expect(A.page.locator('#sheet')).toBeHidden();

    expect(shared.row).not.toBeNull();
    const stored = Buffer.from(shared.row!.ciphertext, 'base64').toString('latin1');
    for (const secret of ['Maya', 'Levetiracetam', 'seizure', '555']) {
      expect(stored, `"${secret}" readable in what Flux stores`).not.toContain(secret);
    }

    const B = await device(browser, shared);
    await B.page.goto('/synara.html');
    await B.page.getByRole('button', { name: 'Set it up for me' }).click();
    await B.page.locator('.tab[data-to="you"]').click();
    await B.page.getByRole('button', { name: /Sync across your devices/ }).click();
    await B.page.locator('#sync-key').fill('  ' + key.toLowerCase() + ' ');
    await B.page.getByRole('button', { name: 'Connect this device' }).click();
    await B.page.getByRole('button', { name: 'Use synced copy' }).click();
    await B.page.locator('.tab[data-to="home"]').click();
    await expect(B.page.locator('.appbar-t')).toContainText('Maya');

    // An edit on B reaches the vault, then A.
    const before = shared.writes;
    await B.page.locator('.tab[data-to="you"]').click();
    await B.page.locator('[data-action="profile-edit"]').first().click();
    await B.page.locator('#p-name').fill('Riley Ellison');
    await B.page.locator('.sheet [data-action="profile-save"]').last().click();
    await expect.poll(() => shared.writes, { timeout: 15_000 }).toBeGreaterThan(before);

    await A.page.getByRole('button', { name: /Sync across your devices/ }).click();
    await A.page.getByRole('button', { name: 'Sync now' }).click();
    await A.page.locator('.tab[data-to="home"]').click();
    await expect(A.page.locator('.appbar-t')).toContainText('Riley');

    // A wrong key is refused without touching anything.
    const C = await device(browser, shared);
    await C.page.goto('/synara.html');
    await C.page.getByRole('button', { name: 'Set it up for me' }).click();
    await C.page.locator('.tab[data-to="you"]').click();
    await C.page.getByRole('button', { name: /Sync across your devices/ }).click();
    await C.page.locator('#sync-key').fill('0000-0000-0000-0000-0000-0000-00');
    await C.page.getByRole('button', { name: 'Connect this device' }).click();
    await expect(C.page.locator('#toast')).toContainText('doesn’t open your synced copy');

    for (const d of [A, B, C]) await d.ctx.close();
  });

  test('deleting everything on one device never syncs an empty record over the others', async ({ browser }) => {
    const shared = { row: null as Row, writes: 0 };
    const A = await device(browser, shared);
    await A.page.goto('/synara.html');
    await A.page.getByRole('button', { name: 'Look around with example data' }).click();
    await A.page.locator('.tab[data-to="you"]').click();
    await A.page.getByRole('button', { name: /Sync across your devices/ }).click();
    await A.page.getByRole('button', { name: 'Start syncing from this device' }).click();
    await expect(A.page.locator('.sync-key code')).toBeVisible();
    await A.page.locator('.sheet [data-action="close-sheet"]').first().click();
    await expect(A.page.locator('#sheet')).toBeHidden();
    const writes = shared.writes;
    const row = shared.row;

    await A.page.locator('[data-action="data-wipe"]').click();
    await A.page.getByRole('button', { name: 'Delete everything' }).last().click();
    await expect(A.page.locator('#welcome')).toBeVisible();
    await A.page.waitForTimeout(4000); // longer than the upload delay
    expect(shared.writes).toBe(writes);
    expect(shared.row).toBe(row);
    expect(await A.page.evaluate(() => localStorage.getItem('synara.sync'))).toBe('{}');
    await A.ctx.close();
  });
});
