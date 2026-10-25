import { test, expect, type Browser, type Page } from '@playwright/test';

/*
 * Two devices, one Flux account. Each device is its own browser context
 * (its own storage, like a phone and a laptop); the vault both talk to is
 * one row held here in the test, standing in for synara_vaults. The row is
 * only ever ciphertext — the test checks that too.
 */

type Row = { ciphertext: string; iv: string; version: number; updated_at: string; key?: string } | null;

async function device(browser: Browser, shared: { row: Row; writes: number }): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.exposeFunction('__vaultGet', () => shared.row);
  await page.exposeFunction('__vaultPut', (sealed: { ciphertext: string; iv: string }) => {
    shared.writes++;
    shared.row = { ...sealed, version: 1, updated_at: new Date(Date.now() + shared.writes).toISOString() };
    return { updated_at: shared.row.updated_at };
  });
  await page.exposeFunction('__vaultRemove', () => { shared.row = null; return true; });
  await page.addInitScript(() => {
    const w = window as any;
    w.FluxSynaraVault = {
      account: async () => ({ id: 'student-1', email: 'student@example.com' }),
      get: () => w.__vaultGet(),
      put: (sealed: unknown) => w.__vaultPut(sealed),
      remove: () => w.__vaultRemove(),
    };
  });
  return page;
}

/** A row from before the key was kept in the account. */
const legacy = (shared: { row: Row }) => { if (shared.row) delete (shared.row as Record<string, unknown>).key; };

const record = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('synara.v2')!));

test('two devices on one Flux account stay in sync', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = { row: null as Row, writes: 0 };
  const a = await device(browser, shared);
  const b = await device(browser, shared);

  // Device A: a real record (not the example data), signed in, no synced
  // copy yet → it starts one by itself, encrypted.
  await a.goto('/synara.html');
  await a.getByRole('button', { name: 'Look around with example data' }).click();
  await expect(a.locator('#welcome')).toBeHidden();
  await a.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem('synara.v2')!);
    rec.settings.seeded = false;
    rec.profile.name = 'Device A student';
    localStorage.setItem('synara.v2', JSON.stringify(rec));
  });
  await a.reload();
  await expect.poll(() => shared.writes).toBe(1);
  expect(shared.row!.ciphertext).not.toContain('Device A student');
  await a.locator('.tab[data-to=you]').click();
  await a.locator('[data-action=sync-open]').click();
  const key = (await a.locator('.sync-key code').textContent())!.trim();
  await a.locator('[data-action=close-sheet]').first().click();

  // The key is kept in the account with the copy (option 2, 2026-10-25).
  expect(shared.row!.key).toBe(key.replace(/-/g, ''));

  // Device B: same account, nothing real here → it takes the synced copy
  // by itself, with no key to type and no welcome left in the way.
  await b.goto('/synara.html');
  await expect.poll(async () => (await record(b))?.profile.name).toBe('Device A student');
  await expect(b.locator('#welcome')).toBeHidden();
  await b.locator('.tab[data-to=home]').click();
  await expect(b.getByRole('button', { name: 'Enter sync key' })).toHaveCount(0);

  // An edit on B reaches A while A stays open, with no refocus or tap.
  const theme = (await record(a)).settings.theme === 'dark' ? 'light' : 'dark';
  await b.locator('.tab[data-to=you]').click();
  await b.locator(`[data-action=theme-set][data-theme=${theme}]`).click();
  await expect.poll(() => shared.writes, { timeout: 10_000 }).toBe(2);
  await expect.poll(async () => (await record(a)).settings.theme, { timeout: 45_000 }).toBe(theme);
  expect(shared.writes).toBe(2);   // A took B's copy without uploading it back
});

test('changing tab plays the entrance once, and reduced motion turns it off', async ({ page }) => {
  await page.goto('/synara.html');
  await page.getByRole('button', { name: 'Look around with example data' }).click();
  await page.locator('.tab[data-to=meds]').click();
  await expect(page.locator('.screen-inner')).toHaveClass(/route-enter/);
  const animation = () => page.locator('.screen-inner').evaluate((e) => getComputedStyle(e).animationName);
  await expect.poll(animation).toBe('synara-route-in');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.tab[data-to=home]').click();
  // The tab click re-renders on the next task, so a busy machine can still show the old screen here.
  await expect.poll(animation).toBe('none');
});

test('the welcome page sends sign-up through Flux and back to Synara', async ({ page }) => {
  await page.goto('/synara-welcome.html');
  await expect(page.getByText('Powered by').first()).toBeVisible();
  await page.route('**/index.html', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  await page.getByRole('link', { name: 'Create a free Flux account' }).first().click();
  await page.waitForURL('**/index.html');
  expect(await page.evaluate(() => sessionStorage.getItem('flux_return_to'))).toBe('synara.html');
});

test('a sync link sets up the second device without typing the key', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = { row: null as Row, writes: 0 };
  const a = await device(browser, shared);
  const b = await device(browser, shared);

  await a.goto('/synara.html');
  await a.getByRole('button', { name: 'Look around with example data' }).click();
  await a.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem('synara.v2')!);
    rec.settings.seeded = false;
    rec.profile.name = 'Linked student';
    localStorage.setItem('synara.v2', JSON.stringify(rec));
  });
  await a.reload();
  await expect.poll(() => shared.writes).toBe(1);
  await a.locator('.tab[data-to=you]').click();
  await a.locator('[data-action=sync-open]').click();
  await expect(a.locator('[data-action=sync-copy-link]')).toBeVisible();
  legacy(shared);   // a copy whose key isn't stored: the link is how B gets it
  const key = (await a.locator('.sync-key code').textContent())!.trim().replace(/-/g, '');

  await b.goto('/synara.html#/home?sync=' + key);
  await b.getByRole('button', { name: 'Use synced copy' }).click();
  await expect.poll(async () => (await record(b))?.profile.name).toBe('Linked student');
  // The key does not stay in the address bar or the history entry.
  expect(b.url()).not.toContain(key);
});

test('a copy from before the key was kept still asks for it, and gets its key stored', async ({ browser }) => {
  test.setTimeout(90_000);
  const shared = { row: null as Row, writes: 0 };
  const a = await device(browser, shared);
  const b = await device(browser, shared);
  await a.goto('/synara.html');
  await a.getByRole('button', { name: 'Look around with example data' }).click();
  await a.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem('synara.v2')!);
    rec.settings.seeded = false;
    localStorage.setItem('synara.v2', JSON.stringify(rec));
  });
  await a.reload();
  await expect.poll(() => shared.writes).toBe(1);
  legacy(shared);

  await b.goto('/synara.html');
  await b.getByRole('button', { name: 'Look around with example data' }).click();
  await expect(b.getByRole('button', { name: 'Enter sync key' })).toBeVisible();

  // A, which has the key, stores it on its next round.
  await a.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => shared.row!.key, { timeout: 15_000 }).toBeTruthy();
});
