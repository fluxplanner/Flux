import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Gov & Civics, and Psychology.
 *
 * Both modules existed as files but neither was reachable: `civics` was in no
 * subject list, and `psychology` sat in the rail with nothing registered
 * against it, so the hub's legacy index filled it with one static reference
 * sheet — one tab where every other subject had three to eight, and nothing on
 * it could be practised.
 *
 * A subject needs three separate things to line up: an entry in the hub's
 * SUBJECTS array, a module calling H.register with a *matching* id, and that
 * module listed in the bundle manifest after flux-study-hub.js. Miss any one
 * and the failure is silent — a pill that renders a fallback, or no pill at
 * all. These tests fail loudly instead.
 *
 * Asserted on content, not tab names: a tab whose panel renders nothing still
 * has a name, which is exactly how the old psychology test passed for years
 * without a psychology module behind it.
 */

type Hub = { selectSubject: (id: string) => void };
const stageOf = async (page: import('@playwright/test').Page, id: string) =>
  page.evaluate(async (sid: string) => {
    (window as unknown as { fluxStudyHub: Hub }).fluxStudyHub.selectSubject(sid);
    await new Promise((r) => setTimeout(r, 400));
    const tabs = [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')].map((t) =>
      (t.textContent || '').trim(),
    );
    const body = document.querySelector('#fshBody') || document.querySelector('.fsh-stage');
    return { tabs, text: (body?.textContent || '').replace(/\s+/g, ' ').trim() };
  }, id);

test.describe('Gov & Civics and Psychology are real subjects', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('toolbox'));
    await expect(page.locator('.fsh-pill').first()).toBeVisible();
  });

  test('Gov & Civics has its own pill, separate from History & Geo', async ({ page }) => {
    const pills = await page.evaluate(() =>
      [...document.querySelectorAll('.fsh-pill')].map((p) => (p.textContent || '').trim()),
    );
    expect(pills.some((p) => /Gov & Civics/.test(p))).toBe(true);
    // Still its own subject, not folded into the timeline-and-capitals module.
    expect(pills.some((p) => /History & Geo/.test(p))).toBe(true);
  });

  test('Civics renders branches, amendments and case law', async ({ page }) => {
    const { tabs, text } = await stageOf(page, 'civics');
    expect(tabs).toEqual(expect.arrayContaining(['Branches', 'Amendments', 'Landmark cases', 'Drill']));
    // Content, not just chrome — the default tab must actually paint.
    expect(text.length).toBeGreaterThan(800);
    expect(text).toMatch(/Legislative/);
    expect(text).toMatch(/Article I/);
  });

  test('Psychology has practisable tools, not just a reference sheet', async ({ page }) => {
    const { tabs, text } = await stageOf(page, 'psychology');
    // Was exactly one tab ("Psychology", the legacy static sheet) before the
    // module was wired in; that sheet is still there, now alongside real tools.
    expect(tabs.length).toBeGreaterThan(1);
    expect(tabs).toEqual(
      expect.arrayContaining(['Key figures', 'Conditioning drill', 'Brain & chemistry', 'Defences & biases']),
    );
    expect(text.length).toBeGreaterThan(800);
  });

  test('neither subject throws on the way in', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await stageOf(page, 'civics');
    await stageOf(page, 'psychology');
    expect(errs).toEqual([]);
  });
});
