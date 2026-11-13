import { test, expect, type Page } from '@playwright/test';

/**
 * Recovery email and reset-by-email (public/js/flux-recovery.js).
 *
 * The server function is mocked: what it enforces (confirmed addresses only,
 * single-use tokens, the current password) is the function's own business.
 * These tests pin the browser's half — the emailed links, the sign-in screen's
 * "Forgot your password?" button, and the Settings card — and that nothing
 * goes to the network that should not.
 */
const TOKEN = 'A'.repeat(43);
type Call = { action: string; [k: string]: unknown };

async function mockRecovery(page: Page, reply: (c: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  await page.route('**/functions/v1/account-recovery', async (route) => {
    const c = route.request().postDataJSON() as Call;
    calls.push(c);
    const r = reply(c);
    await route.fulfill({ status: r.status ?? 200, contentType: 'application/json', body: JSON.stringify(r.body) });
  });
  return calls;
}

test('a reset link asks for a new password, checks it, and saves it', async ({ page }) => {
  const calls = await mockRecovery(page, (c) => ({ body: { ok: true, username: 'jane.doe', check: !c.password } }));
  await page.goto(`/?e2e=1&scenario=guest#flux-reset=${TOKEN}`);

  const modal = page.locator('#fluxRecoveryModal');
  await expect(modal).toContainText('Choose a new password');
  await expect(modal).toContainText('jane.doe');
  // The token is gone from the address bar before anyone can copy or bookmark it.
  expect(await page.evaluate(() => location.hash)).toBe('');

  await page.fill('#frcPw1', 'Harbor-Lantern-42');
  await page.fill('#frcPw2', 'Harbor-Lantern-43');
  await page.click('#frcSave');
  await expect(page.locator('#frcMsg')).toHaveText('Those two passwords are not the same.');

  await page.fill('#frcPw1', 'short1');
  await page.fill('#frcPw2', 'short1');
  await page.click('#frcSave');
  await expect(page.locator('#frcMsg')).toContainText('at least 8 characters');
  // Neither mistake reached the server: only the link check has been sent.
  expect(calls.filter((c) => c.password)).toHaveLength(0);

  await page.fill('#frcPw1', 'Harbor-Lantern-42');
  await page.fill('#frcPw2', 'Harbor-Lantern-42');
  await page.click('#frcSave');
  await expect(modal).toContainText('Password changed');
  await expect(modal).toContainText('jane.doe');
  expect(calls.at(-1)).toMatchObject({ action: 'confirm_reset', token: TOKEN, password: 'Harbor-Lantern-42' });
});

test('an expired reset link says so and shows no password form', async ({ page }) => {
  await mockRecovery(page, () => ({ status: 400, body: { error: 'This link has expired or was already used. Ask for a new one.', code: 'bad_token' } }));
  await page.goto(`/?e2e=1&scenario=guest#flux-reset=${TOKEN}`);
  await expect(page.locator('#fluxRecoveryModal')).toContainText('This link has expired or was already used');
  await expect(page.locator('#frcPw1')).toHaveCount(0);
});

test('a confirmation link confirms the address', async ({ page }) => {
  const calls = await mockRecovery(page, (c) => ({ body: c.action === 'verify_email' ? { ok: true, email: 'jane@example.com' } : { ok: true } }));
  await page.goto(`/?e2e=1&scenario=guest#flux-verify=${TOKEN}`);
  await expect(page.locator('#fluxRecoveryModal')).toContainText('Email confirmed');
  await expect(page.locator('#fluxRecoveryModal')).toContainText('jane@example.com');
  expect(calls[0]).toMatchObject({ action: 'verify_email', token: TOKEN });
  await page.click('#frcOk');
  await expect(page.locator('#fluxRecoveryModal')).toHaveCount(0);
});

test('an ordinary link to a tab is left alone', async ({ page }) => {
  const calls = await mockRecovery(page, () => ({ body: { ok: true } }));
  await page.goto('/?e2e=1&scenario=guest#flux-reset=short');
  await page.waitForFunction(() => !!(window as any).FluxRecovery);
  await expect(page.locator('#fluxRecoveryModal')).toHaveCount(0);
  expect(calls).toHaveLength(0);
});

test('"Forgot your password?" asks the server and gives the same answer either way', async ({ page }) => {
  const calls = await mockRecovery(page, () => ({ body: { ok: true } }));
  await page.goto('/?e2e=1&scenario=guest');
  await page.waitForFunction(() => typeof (window as any).showLoginScreen === 'function');
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as any).showLoginScreen());
  await page.locator('#loginUsername').waitFor({ state: 'attached', timeout: 20000 });

  // Sign-up offers the optional email; sign-in does not show it.
  await expect(page.locator('#loginRecoveryEmail')).toHaveAttribute('type', 'email');

  await page.evaluate(() => {
    (document.querySelector('#loginUsername') as HTMLInputElement).value = 'Jane Doe';
    return (window as any).fluxRequestPasswordHelp();
  });
  expect(calls).toEqual([{ action: 'request_reset', username: 'jane.doe' }]);
  const said = await page.locator('#loginAuthError').textContent();
  expect(said).toContain('If that account has a recovery email');
  expect(said).toContain('If it does not');
});

test('Settings: saving a recovery email needs the current password and shows it is waiting', async ({ page }) => {
  const calls = await mockRecovery(page, (c) => {
    if (c.action === 'status') return { body: { ok: true, email: '', verified: false, canSend: true } };
    if (c.action === 'set_email') return { body: { ok: true, email: 'jane@example.com', verified: false, sent: true } };
    return { body: { ok: true, email: '', verified: false } };
  });
  await page.goto('/?e2e=1&scenario=teacher-workflow');
  await page.waitForFunction(() => !!(window as any).FluxRecovery && !!(window as any).currentUser?.email, null, { timeout: 20000 });

  await page.evaluate(() => { (document.querySelector('#recEmail') as HTMLInputElement).value = 'jane@example.com'; });
  await page.evaluate(() => (window as any).FluxRecovery.save());
  await expect(page.locator('#recMsg')).toHaveText('Type your current password too, so we know it is you.');
  expect(calls.filter((c) => c.action === 'set_email')).toHaveLength(0);

  await page.evaluate(() => { (document.querySelector('#recPassword') as HTMLInputElement).value = 'Current-Pass-9'; });
  await page.evaluate(() => (window as any).FluxRecovery.save());
  await expect(page.locator('#recMsg')).toHaveText('Check jane@example.com and click the link to confirm it.');
  await expect(page.locator('#recStatus')).toContainText('Waiting for you to click the link sent to jane@example.com');
  expect(calls.find((c) => c.action === 'set_email')).toMatchObject({ email: 'jane@example.com', password: 'Current-Pass-9' });
  // The password is not left sitting in the field.
  expect(await page.evaluate(() => (document.querySelector('#recPassword') as HTMLInputElement).value)).toBe('');
  expect(await page.evaluate(() => (document.querySelector('#recRemoveBtn') as HTMLElement).hidden)).toBe(false);
});
