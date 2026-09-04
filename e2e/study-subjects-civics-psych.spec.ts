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

  /* Civics has moved twice. It began as its own pill, on the argument that
     world dates and capital cities share nothing with US government; it was
     briefly folded into History when the rail was cut down, which proved that
     argument correct; it now sits under Global Politics, which is the shelf it
     wanted all along — branches, amendments and case law are how power is
     arranged, not chronology. History keeps the timeline and the capitals. */
  test('Gov & Civics lives under Global Politics, with no pill of its own', async ({ page }) => {
    /* Re-query the umbrella each time rather than iterating one NodeList:
       choosing a group re-renders the group row, which detaches the nodes a
       held list is still pointing at, so every click after the first would
       land on nothing and the sweep would only ever see Science. */
    const pills: string[] = [];
    for (const g of ['science', 'maths-tech', 'humanities', 'languages-arts', 'arts']) {
      pills.push(...await page.evaluate((gid) => {
        (document.querySelector(`#fshGroups .fsh-group[data-group="${gid}"]`) as HTMLElement).click();
        return [...document.querySelectorAll('#fshRail .fsh-pill')].map(
          (p) => (p.textContent || '').trim());
      }, g));
    }
    expect(pills.some((p) => /Gov & Civics/.test(p))).toBe(false);
    expect(pills.some((p) => /Global Politics/.test(p))).toBe(true);
    // History keeps the capitals quiz and world map, so it keeps "& Geo".
    expect(pills.some((p) => /History & Geo/.test(p))).toBe(true);
    // The name it briefly carried while civics lived inside it is gone.
    expect(pills.some((p) => /History & Politics/.test(p))).toBe(false);
  });

  test('Civics renders branches, amendments and case law', async ({ page }) => {
    /* Click through to Branches rather than asserting against whatever tab
       happens to be default — Global Politics also carries the legacy
       reference chip, so the default is not guaranteed to be civics. */
    const { tabs, text } = await page.evaluate(async () => {
      (window as unknown as { fluxStudyHub: Hub }).fluxStudyHub.selectSubject('glopo');
      await new Promise((r) => setTimeout(r, 400));
      const branches = [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')]
        .find((t) => /Branches/.test(t.textContent || '')) as HTMLElement | undefined;
      branches?.click();
      await new Promise((r) => setTimeout(r, 400));
      const tabNames = [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')]
        .map((t) => (t.textContent || '').trim());
      const body = document.querySelector('#fshBody') || document.querySelector('.fsh-stage');
      return { tabs: tabNames, text: (body?.textContent || '').replace(/\s+/g, ' ').trim() };
    });
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
