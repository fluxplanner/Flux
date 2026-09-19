import { test, expect } from '@playwright/test';
import { gotoScenario, openSidebarTab } from './helpers';

/**
 * Chemistry, split into units.
 *
 * Chemistry was the one subject the subject→unit work missed, because it does
 * not go through the registry like the others — its panels are built inside
 * flux-study-hub.js and drawn by renderChem(). So it kept a flat strip, and one
 * tab of that strip, "Tools", held six unrelated calculators: a balancer, molar
 * mass, pH and dilution, the gas law, a solubility table and constants. Finding
 * the gas law meant already knowing it was in there.
 *
 * Those are separate tabs now, filed into units. The tests below cover the two
 * things most likely to break quietly: the retired "tools" id, and a unit click
 * resolving back to the wrong unit.
 */
/* 'formula-sheet' ends the list on purpose, and in every subject rather than
   just this one: the sheet moved out of Reference so it is findable in the
   same place everywhere. Reference keeps the constants table and the legacy
   chemistry reference, which are lookups rather than formulas. */
const UNIT_IDS = ['atoms', 'compounds', 'reactions', 'solutions', 'reference', 'practice', 'formula-sheet'];

test.describe('Chemistry units', () => {
  test.beforeEach(async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    await openSidebarTab(page, 'toolbox');
    await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('chemistry'));
    await expect(page.locator('#fshChemTabs')).toBeVisible();
  });

  test('chemistry has a unit row, like every other subject', async ({ page }) => {
    const units = await page.evaluate(() =>
      [...document.querySelectorAll('#fshUnits .fsh-unit[data-unit]')]
        .map((u) => (u as HTMLElement).dataset.unit));

    /* The six named units come first and in order. A trailing "more" is
       expected, not an error: legacy chemistry chips are registered elsewhere
       and are not filed into a unit, so unitsFor buckets them rather than
       hiding them. Asserting the prefix keeps this test about the taxonomy
       instead of about how many legacy chips happen to exist. */
    expect(units.slice(0, UNIT_IDS.length)).toEqual(UNIT_IDS);
    expect(units.slice(UNIT_IDS.length)).toEqual(
      units.length > UNIT_IDS.length ? ['more'] : [],
    );
  });

  test('clicking a unit shows that unit, not the first one', async ({ page }) => {
    /* The regression this catches: renderChem defaulted the tab to 'table'
       before resolving the unit, so the lookup resolved back to the unit that
       owns 'table' and every click landed on Atoms & the table. */
    await page.locator('#fshUnits [data-unit="solutions"]').click();
    await expect(page.locator('#fshUnits [data-unit="solutions"]')).toHaveClass(/\bactive\b/);

    const tabs = await page.evaluate(() =>
      [...document.querySelectorAll('#fshChemTabs [data-tab]')]
        .map((t) => (t as HTMLElement).dataset.tab));

    expect(tabs).toEqual(['phdil', 'gas']);
  });

  /*
   * Chemistry had two things called Reference: the unit, and a legacy
   * "Chemistry Reference" modal that unitsFor() had swept into the trailing
   * More bucket because no unit claimed it. Two references one tab apart is
   * worse than either alone — you cannot tell which holds the table you want.
   *
   * It is claimed by the Reference unit rather than deleted: its four tables
   * (polyatomic ions, solubility rules, acid/base, constants) overlap the Ions,
   * Solubility and Constants tabs but are not provably a subset of them, and
   * dropping a table someone is mid-revision with is not a tidy-up.
   */
  test('there is one Reference, and it holds the legacy tables too', async ({ page }) => {
    const tabsNow = () => page.evaluate(() =>
      [...document.querySelectorAll('#fshChemTabs [data-tab]')]
        .map((t) => (t as HTMLElement).dataset.tab as string));

    await page.locator('#fshUnits [data-unit="reference"]').click();
    await expect(page.locator('#fshUnits [data-unit="reference"]')).toHaveClass(/\bactive\b/);
    const refTools = await tabsNow();
    expect(refTools, 'the legacy reference did not move into the Reference unit')
      .toContain('lg-chem-ref');

    const more = page.locator('#fshUnits [data-unit="more"]');
    if (await more.count()) {
      await more.click();
      const moreTools = await tabsNow();
      expect(moreTools, 'a second reference is still sitting in More')
        .not.toContain('lg-chem-ref');
    }
  });

  test('every tool from the old Tools grid is still reachable', async ({ page }) => {
    const wanted = ['balance', 'molar', 'phdil', 'gas', 'solubility', 'constants'];
    const found: string[] = [];

    for (const unit of UNIT_IDS) {
      await page.locator(`#fshUnits [data-unit="${unit}"]`).click();
      await expect(page.locator(`#fshUnits [data-unit="${unit}"]`)).toHaveClass(/\bactive\b/);
      const tabs = await page.evaluate(() =>
        [...document.querySelectorAll('#fshChemTabs [data-tab]')]
          .map((t) => (t as HTMLElement).dataset.tab as string));
      found.push(...tabs);
    }

    for (const id of wanted) {
      expect(found, `"${id}" fell out of the strip when Tools was split`).toContain(id);
    }
  });

  test('a saved "tools" tab lands on a real panel, not the table', async ({ page }) => {
    /* 'tools' no longer exists. Anyone whose last chemistry tab was 'tools'
       holds an id that resolves to nothing, and an unguarded fallback would
       drop them on the periodic table with no explanation. */
    const landed = await page.evaluate(async () => {
      const w = window as any;
      /* applyFromCloud only adopts the cursor while Study Tools is off screen —
         a deliberate guard, so an 8-second cloud pull cannot move the tab out
         from under a click. Leaving the panel is therefore part of the setup,
         not a workaround: it is the real path a saved tab arrives by. */
      w.nav('dashboard');
      await new Promise((r) => setTimeout(r, 400));
      w.fluxStudyHub.applyFromCloud({ subject: 'chemistry', chemTab: 'tools', tool: {}, favs: [] });
      w.nav('toolbox');
      await new Promise((r) => setTimeout(r, 600));
      w.fluxStudyHub.selectSubject('chemistry');
      await new Promise((r) => setTimeout(r, 300));
      const active = document.querySelector('#fshChemTabs .fsh-chem-tab.active') as HTMLElement | null;
      return active?.dataset.tab ?? null;
    });

    expect(landed, 'a retired tab id should be migrated, not silently dropped').toBe('balance');
  });

  test('each panel renders something', async ({ page }) => {
    const empties: string[] = [];
    for (const unit of UNIT_IDS) {
      await page.locator(`#fshUnits [data-unit="${unit}"]`).click();
      await expect(page.locator(`#fshUnits [data-unit="${unit}"]`)).toHaveClass(/\bactive\b/);
      const tabs = await page.evaluate(() =>
        [...document.querySelectorAll('#fshChemTabs [data-tab]')]
          .map((t) => (t as HTMLElement).dataset.tab as string));

      for (const id of tabs) {
        await page.locator(`#fshChemTabs [data-tab="${id}"]`).click();
        const filled = await page.evaluate(() => {
          const body = document.getElementById('fshChemBody');
          return !!body && body.textContent!.trim().length > 20;
        });
        if (!filled) empties.push(`${unit}/${id}`);
      }
    }

    expect(empties, 'these chemistry panels rendered nothing').toEqual([]);
  });
});
