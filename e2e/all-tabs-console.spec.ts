import { test, expect, type Page } from '@playwright/test';
import { gotoScenario, watchForViolations, assertNoCspOrConsoleViolations } from './helpers';

/**
 * Open every tab a role can see, and require silence.
 *
 * The other specs that use the console guard each cover the one or two tabs
 * they exercise. That leaves a real hole, because Flux keeps every tab's
 * markup mounted and only toggles `.active` — so a panel you are not looking
 * at is `display: none`, has no geometry, and reports clean no matter what is
 * wrong with it. A sweep of "what is on screen" is a sweep of one tab.
 *
 * That hole has already cost something: a "no Google UI left anywhere" check
 * came back clean while the Calendar tab still carried a live "Google Calendar
 * — sign in to sync" card. Nobody had opened the Calendar tab.
 *
 * Three roles, because educators have tabs students never see.
 */

const SCENARIOS = ['student-semester', 'teacher-workflow', 'counselor-path'] as const;

/**
 * Keep the sweep hermetic.
 *
 * student-semester runs with needsUser:false, so there is no mock Supabase
 * client and the real one reaches for the production project. From 127.0.0.1
 * that is a cross-origin request which sometimes fails and logs two console
 * errors — intermittently, so it would make this spec flaky for a reason that
 * has nothing to do with the app. An empty 200 is what these reads return for
 * a fresh account anyway.
 */
async function stubSupabaseRest(page: Page) {
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

for (const scenario of SCENARIOS) {
  test(`every tab opens silently — ${scenario}`, async ({ page }) => {
    await watchForViolations(page);
    await stubSupabaseRest(page);
    await gotoScenario(page, scenario);
    await page.waitForTimeout(1200);

    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll('#sidebar .nav-item[data-tab]')]
        .filter((n) => (n as HTMLElement).offsetHeight > 0)
        .map((n) => n.getAttribute('data-tab') as string));

    expect(tabs.length, 'no sidebar tabs found — did the shell render?').toBeGreaterThan(5);

    const landings: Record<string, string | null> = {};
    for (const tab of tabs) {
      // A real click, not el.click() inside evaluate(). The nav-intent guard in
      // app.js only records intent for e.isTrusted, so an untrusted click lets
      // the automatic educator routing redirect away and every tab looks broken.
      await page.click(`#sidebar .nav-item[data-tab="${tab}"]`);
      await page.waitForTimeout(700);
      landings[tab] = await page.evaluate(() => document.querySelector('.panel.active')?.id ?? null);
      expect(landings[tab], `clicking "${tab}" left no panel active`).not.toBeNull();
    }

    // Educators are routed from the generic dashboard to their own. That is
    // intended, so assert the redirect rather than the tab id — if it ever
    // lands somewhere else, something has changed that nobody meant to change.
    const expectedHome: Record<string, string> = {
      'student-semester': 'dashboard',
      'teacher-workflow': 'teacherDashboard',
      'counselor-path': 'counselorDashboard',
    };
    if (tabs.includes('dashboard')) {
      expect(landings.dashboard, `${scenario} should land on its own home`)
        .toBe(expectedHome[scenario]);
    }

    assertNoCspOrConsoleViolations(page);
  });
}
