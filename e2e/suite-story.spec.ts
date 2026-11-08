import { test, expect, type Page } from '@playwright/test';

/**
 * Flux Suite opens with its scroll story (a fan of app cards, then a
 * departures board) and the apps below it. Signed out, it plays on every
 * visit; signed in, once per account on this device
 * (localStorage flux_suite_story_seen). A link to a tab skips it.
 */

const SESSION_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
const UID = 'suite-story-test';

async function signIn(page: Page) {
  await page.addInitScript(([key, uid]) => {
    localStorage.setItem(key, JSON.stringify({ access_token: 't', user: { id: uid } }));
  }, [SESSION_KEY, UID] as const);
}

async function scrollThroughBoard(page: Page) {
  await page.evaluate(() => {
    const s = document.querySelector('.suite-board-wrap') as HTMLElement;
    const top = s.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + s.offsetHeight - window.innerHeight);
  });
}

test('signed out, the story plays on every visit, above the apps', async ({ page }) => {
  for (let visit = 0; visit < 2; visit++) {
    await page.goto('/suite.html');
    await expect(page.locator('.suite-fan')).toBeVisible();
    const order = await page.evaluate(() => {
      const fan = document.querySelector('.suite-fan')!.getBoundingClientRect().top;
      const apps = document.getElementById('suiteApps')!.getBoundingClientRect().top;
      return fan < apps;
    });
    expect(order, 'the story comes before the apps').toBe(true);
    await scrollThroughBoard(page);
    await expect(page.locator('.board-row .s').first()).toHaveText(/OPEN/);
  }
});

test('signed in, the story plays once, then the apps come first', async ({ page }) => {
  await signIn(page);
  await page.goto('/suite.html');
  await expect(page.locator('.suite-fan')).toBeVisible();
  await scrollThroughBoard(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('flux_suite_story_seen'))).toContain(UID);

  await page.goto('/suite.html');
  await expect(page.locator('.suite-fan')).toBeHidden();
  await expect(page.locator('.suite-board-wrap')).toBeHidden();
  await expect(page.locator('#suiteApps .app--grapher')).toBeVisible();
});

test('a link to a tab skips the story', async ({ page }) => {
  await page.goto('/suite.html#partners');
  await expect(page.locator('.suite-fan')).toBeHidden();
});

test('the departures board lists only Flux’s own apps', async ({ page }) => {
  await page.goto('/suite.html');
  const names = await page.locator('.board-row .sr').allTextContents();
  expect(names.length).toBeGreaterThan(3);
  for (const n of names) expect(n).not.toMatch(/SYNARA|AORTA|OWNER/);
  await expect(page.locator('a.ig')).toHaveCount(0);
  await expect(page.locator('.top-ig')).toBeVisible();
});
