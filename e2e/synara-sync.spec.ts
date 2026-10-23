import { test, expect, type Browser, type Page } from '@playwright/test';

/*
 * Two devices, one Flux account. Each device is its own browser context
 * (its own storage, like a phone and a laptop); the vault both talk to is
 * one row held here in the test, standing in for synara_vaults. The row is
 * only ever ciphertext — the test checks that too.
 */

type Row = { ciphertext: string; iv: string; version: number; updated_at: string } | null;

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

  // Device B: same account, nothing synced here → Home asks for the key.
  await b.goto('/synara.html');
  await b.getByRole('button', { name: 'Look around with example data' }).click();
  await b.getByRole('button', { name: 'Enter sync key' }).click();
  await b.locator('#sync-key').fill(key);
  await b.getByRole('button', { name: 'Connect this device' }).click();
  await b.getByRole('button', { name: 'Use synced copy' }).click();
  await expect.poll(async () => (await record(b)).profile.name).toBe('Device A student');
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
  expect(await page.locator('.screen-inner').evaluate((e) => getComputedStyle(e).animationName)).toBe('synara-route-in');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.tab[data-to=home]').click();
  expect(await page.locator('.screen-inner').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
});

test('the welcome page sends sign-up through Flux and back to Synara', async ({ page }) => {
  await page.goto('/synara-welcome.html');
  await expect(page.getByText('Powered by').first()).toBeVisible();
  await page.route('**/index.html', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  await page.getByRole('link', { name: 'Create a free Flux account' }).first().click();
  await page.waitForURL('**/index.html');
  expect(await page.evaluate(() => sessionStorage.getItem('flux_return_to'))).toBe('synara.html');
});
