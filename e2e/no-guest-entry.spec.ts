import { test, expect } from '@playwright/test';

/**
 * Every way into the planner needs a real account, because an account is the
 * only thing the owner can ban. The test harness ships to production, so ?e2e=1
 * on the live address used to open the app with nobody signed in.
 *
 * The page is served under a non-local name so the harness sees what it would
 * see on the live site. Supabase is blocked: no test here should reach it.
 */
const LIVE_LIKE = 'https://flux-live.test';

async function serveAsLive(page: import('@playwright/test').Page, baseURL: string) {
  await page.route('**/*.supabase.co/**', (route) => route.abort());
  await page.route(`${LIVE_LIKE}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: baseURL + url.pathname + url.search });
    await route.fulfill({ response });
  });
}

async function entryState(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => !!(window as any).FluxE2e, null, { timeout: 20000 });
  await page.waitForFunction(
    () => getComputedStyle(document.getElementById('loginScreen')!).display !== 'none',
    null,
    { timeout: 20000 },
  );
  return page.evaluate(() => {
    const w = window as any;
    return {
      harnessActive: w.FluxE2e.active(),
      mockClient: !!w.FluxE2e.getMockClient(),
      appVisible: getComputedStyle(document.getElementById('app')!).display !== 'none',
      guestFunctions: typeof w.confirmGuestLogin + '/' + typeof w.showGuestDisclaimer,
    };
  });
}

test.describe('No entry without an account', () => {
  for (const path of [
    '/?e2e=1&scenario=guest',
    '/?e2e=1&scenario=teacher-workflow',
    '/?scenario=teacher-workflow',
  ]) {
    test(`the live address refuses ${path}`, async ({ page, baseURL }) => {
      await serveAsLive(page, baseURL!);
      await page.goto(LIVE_LIKE + path);
      const s = await entryState(page);
      expect(s.harnessActive, 'the test harness ran on a live address').toBe(false);
      expect(s.mockClient, 'the fake database replaced the real one').toBe(false);
      expect(s.appVisible, 'the planner opened with nobody signed in').toBe(false);
      expect(s.guestFunctions).toBe('undefined/undefined');
    });
  }

  test('values left in the browser do not open it either', async ({ page, baseURL }) => {
    await serveAsLive(page, baseURL!);
    await page.addInitScript(() => {
      localStorage.setItem('flux_e2e', '1');
      localStorage.setItem('flux_e2e_scenario', 'teacher-workflow');
      localStorage.setItem('flux_was_guest', 'true');
    });
    await page.goto(LIVE_LIKE + '/');
    const s = await entryState(page);
    expect(s.harnessActive).toBe(false);
    expect(s.mockClient).toBe(false);
    expect(s.appVisible).toBe(false);
  });

  test('the harness still runs on this machine, so the other tests keep working', async ({ page }) => {
    await page.goto('/?e2e=1&scenario=teacher-workflow');
    await page.waitForFunction(() => !!(window as any).FluxE2e, null, { timeout: 20000 });
    expect(await page.evaluate(() => (window as any).FluxE2e.active())).toBe(true);
  });
});
