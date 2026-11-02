import { test, expect, type Browser, type Page } from '@playwright/test';

/*
 * Every Synara control that saves something, tapped for real on one
 * device, and then found on a second device signed in to the same Flux
 * account. The vault is one row held here in the test, as in
 * synara-sync.spec.ts.
 */

type Row = { ciphertext: string; iv: string; version: number; updated_at: string; key?: string } | null;
type Shared = { row: Row; writes: number };

async function device(browser: Browser, shared: Shared): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.exposeFunction('__vaultGet', () => shared.row);
  await page.exposeFunction('__vaultPut', (sealed: { ciphertext: string; iv: string; key?: string }) => {
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

/** The record as another device should see it: without device-only settings. */
const shareable = (rec: any) => {
  const out = JSON.parse(JSON.stringify(rec));
  delete out.settings.remindersOn;
  return out;
};

const tab = (page: Page, id: string) => page.locator(`.tab[data-to=${id}]:visible`).first().click();
const sheetClosed = (page: Page) => expect(page.locator('#sheet')).toBeHidden();

test('every saving control on one device reaches the other', async ({ browser }) => {
  test.setTimeout(150_000);
  const shared: Shared = { row: null, writes: 0 };
  const a = await device(browser, shared);
  const b = await device(browser, shared);
  const errors: string[] = [];
  for (const p of [a, b]) p.on('pageerror', (e) => errors.push(e.message));

  // A: a real record, synced. B: takes it.
  await a.goto('/synara.html');
  await a.getByRole('button', { name: 'Look around with example data' }).click();
  await a.evaluate(() => {
    const rec = JSON.parse(localStorage.getItem('synara.v2')!);
    rec.settings.seeded = false;
    localStorage.setItem('synara.v2', JSON.stringify(rec));
  });
  await a.reload();
  await expect.poll(() => shared.writes).toBe(1);
  await b.goto('/synara.html');
  await expect.poll(async () => shareable(await record(b))).toEqual(shareable(await record(a)));

  // Meds: cycle a dose, add a medication, stop one and restart another.
  await tab(a, 'meds');
  await a.locator('[data-action=dose-cycle]:visible').first().click();
  await a.locator('[data-action=med-open]:not([data-id])').click();
  await a.locator('#med-name').fill('Clobazam');
  await a.locator('#med-dose').fill('10 mg');
  await a.locator('[data-action=med-save]').last().click();
  await sheetClosed(a);
  // Stopping it the day it was added removes it; the example's stopped med restarts.
  await a.locator('[data-action=med-open]', { hasText: 'Clobazam' }).click();
  await a.locator('[data-action=med-stop]').click();
  await a.locator('[data-sheet-confirm]').click();
  await sheetClosed(a);
  await a.getByText('Stopped medications').click();
  await a.locator('[data-action=med-restart]').first().click();

  // Seizures: log one, and check in.
  await tab(a, 'track');
  await a.locator('[data-action=seizure-open]').first().click();
  await a.locator('[data-action=sz-chip]', { hasText: 'Absence' }).click();
  await a.locator('#sz-notes').fill('Synced from device A');
  await a.locator('[data-action=seizure-save]').last().click();
  await sheetClosed(a);
  await a.locator('[data-action=checkin-open]').first().click();
  await a.locator('[data-action=checkin-stress]', { hasText: '4' }).click();
  await a.locator('[data-action=checkin-save]').click();
  await sheetClosed(a);

  // Safety: a contact, the card text.
  await tab(a, 'safety');
  await a.locator('[data-action=contact-open]:not([data-id])').click();
  await a.locator('#c-name').fill('Coach Lee');
  await a.locator('#c-phone').fill('555 0100');
  await a.locator('[data-action=contact-save]').last().click();
  await sheetClosed(a);
  await a.locator('[data-action=card-edit][data-field=forCoach]').click();
  await a.locator('#card-text').fill('Stay with me. Time it. Call if over 5 minutes.');
  await a.locator('[data-action=card-save]').click();
  await sheetClosed(a);

  // You: details, Flux link, theme.
  await tab(a, 'you');
  await a.locator('[data-action=profile-edit]').first().click();
  await a.locator('#p-name').fill('Synced student');
  await a.locator('[data-action=profile-save]').last().click();
  await sheetClosed(a);
  await a.locator('[data-action=flux-link-toggle]').click();
  await a.locator('[data-action=theme-set][data-theme=dark]').click();

  const after = await record(a);
  expect(after.profile.name).toBe('Synced student');
  expect(after.meds.some((m: any) => m.name === 'Clobazam')).toBe(false);
  expect(after.meds.every((m: any) => !m.ended)).toBe(true);
  expect(after.contacts.some((c: any) => c.name === 'Coach Lee')).toBe(true);
  expect(after.seizures.some((s: any) => s.notes === 'Synced from device A')).toBe(true);

  // B, left open, gets all of it without a reload.
  await expect.poll(async () => shareable(await record(b)), { timeout: 60_000 })
    .toEqual(shareable(await record(a)));
  await tab(b, 'safety');
  await expect(b.locator('.contact-n', { hasText: 'Coach Lee' })).toBeVisible();
  expect(errors).toEqual([]);
});
