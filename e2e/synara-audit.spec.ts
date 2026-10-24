import { test, expect, type Browser, type Page } from '@playwright/test';

/*
 * The whole of Synara, through its own buttons.
 *
 * 1. Every edit a student can make on one device arrives on a second
 *    device signed in to the same Flux account (the vault is one row held
 *    here, as in synara-sync.spec.ts).
 * 2. Every button on every tab does something when clicked: opens a sheet
 *    or card, changes the page, or says something — and never throws.
 */

type Row = { ciphertext: string; iv: string; version: number; updated_at: string } | null;

async function device(browser: Browser, shared: { row: Row; writes: number }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
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
const tab = (page: Page, to: string) => page.locator(`.tab[data-to=${to}]`).click();
const sheet = (page: Page) => page.locator('#sheet');

async function save(page: Page, action: string) {
  // The form and its footer button both carry the action; tap the button.
  await sheet(page).locator(`button[data-action=${action}]`).last().click();
  await expect(sheet(page)).toBeHidden();
}

test('every kind of edit on one device reaches the other', async ({ browser }) => {
  test.setTimeout(180_000);
  const shared = { row: null as Row, writes: 0 };
  const a = await device(browser, shared);
  const b = await device(browser, shared);

  // A: a real record, synced. B: joined with A's key.
  await a.goto('/synara.html');
  await a.getByRole('button', { name: 'Look around with example data' }).click();
  await a.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem('synara.v2')!);
    rec.settings.seeded = false;
    localStorage.setItem('synara.v2', JSON.stringify(rec));
  });
  await a.reload();
  await expect.poll(() => shared.writes).toBeGreaterThan(0);
  await tab(a, 'you');
  await a.locator('[data-action=sync-open]').click();
  const key = (await a.locator('.sync-key code').textContent())!.trim();
  await a.locator('[data-action=close-sheet]').first().click();

  await b.goto('/synara.html');
  await b.getByRole('button', { name: 'Look around with example data' }).click();
  await b.getByRole('button', { name: 'Enter sync key' }).click();
  await b.locator('#sync-key').fill(key);
  await b.getByRole('button', { name: 'Connect this device' }).click();
  await b.getByRole('button', { name: 'Use synced copy' }).click();
  await expect(b.getByRole('button', { name: 'Enter sync key' })).toHaveCount(0);

  // A: a new medication.
  await tab(a, 'meds');
  await a.locator('[data-action=med-open]:not([data-id])').first().click();
  await a.locator('#med-name').fill('Audit med');
  await save(a, 'med-save');

  // A: a seizure.
  await tab(a, 'track');
  await a.locator('[data-action=seizure-open]:not([data-id])').first().click();
  await a.locator('#sz-notes').fill('Audit seizure');
  await save(a, 'seizure-save');

  // A: a contact.
  await tab(a, 'safety');
  await a.locator('[data-action=contact-open]:not([data-id])').first().click();
  await a.locator('#c-name').fill('Audit contact');
  await a.locator('#c-phone').fill('555 010 0199');
  await save(a, 'contact-save');

  // A: a dose ticked off today.
  await tab(a, 'home');
  const before = (await record(a)).doses;
  await a.locator('[data-action=dose-cycle]').first().click();
  await expect.poll(async () => JSON.stringify((await record(a)).doses)).not.toBe(JSON.stringify(before));
  const doses = (await record(a)).doses;

  // B receives all of it without a refocus or a tap.
  await expect.poll(async () => {
    const r = await record(b);
    return [
      r.meds.some((m: any) => m.name === 'Audit med'),
      r.seizures.some((s: any) => s.notes === 'Audit seizure'),
      r.contacts.some((c: any) => c.name === 'Audit contact'),
      JSON.stringify(r.doses) === JSON.stringify(doses),
    ];
  }, { timeout: 60_000 }).toEqual([true, true, true, true]);

  // And the other way: B removes the contact, A loses it.
  await tab(b, 'safety');
  await b.locator('[data-action=contact-open][data-id]', { hasText: 'Audit contact' }).click();
  await b.locator('#sheet [data-action=contact-delete]').click();
  const confirm = b.locator('#sheet').getByRole('button', { name: /Delete|Remove/ }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect.poll(async () => (await record(a)).contacts.some((c: any) => c.name === 'Audit contact'),
    { timeout: 60_000 }).toBe(false);
});

test('every button on every tab does something and never throws', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.goto('/synara.html');
  await page.getByRole('button', { name: 'Look around with example data' }).click();
  const fresh = await page.evaluate(() => localStorage.getItem('synara.v2'));

  // Leaving the page, or replacing the whole record, is checked elsewhere.
  const skip = new Set(['reload', 'data-export', 'print-card', 'reminders-test', 'nav']);
  const dead: string[] = [];

  for (const to of ['home', 'meds', 'track', 'safety', 'you']) {
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`/synara.html#/${to}`);
    await page.reload();
    const count = await page.locator('#screen [data-action]').count();
    for (let i = 0; i < count; i++) {
      await page.evaluate((rec) => {
        localStorage.setItem('synara.v2', rec!);
        sessionStorage.clear();   // a running seizure timer reopens the card
      }, fresh);
      await page.goto(`/synara.html#/${to}`);
      await page.reload();
      const node = page.locator('#screen [data-action]').nth(i);
      if (!(await node.isVisible().catch(() => false)) || await node.isDisabled()) continue;
      // A segment already chosen (the current theme) has nothing to change.
      if (await node.getAttribute('aria-pressed') === 'true' || await node.getAttribute('aria-checked') === 'true' && await node.getAttribute('role') === 'radio') continue;
      const action = (await node.getAttribute('data-action'))!;
      if (skip.has(action)) continue;
      const snap = () => page.evaluate(() =>
        [document.querySelector('#screen')!.innerHTML, document.querySelector('#sheet')?.innerHTML,
          document.body.className, location.hash, document.querySelector('.toast, #toast')?.textContent,
          document.querySelector('#emergency')?.getAttribute('data-open'),
          (document.querySelector('#welcome') as HTMLElement | null)?.hidden].join('§'));
      const was = await snap();
      await node.click({ timeout: 5000 }).catch(() => dead.push(`${to}: ${action} (not clickable)`));
      await page.waitForTimeout(400);
      if (await snap() === was) dead.push(`${to}: ${action} #${i}`);
    }
  }
  expect(errors, 'page errors').toEqual([]);
  expect(dead, 'buttons that did nothing').toEqual([]);
});
