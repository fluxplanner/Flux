import { test, expect, type Page } from '@playwright/test';

/*
 * Is the live suite up? Read-only checks of the deployed site and its backend.
 * A failure here pages the owner (see .github/workflows/live-smoke.yml), so
 * every check is something a real visitor would notice.
 */

const SUPABASE = 'https://lfigdijuqmbensebnevo.supabase.co';

/** Uncaught errors on the page. */
function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e?.message || e)));
  return errors;
}

test('the planner loads and shows the sign-in screen', async ({ page }) => {
  const errors = collectPageErrors(page);
  const res = await page.goto('index.html', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBeLessThan(400);
  await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 30_000 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the backend answers', async ({ request }) => {
  const config = await (await request.get('config.json')).json();
  const res = await request.get(`${SUPABASE}/auth/v1/health`, {
    headers: { apikey: config.anon_key },
  });
  expect(res.status()).toBe(200);
});

for (const path of ['landing.html', 'suite.html', 'owner.html', 'teacher.html', 'grapher.html', 'calculator.html', 'flashcards.html']) {
  test(`${path} loads without errors`, async ({ page }) => {
    const errors = collectPageErrors(page);
    const res = await page.goto(path, { waitUntil: 'load' });
    expect(res?.status()).toBeLessThan(400);
    await page.waitForTimeout(1500);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
