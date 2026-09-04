import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * Course-level tools layered onto existing subjects.
 *
 * Calculus, rhetoric and orchestra are courses, not subjects — Mathematics,
 * English and Music already hold those rail slots, and adding three more pills
 * to a rail already described as overwhelming would have been the wrong trade.
 * Each module calls H.register against an existing subject id, which
 * concatenates onto that subject's tools.
 *
 * The failure mode this guards is silent: register() against a mistyped
 * subject id throws nothing and renders nothing — the tools simply never
 * appear. So these assert the tab exists *and* that clicking it paints
 * content, rather than that a label is present.
 */

type Hub = { selectSubject: (id: string) => void };

async function openTab(page: import('@playwright/test').Page, subject: string, tabName: string) {
  await page.evaluate(async (sid: string) => {
    (window as unknown as { fluxStudyHub: Hub }).fluxStudyHub.selectSubject(sid);
    await new Promise((r) => setTimeout(r, 400));
  }, subject);
  const tab = page.locator('#fshChemTabs .fsh-chem-tab', { hasText: tabName }).first();
  await expect(tab, `no "${tabName}" tab under ${subject}`).toBeVisible();
  await tab.click();
  await page.waitForTimeout(350);
  return page.evaluate(() => {
    const b = document.querySelector('#fshBody') || document.querySelector('.fsh-stage');
    return (b?.textContent || '').replace(/\s+/g, ' ').trim();
  });
}

test.describe('AP course tools sit on their parent subject', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('toolbox'));
    await expect(page.locator('.fsh-pill').first()).toBeVisible();
  });

  test('Calculus AB: limits, theorems and applications live under Mathematics', async ({ page }) => {
    const limits = await openTab(page, 'math', 'Limits');
    expect(limits).toMatch(/Indeterminate/);
    expect(limits).toMatch(/L’Hôpital/);

    const theorems = await openTab(page, 'math', 'Theorems');
    // The hypotheses are where the marks are — assert they reached the page.
    expect(theorems).toMatch(/Intermediate Value Theorem/);
    expect(theorems).toMatch(/Mean Value Theorem/);
    expect(theorems).toMatch(/differentiable/i);

    const apps = await openTab(page, 'math', 'Applications');
    expect(apps).toMatch(/Inflection point/);
    expect(apps).toMatch(/Total distance/);
  });

  test('the calculus drill marks an answer and keeps score', async ({ page }) => {
    await openTab(page, 'math', 'Calculus drill');
    await expect(page.locator('#calcScore')).toHaveText('Score 0 / 0');
    await page.locator('#calcOpts button').first().click();
    // Whichever option happened to be first, the drill must respond and count it.
    await expect(page.locator('#calcScore')).toHaveText(/Score [01] \/ 1/);
    await expect(page.locator('#calcFb')).not.toBeEmpty();
  });

  test('AP Lang: fallacies and the three essays live under English', async ({ page }) => {
    const fallacies = await openTab(page, 'english', 'Fallacies');
    expect(fallacies).toMatch(/Straw man/);
    expect(fallacies).toMatch(/Post hoc/);
    // The distinguishing note is the point of the tab, not the bare name.
    expect(fallacies).toMatch(/red herring changes the subject/i);

    const essays = await openTab(page, 'english', 'The three essays');
    expect(essays).toMatch(/Synthesis/);
    expect(essays).toMatch(/Rhetorical analysis/);
    expect(essays).toMatch(/Sophistication/);
  });

  test('Orchestra: transposition calculates both directions', async ({ page }) => {
    await openTab(page, 'music', 'Transposition');
    // Defaults to Horn in F on C: sounds a perfect 5th lower — C down 7 = F.
    await expect(page.locator('.fsh-out')).toContainText('Written C sounds as F');

    // Same instrument, other direction: to sound a concert C, write G.
    await page.locator('#trDirSeg button[data-dir="written"]').click();
    await expect(page.locator('.fsh-out')).toContainText('Concert C is written as G');

    // Clarinet in B♭ sounds a major 2nd lower: written C sounds B♭.
    await page.locator('#trDirSeg button[data-dir="sounding"]').click();
    await page.selectOption('#trInstr', { label: 'Clarinet in B♭' });
    await expect(page.locator('.fsh-out')).toContainText('Written C sounds as B♭');
  });

  test('Orchestra: score order and markings render', async ({ page }) => {
    const score = await openTab(page, 'music', 'Score order');
    expect(score).toMatch(/Woodwind/);
    expect(score).toMatch(/Violin I, Violin II, Viola, Cello, Double bass/);

    const marks = await openTab(page, 'music', 'Tempo & markings');
    expect(marks).toMatch(/Allegro/);
    expect(marks).toMatch(/Pizzicato/);
  });

  test('none of the three added a pill to the rail', async ({ page }) => {
    // The rail is per-umbrella now, so sweep all five to see every pill.
    const pills: string[] = [];
    for (const g of ['science', 'maths-tech', 'humanities', 'languages-arts', 'arts']) {
      pills.push(...await page.evaluate((gid) => {
        (document.querySelector(`#fshGroups .fsh-group[data-group="${gid}"]`) as HTMLElement).click();
        return [...document.querySelectorAll('#fshRail .fsh-pill')].map(
          (e) => (e as HTMLElement).dataset.sub || '');
      }, g));
    }
    // 12 = the twelve originals, less astronomy (into physics) and civics (into
    // history), plus Visual Arts. Calculus, rhetoric and orchestra ride on
    // math, english and music rather than adding pills of their own.
    expect(pills).toHaveLength(12);
    expect(pills).not.toContain('calculus');
    expect(pills).not.toContain('rhetoric');
    expect(pills).not.toContain('orchestra');
  });
});
