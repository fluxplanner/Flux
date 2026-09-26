import { test, expect } from '@playwright/test';
import { gotoScenario } from './helpers';

/**
 * The grapher inside the planner: Study tools → Algebra & graphing → Grapher.
 *
 * Same engine as grapher.html, but it lives among 150-odd planner stylesheets,
 * one of which forces padding, margins and font size onto every text field
 * with !important. That turned each table cell into a 40px form box. These
 * pin the cells at spreadsheet size, and that the planner's copy keeps its
 * working state the way the other study tools do.
 */

async function openGrapher(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1440, height: 950 });
  await gotoScenario(page, 'student-semester');
  await page.evaluate(() => (window as any).nav('toolbox'));
  await page.waitForTimeout(600);
  await page.evaluate(() => (window as any).fluxStudyHub.selectSubject('math'));
  await page.locator('#fshChemTabs [data-tool="graph"]').click();
  await expect(page.locator('.flg-shell--planner')).toBeVisible();
}

test.describe('Grapher in the planner', () => {
  test('both halves are there, and table cells are not inflated by the planner\'s form styles', async ({ page }) => {
    await openGrapher(page);
    await page.locator('[data-pmode="data"]').click();
    await expect(page.locator('.flg--planner .flg-table')).toBeVisible();
    const h = await page.locator('.flg-cell').first().evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(h, `a cell is ${h}px tall — the planner's !important input rule is winning`).toBeLessThan(36);

    await page.locator('[data-pmode="functions"]').click();
    await expect(page.locator('.flg--planner .flg-expr').first()).toBeVisible();
    // Drawn on the next frame, so poll rather than count once.
    await expect.poll(() => page.locator('.flg--planner .flg-plot polyline').count()).toBeGreaterThan(0);
  });

  test('the chosen tab stands out, and the grapher\'s own buttons are not painted like planner buttons', async ({ page }) => {
    await openGrapher(page);
    await page.locator('[data-pmode="data"]').click();
    const bg = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(await bg('[data-pmode="data"]'), 'the selected tab is filled').toContain('gradient');
    expect(await bg('[data-pmode="functions"]'), 'the other tab is not').toBe('none');
    expect(await bg('.flg--planner [data-hist="undo"]'), 'undo is a plain icon button').toBe('none');
    expect(await bg('.flg--planner [data-tool="in"]'), 'zoom is a plain icon button').not.toContain('gradient');
  });

  test('the planner keeps its working graph, like every other study tool', async ({ page }) => {
    await openGrapher(page);
    await page.locator('[data-pmode="data"]').click();
    const t = page.locator('.flg--planner .flg-item--table').first();
    await t.locator('[data-cell="0:0"]').fill('4');
    await t.locator('[data-cell="0:1"]').fill('9');
    await page.waitForTimeout(700);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('flux_lab_graph') || 'null'));
    expect(stored?.items?.[0]?.rows?.[0]?.slice(0, 2)).toEqual(['4', '9']);

    // Leave and come back: the reading is still there.
    await page.locator('[data-pmode="functions"]').click();
    await page.locator('[data-pmode="data"]').click();
    await expect(page.locator('.flg--planner [data-cell="0:1"]').first()).toHaveValue('9');
  });
});
