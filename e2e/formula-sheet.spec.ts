import { test, expect } from '@playwright/test';
import { gotoScenario, allStudyTools } from './helpers';

/**
 * One formula sheet per subject, sectioned by unit.
 *
 * The owner's instruction was "in EVERY SINGLE SUBJECT, at the end of the
 * units, put the formula sheet for EVERYTHING" — so the two ways this breaks
 * are a subject ending up with *two* formula tabs, or with one that is empty.
 *
 * Both have already happened. Chemistry shipped with a Reference unit and a
 * legacy chem-ref chip one tab apart, and physics shipped with the new sheet
 * beside the old "Physics formulas" chip — the same array rendered twice by
 * two different renderers. Counting per subject is what catches the next one,
 * so this walks every subject rather than naming the two that went wrong.
 */

type Win = { nav: (t: string) => void };

test.describe('Formula sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 950 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as Win).nav('toolbox'));
    await expect(page.locator('#fshGroups')).toBeVisible();
    await page.waitForTimeout(700);
  });

  test('no subject offers two formula tabs', async ({ page }) => {
    /* Every umbrella, not just whichever one loaded first — the rail only
       draws the active umbrella's subjects. */
    const all = await page.evaluate(async () => {
      const groups = [...document.querySelectorAll('#fshGroups .fsh-group[data-group]')] as HTMLElement[];
      const ids = new Set<string>();
      for (const g of groups) {
        g.click();
        await new Promise((r) => setTimeout(r, 350));
        for (const p of document.querySelectorAll('#fshRail .fsh-pill[data-sub]')) {
          const id = (p as HTMLElement).dataset.sub;
          if (id) ids.add(id);
        }
      }
      return [...ids];
    });

    expect(all.length, 'no subjects were found, so nothing was checked').toBeGreaterThan(5);

    const offenders: string[] = [];
    for (const sid of all) {
      await page.evaluate(async (id) => {
        (window as unknown as { fluxStudyHub: { selectSubject: (s: string) => void } })
          .fluxStudyHub.selectSubject(id);
        await new Promise((r) => setTimeout(r, 300));
      }, sid);
      /* allStudyTools walks every unit and unions the strip. Reading the strip
         once only shows the *selected* unit's tools, so a second copy sitting
         one unit away stays invisible — which is exactly how the physics
         duplicate survived an earlier version of this test. */
      const names = (await allStudyTools(page)).map((t) => t.label).filter((n) => /formula/i.test(n));
      if (names.length > 1) offenders.push(`${sid}: ${names.join(' + ')}`);
    }

    expect(offenders, `subjects showing more than one formula sheet:\n${offenders.join('\n')}`).toEqual([]);
  });

  test('the sheet holds real formulas, grouped into named sections', async ({ page }) => {
    const res = await page.evaluate(() => {
      const w = window as unknown as { FluxFormulaSheet?: { sheetFor: (s: string) => unknown[] } };
      if (!w.FluxFormulaSheet) return { missing: true, subjects: [] as { id: string; sections: number; items: number }[] };
      const subjects = ['math', 'physics', 'chemistry', 'biology'].map((id) => {
        const sections = (w.FluxFormulaSheet!.sheetFor(id) || []) as { items?: unknown[] }[];
        return {
          id,
          sections: sections.length,
          items: sections.reduce((n, s) => n + (s.items?.length || 0), 0),
        };
      });
      return { missing: false, subjects };
    });

    expect(res.missing, 'FluxFormulaSheet never installed').toBe(false);
    for (const s of res.subjects) {
      /* A sheet that renders but holds nothing is the failure a smoke test
         misses: the tab is there, the page is blank. */
      expect(s.sections, `${s.id} has no formula sections`).toBeGreaterThan(0);
      expect(s.items, `${s.id} has sections but no formulas in them`).toBeGreaterThan(4);
    }
  });
});
