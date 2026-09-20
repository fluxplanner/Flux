import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * Colouring the periodic table by a property.
 *
 * The numbers matter more than the pixels here. A revision tool that shows a
 * confidently wrong constant is worse than one that shows nothing — a blank
 * page sends you to the textbook, a wrong number does not. So the first test
 * pins Z_eff against values textbooks publish, and nothing in the source is
 * allowed to be a remembered constant: electronegativity is measured data
 * already in ELEMENTS, and everything else is derived from the electron
 * configuration string.
 */

type Win = { nav: (t: string) => void; fluxStudyHub: { selectSubject: (s: string) => void } };

test.describe('Periodic trends', () => {
  test('Z_eff agrees with the values textbooks publish', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(() => {
      const P = (window as any).fluxPeriodic;
      if (!P?.zeff) return { missing: true, rows: [] as [string, number, number][], nulls: -1 };
      const by: Record<string, unknown> = {};
      for (const e of P.ELEMENTS) by[e.s] = e;
      /* Slater's rules worked on paper. Deliberately spread across the awkward
         cases: 1s (its own 0.30 rule), the 2p block, the jump to a new shell,
         and two transition metals where 3d shields 4s at 0.85. */
      const want: Record<string, number> = {
        H: 1.00, He: 1.70, Li: 1.30, Be: 1.95, F: 5.20,
        Ne: 5.85, Na: 2.20, K: 2.20, Sc: 3.00, Zn: 4.35,
      };
      const rows = Object.entries(want).map(([s, w]) => [s, P.zeff(by[s]), w] as [string, number, number]);
      const nulls = P.ELEMENTS.filter((e: unknown) => P.zeff(e) == null).length;
      return { missing: false, rows, nulls };
    });

    expect(res.missing, 'fluxPeriodic.zeff never installed').toBe(false);
    for (const [sym, got, wanted] of res.rows) {
      expect(got, `Z_eff for ${sym}`).toBeCloseTo(wanted, 2);
    }
    /* Every element must resolve. zeff() returns null when a configuration
       fails to parse or does not account for every electron, so a non-zero
       count here means the table would show gaps. */
    expect(res.nulls, 'elements whose configuration would not parse').toBe(0);
  });

  test('every trend covers the table and moves in the direction it claims', async ({ page }) => {
    await gotoScenario(page, 'student-semester');
    const res = await page.evaluate(() => {
      const P = (window as any).fluxPeriodic;
      const bySym: Record<string, any> = {};
      for (const e of P.ELEMENTS) bySym[e.s] = e;
      return P.TRENDS.map((t: any) => ({
        id: t.id,
        covered: P.ELEMENTS.filter((e: unknown) => P.trendValue(t.id, e) != null).length,
        hasAcross: !!t.across, hasDown: !!t.down, hasNote: !!t.note,
        naToCl: [P.trendValue(t.id, bySym.Na), P.trendValue(t.id, bySym.Cl)],  // period 3, L→R
        liToCs: [P.trendValue(t.id, bySym.Li), P.trendValue(t.id, bySym.Cs)],  // group 1, top→bottom
      }));
    });

    expect(res.length, 'no trends registered').toBeGreaterThan(2);
    for (const t of res) {
      expect(t.covered, `${t.id} has values for almost no elements`).toBeGreaterThan(40);
      expect(t.hasAcross && t.hasDown && t.hasNote, `${t.id} is missing its explanation`).toBe(true);
    }

    const en = res.find((t: any) => t.id === 'en');
    const zeff = res.find((t: any) => t.id === 'zeff');
    const shells = res.find((t: any) => t.id === 'shells');
    /* The claims the key makes in words, checked against the data it is drawn
       from — so the arrows cannot quietly start contradicting the colours. */
    expect(en.naToCl[1], 'electronegativity should rise Na → Cl').toBeGreaterThan(en.naToCl[0]);
    expect(en.liToCs[1], 'electronegativity should fall Li → Cs').toBeLessThan(en.liToCs[0]);
    expect(zeff.naToCl[1], 'Z_eff should rise Na → Cl').toBeGreaterThan(zeff.naToCl[0]);
    expect(shells.liToCs[1], 'shells should increase Li → Cs').toBeGreaterThan(shells.liToCs[0]);
  });

  test('picking a trend recolours the table and shows the scale', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await gotoScenario(page, 'student-semester');
    await page.evaluate(() => (window as unknown as Win).nav('toolbox'));
    await page.evaluate(() => (window as unknown as Win).fluxStudyHub.selectSubject('chemistry'));
    await expect(page.locator('#fshPtTrends')).toBeVisible({ timeout: 10_000 });

    /* Inline style, not getComputedStyle. The table sits in a scrolling
       container whose subtree the browser skips rendering while it is out of
       view, and computed style comes back as transparent-black there whatever
       is actually painted. The inline value is what this feature sets, so it
       is both the honest signal and the stable one. */
    const before = await page.evaluate(() =>
      (document.querySelector('#fshPtGrid .fsh-el[data-n="9"]') as HTMLElement).style.background);

    await page.locator('#fshPtTrends .fsh-cat-chip[data-trend="en"]').click();
    await expect(page.locator('#fshPtKey .fsh-ptk')).toBeVisible();

    const after = await page.evaluate(() => {
      const f = document.querySelector('#fshPtGrid .fsh-el[data-n="9"]')!;   // fluorine, the maximum
      const he = document.querySelector('#fshPtGrid .fsh-el[data-n="2"]')!;  // helium, no value
      return {
        fluorine: (f as HTMLElement).style.background,
        fluorineLabel: f.querySelector('.e-m')?.textContent,
        heliumLabel: he.querySelector('.e-m')?.textContent,
        heliumFlagged: he.classList.contains('trend-none'),
        keyText: document.getElementById('fshPtKey')?.textContent || '',
      };
    });

    expect(after.fluorine, 'the table did not recolour').not.toBe(before);
    // Fluorine is the most electronegative element; the cell should say so.
    expect(after.fluorineLabel).toBe('3.98');
    /* "No value" must not read as "low value" — helium is unmeasured, not
       zero. */
    expect(after.heliumLabel, 'helium should show a dash, not a number').toBe('—');
    expect(after.heliumFlagged).toBe(true);
    expect(after.keyText, 'the key should state the across-a-period direction').toMatch(/across a period/i);
    expect(after.keyText, 'the key should state the down-a-group direction').toMatch(/down a group/i);

    // Back to Category clears the colouring and restores the masses.
    await page.locator('#fshPtTrends .fsh-cat-chip[data-trend=""]').click();
    const restored = await page.evaluate(() => {
      const f = document.querySelector('#fshPtGrid .fsh-el[data-n="9"]') as HTMLElement;
      return { inline: f.style.background, label: f.querySelector('.e-m')?.textContent };
    });
    expect(restored.inline, 'trend colouring outlived the trend').toBe('');
    expect(restored.label, 'the atomic mass did not come back').toBe('19.00');
  });
});
