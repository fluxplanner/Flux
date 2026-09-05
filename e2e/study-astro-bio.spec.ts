import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/*
 * The astronomy and biology expansions.
 *
 * Most of what was added is reference text, and a test that only checks a
 * heading rendered would pass just as happily on an empty panel. So the
 * assertions here are aimed at the three things that can actually break:
 *
 * 1. REGISTRATION. A module whose subject id is mistyped, or which is missing
 *    from the bundle manifest, throws nothing and renders nothing — the tabs
 *    simply never appear. Checked by id, for every tool.
 *
 * 2. THE CALCULATORS. Magnification, chi-squared, the Lincoln index, Kepler's
 *    third law and the distance converter all do real arithmetic, and the
 *    magnification one silently mixes millimetres and micrometres on the
 *    student's behalf. Wrong output here is the confidently-wrong failure this
 *    codebase keeps having to design against, so each is checked against a
 *    number worked out by hand.
 *
 * 3. THE DIAGRAMS. They are inline SVG rather than images precisely so they
 *    cannot 404 on a school network, which is only true if they are really in
 *    the DOM.
 */

type Hub = { selectSubject: (id: string) => void };

async function openTool(page: import('@playwright/test').Page, sid: string, tool: string) {
  await page.evaluate(async (id: string) => {
    (window as unknown as { fluxStudyHub: Hub }).fluxStudyHub.selectSubject(id);
    await new Promise((r) => setTimeout(r, 400));
  }, sid);
  const tab = page.locator(`#fshChemTabs [data-tool="${tool}"]`).first();
  await expect(tab, `no "${tool}" tab under ${sid}`).toBeVisible();
  await tab.click();
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const b = document.getElementById('fshSubBody');
    return (b?.textContent || '').replace(/\s+/g, ' ').trim();
  });
}

const toolIds = (page: import('@playwright/test').Page) =>
  page.evaluate(() => [...document.querySelectorAll('#fshChemTabs .fsh-chem-tab')]
    .map((t) => (t as HTMLElement).dataset.tool || ''));

test.describe('Astronomy and biology expansions', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as { nav: (t: string) => void }).nav('toolbox'));
    await expect(page.locator('.fsh-pill').first()).toBeVisible();
  });

  test('planet facts moved into the Solar system tab rather than staying a tab', async ({ page }) => {
    const text = await openTool(page, 'physics', 'orrery');
    const ids = await toolIds(page);

    // The separate tab is gone…
    expect(ids, 'the old Planet facts tab is still there').not.toContain('facts');
    // …and its content is in the tab that already selects planets.
    expect(text).toContain('All eight, side by side');
    for (const p of ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
      expect(text, `${p} missing from the comparison table`).toContain(p);
    }
    // Data the old tab never carried, so this is the expansion and not a move.
    expect(text).toContain('Surface gravity');
    expect(text).toContain('Mean temperature');
  });

  test('astronomy has seven tools and every one paints', async ({ page }) => {
    await page.evaluate(async () => {
      (window as unknown as { fluxStudyHub: Hub }).fluxStudyHub.selectSubject('physics');
      await new Promise((r) => setTimeout(r, 400));
    });
    const ids = await toolIds(page);
    for (const id of ['orrery', 'moon', 'stars', 'kepler', 'distance', 'deepsky', 'smallbodies']) {
      expect(ids, `physics is missing the ${id} tool`).toContain(id);
    }

    const marker: Record<string, RegExp> = {
      moon: /Saros|umbra/,
      stars: /OBAFGKM|main sequence/i,
      kepler: /equal areas|semi-major/i,
      distance: /parsec/i,
      deepsky: /Hubble sequence|redshift/i,
      smallbodies: /Kuiper|Oort/,
    };
    for (const [id, re] of Object.entries(marker)) {
      const text = await openTool(page, 'physics', id);
      expect(text, `${id} did not render`).not.toMatch(/still loading|Tool error/i);
      expect(text, `${id} is missing its content`).toMatch(re);
    }
  });

  test('Kepler and the distance converter do the arithmetic', async ({ page }) => {
    await openTool(page, 'physics', 'kepler');
    // Jupiter sits at 5.2 AU. 5.2^1.5 = 11.858…, and its real year is 11.86.
    await page.locator('#kepIn').fill('5.2');
    await page.locator('#kepGo').click();
    await expect(page.locator('#kepOut')).toContainText('11.858');

    // And back the other way: 11.86^(2/3) = 5.2006…
    await page.locator('#kepMode button[data-m="p"]').click();
    await page.locator('#kepIn').fill('11.86');
    await page.locator('#kepGo').click();
    await expect(page.locator('#kepOut')).toContainText('5.20');

    await openTool(page, 'physics', 'distance');
    // One parsec is 3.262 light-years — the conversion worth knowing.
    await page.locator('#dstIn').fill('1');
    await page.locator('#dstFrom button[data-u="pc"]').click();
    await expect(page.locator('#dstOut')).toContainText('3.26');
  });

  test('biology has the seven new tools and every one paints', async ({ page }) => {
    await page.evaluate(async () => {
      (window as unknown as { fluxStudyHub: Hub }).fluxStudyHub.selectSubject('biology');
      await new Promise((r) => setTimeout(r, 400));
    });
    const ids = await toolIds(page);
    for (const id of ['micro', 'biounits', 'carbs', 'lipids', 'biostats', 'pedigree', 'virus']) {
      expect(ids, `biology is missing the ${id} tool`).toContain(id);
    }
    // The originals are still there — this module adds, it does not replace.
    for (const id of ['punnett', 'translate', 'cell']) {
      expect(ids, `the original ${id} tool disappeared`).toContain(id);
    }

    const marker: Record<string, RegExp> = {
      micro: /resolution/i,
      biounits: /micrometre|prefix/i,
      carbs: /amylopectin|glycosidic/i,
      lipids: /triglyceride|phospholipid/i,
      biostats: /Lincoln|chi-squared|χ²/i,
      pedigree: /proband|autosomal/i,
      virus: /prophage|lysogenic/i,
    };
    for (const [id, re] of Object.entries(marker)) {
      const text = await openTool(page, 'biology', id);
      expect(text, `${id} did not render`).not.toMatch(/still loading|Tool error/i);
      expect(text, `${id} is missing its content`).toMatch(re);
    }
  });

  test('the diagrams are real inline SVG, not images that could 404', async ({ page }) => {
    for (const [tool, minShapes] of [['carbs', 6], ['lipids', 6], ['pedigree', 6], ['virus', 3]] as const) {
      await openTool(page, 'biology', tool);
      const res = await page.evaluate(() => {
        const b = document.getElementById('fshSubBody')!;
        return {
          svgs: b.querySelectorAll('svg').length,
          shapes: b.querySelectorAll('svg path, svg rect, svg circle, svg polygon, svg line').length,
          imgs: b.querySelectorAll('img').length,
        };
      });
      expect(res.svgs, `${tool} has no diagram`).toBeGreaterThan(0);
      expect(res.shapes, `${tool}'s diagram is empty`).toBeGreaterThanOrEqual(minShapes);
      expect(res.imgs, `${tool} uses an <img>, which can fail to load offline`).toBe(0);
    }
  });

  test('the magnification calculator converts mm and µm for you', async ({ page }) => {
    await openTool(page, 'biology', 'micro');

    /* A 30 mm drawing of a 15 µm cell. 30 mm is 30,000 µm, so the
       magnification is 30,000 ÷ 15 = ×2000. Getting 2 instead of 2000 is the
       classic unit slip, and the whole reason this tool does the conversion. */
    await page.locator('#mgI').fill('30');
    await page.locator('#mgA').fill('15');
    await page.locator('#mgM').fill('');
    await page.locator('#mgGo').click();
    await expect(page.locator('#mgOut')).toContainText('×2,000');

    // Backwards: 30 mm at ×2000 is a 15 µm object.
    await page.locator('#mgA').fill('');
    await page.locator('#mgM').fill('2000');
    await page.locator('#mgGo').click();
    await expect(page.locator('#mgOut')).toContainText('15 µm');

    // Two blanks is not a solvable question, and it says so.
    await page.locator('#mgI').fill('');
    await page.locator('#mgGo').click();
    await expect(page.locator('#mgOut')).toContainText('exactly one box');
  });

  test('chi-squared and the Lincoln index agree with the hand calculation', async ({ page }) => {
    await openTool(page, 'biology', 'biostats');

    /* O = 42,38,12,8 against E = 45,35,10,10 gives
       9/45 + 9/35 + 4/10 + 4/10 = 0.2 + 0.2571 + 0.4 + 0.4 = 1.2571,
       df = 3, critical value 7.81 — so not significant. */
    await page.locator('#csGo').click();
    await expect(page.locator('#csOut')).toContainText('χ² = 1.257');
    await expect(page.locator('#csOut')).toContainText('df = 3');
    await expect(page.locator('#csOut')).toContainText('no significant difference');

    // An expected value of zero would divide by zero and print nonsense.
    await page.locator('#csE').fill('45, 35, 0, 10');
    await page.locator('#csGo').click();
    await expect(page.locator('#csOut')).toContainText('above zero');

    // Lincoln: (60 × 72) ÷ 18 = 240.
    await page.locator('#liGo').click();
    await expect(page.locator('#liOut')).toContainText('240');

    // More marked recaptures than the whole second sample is impossible.
    await page.locator('#liN3').fill('99');
    await page.locator('#liGo').click();
    await expect(page.locator('#liOut')).toContainText('cannot recapture more');
  });

  test('nothing throws on the way through either subject', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    for (const id of ['orrery', 'moon', 'stars', 'kepler', 'distance', 'deepsky', 'smallbodies']) {
      await openTool(page, 'physics', id);
    }
    for (const id of ['micro', 'biounits', 'carbs', 'lipids', 'biostats', 'pedigree', 'virus']) {
      await openTool(page, 'biology', id);
    }
    expect(errs).toEqual([]);
  });
});
